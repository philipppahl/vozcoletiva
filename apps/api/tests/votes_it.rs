//! Integration tests for the per-deliberation vote path against DynamoDB-Local.
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
use voz_api::error::AppError;
use voz_api::jobs::close_proposal;
use voz_api::repo::{proposal, vote};

fn user(id: &str) -> AuthenticatedUser {
    AuthenticatedUser {
        user_id: id.to_string(),
    }
}

/// Skip-guard. Returns `None` (and prints) when Docker is unavailable.
macro_rules! ddb_or_skip {
    ($name:literal) => {{
        if !docker_available() {
            eprintln!("skipping {} — Docker not available", $name);
            return;
        }
        LocalDdb::start().await
    }};
}

async fn new_proposal(
    ddb: &LocalDdb,
    project: &str,
    author: &AuthenticatedUser,
    rule: VotingRule,
    quorum: Option<i64>,
) -> proposal::Proposal {
    proposal::create(
        &ddb.state,
        project,
        author,
        "Should we?".to_string(),
        "Body.".to_string(),
        rule,
        quorum,
        Utc::now() + Duration::hours(1),
        "cat-test".to_string(),
        ProposalKind::Decision,
        None,
        false,
    )
    .await
    .expect("create proposal")
}

#[tokio::test]
async fn cast_records_vote_and_tally() {
    let ddb = ddb_or_skip!("cast_records_vote_and_tally");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, None).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await
    .expect("cast");

    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.tally.by_choice.get(&prop.id).copied(), Some(1));
    assert_eq!(got.tally.decisive(), 1);
    assert_eq!(got.tally.total(), 1);

    let mine = vote::get(&ddb.state, &prop.root_id, "u1").await.unwrap();
    assert_eq!(mine.map(|v| v.choice), Some(Choice::Pick(prop.id)));
}

#[tokio::test]
async fn changing_vote_moves_the_tally() {
    let ddb = ddb_or_skip!("changing_vote_moves_the_tally");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, None).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await
    .unwrap();
    // Change pick → "none of these".
    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::NoneOfThese,
        Some(Choice::Pick(prop.id.clone())),
    )
    .await
    .expect("change vote");

    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.tally.by_choice.get(&prop.id).copied().unwrap_or(0), 0);
    assert_eq!(got.tally.none, 1);
    assert_eq!(got.tally.decisive(), 1);

    let mine = vote::get(&ddb.state, &prop.root_id, "u1").await.unwrap();
    assert_eq!(mine.map(|v| v.choice), Some(Choice::NoneOfThese));
}

#[tokio::test]
async fn retract_removes_vote() {
    let ddb = ddb_or_skip!("retract_removes_vote");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, None).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await
    .unwrap();
    vote::retract(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
    )
    .await
    .expect("retract");

    assert!(vote::get(&ddb.state, &prop.root_id, "u1")
        .await
        .unwrap()
        .is_none());
    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.tally.by_choice.get(&prop.id).copied().unwrap_or(0), 0);
    assert_eq!(got.tally.decisive(), 0);
}

#[tokio::test]
async fn voting_on_a_closed_deliberation_conflicts() {
    let ddb = ddb_or_skip!("voting_on_a_closed_deliberation_conflicts");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, None).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await
    .unwrap();

    // One pick, simple majority → passes.
    let closed = close_proposal::close(&ddb.state, "p1", &prop.id)
        .await
        .unwrap();
    assert!(closed);
    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.status.as_str(), "passed");

    // A late voter hits the closed guard.
    let late = vote::cast(
        &ddb.state,
        &user("u2"),
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await;
    assert!(matches!(late, Err(AppError::Conflict(_))), "got {late:?}");
}

#[tokio::test]
async fn close_with_only_none_rejects() {
    let ddb = ddb_or_skip!("close_with_only_none_rejects");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, None).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::NoneOfThese,
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, "p1", &prop.id)
        .await
        .unwrap();

    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.status.as_str(), "rejected");
}

#[tokio::test]
async fn close_below_quorum_fails_quorum() {
    let ddb = ddb_or_skip!("close_below_quorum_fails_quorum");
    let author = user("u1");
    let prop = new_proposal(&ddb, "p1", &author, VotingRule::SimpleMajority, Some(2)).await;

    vote::cast(
        &ddb.state,
        &author,
        "p1",
        &prop.root_id,
        Choice::Pick(prop.id.clone()),
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, "p1", &prop.id)
        .await
        .unwrap();

    let got = proposal::get(&ddb.state, "p1", &prop.id).await.unwrap();
    assert_eq!(got.status.as_str(), "quorum_failed");
}
