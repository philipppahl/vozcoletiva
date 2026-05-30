//! Integration tests for the deliberation tree (forks + tree query + multi-node
//! close) against DynamoDB-Local.
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use chrono::{Duration, Utc};
use support::{docker_available, LocalDdb};
use voz_api::auth::AuthenticatedUser;
use voz_api::domain::proposal::ProposalKind;
use voz_api::domain::vote::Choice;
use voz_api::domain::voting_rule::VotingRule;
use voz_api::jobs::close_proposal;
use voz_api::repo::proposal::Proposal;
use voz_api::repo::{proposal, vote};

fn user(id: &str) -> AuthenticatedUser {
    AuthenticatedUser {
        user_id: id.to_string(),
    }
}

macro_rules! ddb_or_skip {
    ($name:literal) => {{
        if !docker_available() {
            eprintln!("skipping {} — Docker not available", $name);
            return;
        }
        LocalDdb::start().await
    }};
}

async fn root(ddb: &LocalDdb, project: &str, rule: VotingRule, quorum: Option<i64>) -> Proposal {
    proposal::create(
        &ddb.state,
        project,
        &user("author"),
        "Root question".to_string(),
        "Body.".to_string(),
        rule,
        quorum,
        Utc::now() + Duration::hours(1),
        "cat-test".to_string(),
        ProposalKind::Decision,
        None,
    )
    .await
    .expect("create root")
}

async fn fork(
    ddb: &LocalDdb,
    project: &str,
    parent_id: &str,
    root: &Proposal,
    title: &str,
) -> Proposal {
    proposal::create_fork(
        &ddb.state,
        project,
        &user("forker"),
        title.to_string(),
        "Alt body.".to_string(),
        parent_id,
        root,
    )
    .await
    .expect("create fork")
}

#[tokio::test]
async fn fork_joins_tree_and_inherits_root_config() {
    let ddb = ddb_or_skip!("fork_joins_tree_and_inherits_root_config");
    let r = root(&ddb, "p1", VotingRule::SimpleMajority, Some(3)).await;
    let f = fork(&ddb, "p1", &r.id, &r, "Alternative A").await;

    assert_eq!(f.root_id, r.id);
    assert_eq!(f.parent_id.as_deref(), Some(r.id.as_str()));
    assert_eq!(f.voting_rule, r.voting_rule);
    assert_eq!(f.quorum, r.quorum);
    assert_eq!(f.ends_at, r.ends_at);

    let tree = proposal::tree(&ddb.state, &r.id).await.unwrap();
    let mut ids: Vec<&str> = tree.iter().map(|p| p.id.as_str()).collect();
    ids.sort();
    let mut want = vec![r.id.as_str(), f.id.as_str()];
    want.sort();
    assert_eq!(ids, want);
}

#[tokio::test]
async fn multi_level_fork_preserves_immediate_parent() {
    let ddb = ddb_or_skip!("multi_level_fork_preserves_immediate_parent");
    let r = root(&ddb, "p1", VotingRule::Plurality, None).await;
    let f1 = fork(&ddb, "p1", &r.id, &r, "A").await;
    // Fork of a fork: parent is f1, root stays r.
    let f2 = fork(&ddb, "p1", &f1.id, &r, "A.1").await;

    assert_eq!(f2.parent_id.as_deref(), Some(f1.id.as_str()));
    assert_eq!(f2.root_id, r.id);
    assert_eq!(proposal::tree(&ddb.state, &r.id).await.unwrap().len(), 3);
}

#[tokio::test]
async fn vote_for_a_fork_tallies_under_the_root() {
    let ddb = ddb_or_skip!("vote_for_a_fork_tallies_under_the_root");
    let r = root(&ddb, "p1", VotingRule::Plurality, None).await;
    let f = fork(&ddb, "p1", &r.id, &r, "A").await;

    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &r.id,
        Choice::Pick(f.id.clone()),
        None,
    )
    .await
    .expect("vote for fork");

    let root_after = proposal::get(&ddb.state, "p1", &r.id).await.unwrap();
    assert_eq!(root_after.tally.by_choice.get(&f.id).copied(), Some(1));
    assert_eq!(root_after.tally.decisive(), 1);
}

#[tokio::test]
async fn close_plurality_passes_winner_rejects_the_rest() {
    let ddb = ddb_or_skip!("close_plurality_passes_winner_rejects_the_rest");
    let r = root(&ddb, "p1", VotingRule::Plurality, None).await;
    let a = fork(&ddb, "p1", &r.id, &r, "A").await;
    let b = fork(&ddb, "p1", &r.id, &r, "B").await;

    // A: 2 votes, B: 1, root: 0 → A wins.
    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &r.id,
        Choice::Pick(a.id.clone()),
        None,
    )
    .await
    .unwrap();
    vote::cast(
        &ddb.state,
        &user("u2"),
        "p1",
        &r.id,
        Choice::Pick(a.id.clone()),
        None,
    )
    .await
    .unwrap();
    vote::cast(
        &ddb.state,
        &user("u3"),
        "p1",
        &r.id,
        Choice::Pick(b.id.clone()),
        None,
    )
    .await
    .unwrap();

    assert!(close_proposal::close(&ddb.state, "p1", &r.id)
        .await
        .unwrap());

    assert_eq!(
        proposal::get(&ddb.state, "p1", &a.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "passed"
    );
    assert_eq!(
        proposal::get(&ddb.state, "p1", &b.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "rejected"
    );
    assert_eq!(
        proposal::get(&ddb.state, "p1", &r.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "rejected"
    );
}

#[tokio::test]
async fn close_below_quorum_marks_whole_tree_quorum_failed() {
    let ddb = ddb_or_skip!("close_below_quorum_marks_whole_tree_quorum_failed");
    let r = root(&ddb, "p1", VotingRule::SimpleMajority, Some(5)).await;
    let a = fork(&ddb, "p1", &r.id, &r, "A").await;

    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &r.id,
        Choice::Pick(a.id.clone()),
        None,
    )
    .await
    .unwrap();
    assert!(close_proposal::close(&ddb.state, "p1", &r.id)
        .await
        .unwrap());

    assert_eq!(
        proposal::get(&ddb.state, "p1", &r.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "quorum_failed"
    );
    assert_eq!(
        proposal::get(&ddb.state, "p1", &a.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "quorum_failed"
    );
}
