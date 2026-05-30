//! Integration tests for documents (derived over Document-kind proposals)
//! against DynamoDB-Local: close-time indexing of passed versions, amendments
//! becoming the current version, and the active/derivation queries.
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
use voz_api::repo::{document, proposal, vote};

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

async fn doc_root(ddb: &LocalDdb, project: &str, name: &str) -> Proposal {
    proposal::create(
        &ddb.state,
        project,
        &user("author"),
        name.to_string(),
        "Text.".to_string(),
        VotingRule::SimpleMajority,
        None,
        Utc::now() + Duration::hours(1),
        "cat-x".to_string(),
        ProposalKind::Document,
        Some(name.to_string()),
        false,
    )
    .await
    .expect("create document root")
}

async fn decision_root(ddb: &LocalDdb, project: &str) -> Proposal {
    proposal::create(
        &ddb.state,
        project,
        &user("author"),
        "A decision".to_string(),
        "Body.".to_string(),
        VotingRule::SimpleMajority,
        None,
        Utc::now() + Duration::hours(1),
        "cat-x".to_string(),
        ProposalKind::Decision,
        None,
        false,
    )
    .await
    .expect("create decision root")
}

/// One yes-pick on the root, then close — passes a simple-majority root.
async fn pass(ddb: &LocalDdb, project: &str, root: &Proposal) {
    vote::cast(
        &ddb.state,
        &user("voter"),
        project,
        &root.id,
        Choice::Pick(root.id.clone()),
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, project, &root.id)
        .await
        .unwrap();
}

#[tokio::test]
async fn passed_document_is_indexed_as_a_version() {
    let ddb = ddb_or_skip!("passed_document_is_indexed_as_a_version");
    let r = doc_root(&ddb, "p1", "House Rules").await;

    // Voting → not yet a version.
    assert!(document::passed_versions(&ddb.state, "p1")
        .await
        .unwrap()
        .is_empty());

    pass(&ddb, "p1", &r).await;

    let versions = document::versions_for_name(&ddb.state, "p1", "House Rules")
        .await
        .unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].id, r.id);
    assert!(document::active_for_name(&ddb.state, "p1", "House Rules")
        .await
        .unwrap()
        .is_none());
    assert_eq!(
        document::passed_versions(&ddb.state, "p1")
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn amendment_adds_a_version_and_becomes_current() {
    let ddb = ddb_or_skip!("amendment_adds_a_version_and_becomes_current");
    let v1 = doc_root(&ddb, "p1", "Charter").await;
    pass(&ddb, "p1", &v1).await;

    // A second deliberation for the same document — the amendment.
    let v2 = doc_root(&ddb, "p1", "Charter").await;
    assert!(document::active_for_name(&ddb.state, "p1", "Charter")
        .await
        .unwrap()
        .is_some());
    assert_eq!(
        document::versions_for_name(&ddb.state, "p1", "Charter")
            .await
            .unwrap()
            .len(),
        1,
        "amendment not yet passed"
    );

    pass(&ddb, "p1", &v2).await;
    let versions = document::versions_for_name(&ddb.state, "p1", "Charter")
        .await
        .unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0].id, v2.id, "newest version is current");
}

#[tokio::test]
async fn active_doc_roots_excludes_decisions_and_passed() {
    let ddb = ddb_or_skip!("active_doc_roots_excludes_decisions_and_passed");
    let active = doc_root(&ddb, "p1", "Active").await;
    decision_root(&ddb, "p1").await; // voting, but a decision
    let done = doc_root(&ddb, "p1", "Done").await;
    pass(&ddb, "p1", &done).await; // passed doc, no longer active

    let roots = document::active_doc_roots(&ddb.state, "p1").await.unwrap();
    assert_eq!(roots.len(), 1);
    assert_eq!(roots[0].id, active.id);
}

#[tokio::test]
async fn rejected_document_is_not_indexed() {
    let ddb = ddb_or_skip!("rejected_document_is_not_indexed");
    let r = doc_root(&ddb, "p1", "Rejected Doc").await;

    vote::cast(
        &ddb.state,
        &user("v"),
        "p1",
        &r.id,
        Choice::NoneOfThese,
        None,
    )
    .await
    .unwrap();
    close_proposal::close(&ddb.state, "p1", &r.id)
        .await
        .unwrap();

    assert_eq!(
        proposal::get(&ddb.state, "p1", &r.id)
            .await
            .unwrap()
            .status
            .as_str(),
        "rejected"
    );
    assert!(document::passed_versions(&ddb.state, "p1")
        .await
        .unwrap()
        .is_empty());
    assert!(
        document::versions_for_name(&ddb.state, "p1", "Rejected Doc")
            .await
            .unwrap()
            .is_empty()
    );
}
