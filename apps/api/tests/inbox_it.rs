//! Integration tests for the inbox + notification fan-out (decision 0021)
//! against DynamoDB-Local.
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use chrono::{Duration, Utc};
use support::{docker_available, LocalDdb};
use voz_api::auth::AuthenticatedUser;
use voz_api::domain::comment::Body as CommentBody;
use voz_api::domain::proposal::ProposalKind;
use voz_api::domain::slug::Slug;
use voz_api::domain::vote::Choice;
use voz_api::domain::voting_rule::VotingRule;
use voz_api::notify;
use voz_api::repo::inbox::{self, InboxKind, NewInboxItem};
use voz_api::repo::{comment, project, proposal, vote};

const NOW: &str = "2026-05-31T00:00:00Z";

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

fn item(recipient: &str, preview: &str) -> NewInboxItem {
    NewInboxItem {
        recipient_id: recipient.to_string(),
        kind: InboxKind::Mention,
        project_id: "p".into(),
        project_slug: "p".into(),
        project_name: "P".into(),
        actor_id: "actor".into(),
        actor_display_name: Some("Actor".into()),
        proposal_id: None,
        comment_id: None,
        conversation_id: None,
        message_id: None,
        document_name: None,
        preview: preview.to_string(),
        created_at: NOW.to_string(),
    }
}

async fn make_project(ddb: &LocalDdb, slug: &str, owner: &AuthenticatedUser) -> project::Project {
    project::create(
        &ddb.state,
        owner,
        "Owner",
        "A Project".to_string(),
        Slug::parse(slug).unwrap(),
        "default".to_string(),
    )
    .await
    .expect("create project")
}

#[tokio::test]
async fn add_list_unread_and_mark_read() {
    let ddb = ddb_or_skip!("add_list_unread_and_mark_read");
    inbox::add_items(&ddb.state, vec![item("u1", "first"), item("u1", "second")])
        .await
        .unwrap();

    // Both land in the user's feed (intra-millisecond order is unspecified;
    // cross-event ordering is by the ulid time prefix).
    let items = inbox::list(&ddb.state, "u1", None, 50).await.unwrap();
    assert_eq!(items.len(), 2);
    let previews: Vec<&str> = items.iter().map(|i| i.preview.as_str()).collect();
    assert!(previews.contains(&"first") && previews.contains(&"second"));
    assert_eq!(inbox::unread_count(&ddb.state, "u1").await.unwrap(), 2);

    // Mark one read → unread drops; a missing id returns false.
    assert!(inbox::mark_read(&ddb.state, "u1", &items[0].id, NOW)
        .await
        .unwrap());
    assert_eq!(inbox::unread_count(&ddb.state, "u1").await.unwrap(), 1);
    assert!(!inbox::mark_read(&ddb.state, "u1", "nope", NOW).await.unwrap());

    // Mark all read → zero unread.
    inbox::mark_all_read(&ddb.state, "u1", NOW).await.unwrap();
    assert_eq!(inbox::unread_count(&ddb.state, "u1").await.unwrap(), 0);

    // Isolation — another user's inbox is empty.
    assert!(inbox::list(&ddb.state, "other", None, 50)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn comment_notifies_the_proposal_author() {
    let ddb = ddb_or_skip!("comment_notifies_the_proposal_author");
    let alice = user("alice");
    let p = make_project(&ddb, "alpha", &alice).await;
    let prop = proposal::create(
        &ddb.state,
        &p.id,
        &alice,
        "Title".to_string(),
        "Body".to_string(),
        VotingRule::SimpleMajority,
        None,
        Utc::now() + Duration::hours(1),
        "cat".to_string(),
        ProposalKind::Decision,
        None,
        false,
    )
    .await
    .unwrap();

    // Bob comments → Alice (author) gets a comment-on-yours.
    let bob = user("bob");
    let c = comment::create(
        &ddb.state,
        &prop.id,
        &bob,
        "Bob",
        CommentBody::parse("Nice idea".to_string()).unwrap(),
    )
    .await
    .unwrap();
    notify::proposal_comment(&ddb.state, &prop, &c, NOW)
        .await
        .unwrap();

    let alice_inbox = inbox::list(&ddb.state, "alice", None, 50).await.unwrap();
    assert_eq!(alice_inbox.len(), 1);
    assert_eq!(alice_inbox[0].kind, "comment-on-yours");
    assert_eq!(alice_inbox[0].proposal_id.as_deref(), Some(prop.id.as_str()));
    // Bob doesn't notify himself.
    assert!(inbox::list(&ddb.state, "bob", None, 50)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn close_notifies_decisive_voters_only() {
    let ddb = ddb_or_skip!("close_notifies_decisive_voters_only");
    let alice = user("alice");
    let p = make_project(&ddb, "beta", &alice).await;
    let prop = proposal::create(
        &ddb.state,
        &p.id,
        &alice,
        "Title".to_string(),
        "Body".to_string(),
        VotingRule::SimpleMajority,
        None,
        Utc::now() + Duration::hours(1),
        "cat".to_string(),
        ProposalKind::Decision,
        None,
        false,
    )
    .await
    .unwrap();

    // Alice + Bob pick it; Carol abstains.
    for u in [&alice, &user("bob")] {
        vote::cast(&ddb.state, u, &p.id, &prop.root_id, Choice::Pick(prop.id.clone()), None)
            .await
            .unwrap();
    }
    vote::cast(&ddb.state, &user("carol"), &p.id, &prop.root_id, Choice::Abstain, None)
        .await
        .unwrap();

    notify::deliberation_closed(&ddb.state, &prop, Some(&prop), NOW)
        .await
        .unwrap();

    assert_eq!(inbox::list(&ddb.state, "alice", None, 50).await.unwrap().len(), 1);
    assert_eq!(
        inbox::list(&ddb.state, "alice", None, 50).await.unwrap()[0].kind,
        "proposal-closed"
    );
    assert_eq!(inbox::list(&ddb.state, "bob", None, 50).await.unwrap().len(), 1);
    // Carol abstained → no notification.
    assert!(inbox::list(&ddb.state, "carol", None, 50)
        .await
        .unwrap()
        .is_empty());
}
