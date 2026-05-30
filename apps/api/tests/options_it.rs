//! Integration tests for multi-option (isQuestion) decisions against
//! DynamoDB-Local: question root + option children, the question root being a
//! non-candidate at close, and outcome → question-root status.
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

/// A question root (`is_question = true`) + one option child per label.
async fn question(ddb: &LocalDdb, project: &str, labels: &[&str]) -> (Proposal, Vec<Proposal>) {
    let root = proposal::create(
        &ddb.state,
        project,
        &user("author"),
        "Which one?".to_string(),
        "Pick an option.".to_string(),
        VotingRule::Plurality,
        None,
        Utc::now() + Duration::hours(1),
        "cat-x".to_string(),
        ProposalKind::Decision,
        None,
        true,
    )
    .await
    .expect("create question root");

    let mut options = Vec::new();
    for label in labels {
        options.push(
            proposal::create_fork(
                &ddb.state,
                project,
                &user("author"),
                label.to_string(),
                String::new(),
                &root.id,
                &root,
            )
            .await
            .expect("create option"),
        );
    }
    (root, options)
}

async fn status(ddb: &LocalDdb, project: &str, id: &str) -> String {
    proposal::get(&ddb.state, project, id)
        .await
        .unwrap()
        .status
        .as_str()
        .to_string()
}

#[tokio::test]
async fn question_root_carries_options_as_children() {
    let ddb = ddb_or_skip!("question_root_carries_options_as_children");
    let (root, options) = question(&ddb, "p1", &["A", "B", "C"]).await;

    assert!(root.is_question);
    assert_eq!(options.len(), 3);
    for o in &options {
        assert_eq!(o.parent_id.as_deref(), Some(root.id.as_str()));
        assert!(o.body.is_empty());
        assert!(!o.is_question);
    }
    assert_eq!(proposal::tree(&ddb.state, &root.id).await.unwrap().len(), 4);
}

#[tokio::test]
async fn close_passes_the_winning_option_and_the_question_root() {
    let ddb = ddb_or_skip!("close_passes_the_winning_option_and_the_question_root");
    let (root, options) = question(&ddb, "p1", &["A", "B"]).await;

    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &root.id,
        Choice::Pick(options[0].id.clone()),
        None,
    )
    .await
    .unwrap();
    assert!(close_proposal::close(&ddb.state, "p1", &root.id)
        .await
        .unwrap());

    assert_eq!(status(&ddb, "p1", &options[0].id).await, "passed");
    assert_eq!(status(&ddb, "p1", &options[1].id).await, "rejected");
    assert_eq!(status(&ddb, "p1", &root.id).await, "passed");
}

#[tokio::test]
async fn close_with_no_winner_rejects_the_question_root() {
    let ddb = ddb_or_skip!("close_with_no_winner_rejects_the_question_root");
    let (root, options) = question(&ddb, "p1", &["A", "B"]).await;

    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &root.id,
        Choice::NoneOfThese,
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, "p1", &root.id)
        .await
        .unwrap();

    assert_eq!(status(&ddb, "p1", &root.id).await, "rejected");
    assert_eq!(status(&ddb, "p1", &options[0].id).await, "rejected");
    assert_eq!(status(&ddb, "p1", &options[1].id).await, "rejected");
}

#[tokio::test]
async fn a_pick_of_the_question_root_is_excluded_from_candidates() {
    let ddb = ddb_or_skip!("a_pick_of_the_question_root_is_excluded_from_candidates");
    let (root, options) = question(&ddb, "p1", &["A", "B"]).await;

    // u1 picks the question root itself (the handler would reject this; at the
    // repo level it lands in the tally) — it must NOT count as a candidate.
    vote::cast(
        &ddb.state,
        &user("u1"),
        "p1",
        &root.id,
        Choice::Pick(root.id.clone()),
        None,
    )
    .await
    .unwrap();
    // u2 picks option A.
    vote::cast(
        &ddb.state,
        &user("u2"),
        "p1",
        &root.id,
        Choice::Pick(options[0].id.clone()),
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, "p1", &root.id)
        .await
        .unwrap();

    // A wins despite the root also having one (excluded) pick.
    assert_eq!(status(&ddb, "p1", &options[0].id).await, "passed");
    assert_eq!(status(&ddb, "p1", &options[1].id).await, "rejected");
    assert_eq!(status(&ddb, "p1", &root.id).await, "passed");
}
