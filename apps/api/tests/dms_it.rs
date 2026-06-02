//! Integration tests for direct messages (user-pair conversations) against
//! DynamoDB-Local. DMs reuse slice-E's message/read machinery (decision 0020).
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use support::{docker_available, LocalDdb};
use voz_api::repo::conversation::{self, ConversationMeta};
use voz_api::repo::message;

const NOW: &str = "2026-05-31T00:00:00Z";

macro_rules! ddb_or_skip {
    ($name:literal) => {{
        if !docker_available() {
            eprintln!("skipping {} — Docker not available", $name);
            return;
        }
        LocalDdb::start().await
    }};
}

#[tokio::test]
async fn create_or_get_is_idempotent_per_pair() {
    let ddb = ddb_or_skip!("create_or_get_is_idempotent_per_pair");

    let a = conversation::create_or_get_dm(&ddb.state, "alice", "bob", NOW)
        .await
        .unwrap();
    // Same pair, reversed order → same conversation.
    let b = conversation::create_or_get_dm(&ddb.state, "bob", "alice", NOW)
        .await
        .unwrap();
    assert_eq!(a.id, b.id, "same pair resolves to the same conversation");
    assert_eq!(a.participant_ids, ["alice".to_string(), "bob".to_string()]);

    // A different pair → a different conversation.
    let c = conversation::create_or_get_dm(&ddb.state, "alice", "carol", NOW)
        .await
        .unwrap();
    assert_ne!(a.id, c.id);
}

#[tokio::test]
async fn list_dms_returns_the_dm_for_both_participants_only() {
    let ddb = ddb_or_skip!("list_dms_returns_the_dm_for_both_participants_only");
    let dm = conversation::create_or_get_dm(&ddb.state, "alice", "bob", NOW)
        .await
        .unwrap();

    let alice = conversation::list_dms(&ddb.state, "alice").await.unwrap();
    assert_eq!(alice.len(), 1);
    assert_eq!(alice[0].conversation_id, dm.id);
    assert_eq!(alice[0].peer_id, "bob");

    let bob = conversation::list_dms(&ddb.state, "bob").await.unwrap();
    assert_eq!(bob.len(), 1);
    assert_eq!(bob[0].peer_id, "alice");

    // A non-participant sees nothing.
    let carol = conversation::list_dms(&ddb.state, "carol").await.unwrap();
    assert!(carol.is_empty());
}

#[tokio::test]
async fn get_meta_resolves_a_dm_with_its_participants() {
    let ddb = ddb_or_skip!("get_meta_resolves_a_dm_with_its_participants");
    let dm = conversation::create_or_get_dm(&ddb.state, "bob", "alice", NOW)
        .await
        .unwrap();
    match conversation::get_meta(&ddb.state, &dm.id).await.unwrap() {
        ConversationMeta::Dm(d) => {
            assert_eq!(d.participant_ids, ["alice".to_string(), "bob".to_string()]);
        }
        ConversationMeta::Channel(_) => panic!("expected a DM"),
    }
}

#[tokio::test]
async fn messages_work_in_a_dm_via_the_shared_repo() {
    let ddb = ddb_or_skip!("messages_work_in_a_dm_via_the_shared_repo");
    let dm = conversation::create_or_get_dm(&ddb.state, "alice", "bob", NOW)
        .await
        .unwrap();

    message::post(&ddb.state, &dm.id, "alice", "Alice", "hi bob", None, vec![])
        .await
        .unwrap();
    let m2 = message::post(&ddb.state, &dm.id, "bob", "Bob", "hey alice", None, vec![])
        .await
        .unwrap();

    let (page, has_more) = message::list_top_level(&ddb.state, &dm.id, None, 50)
        .await
        .unwrap();
    assert_eq!(page.len(), 2);
    assert!(!has_more);
    // Oldest-first display order; the newest is last.
    assert_eq!(page.last().unwrap().id, m2.id);

    // Read marker → unread count, reusing the conversation read machinery.
    assert_eq!(
        message::unread_count(&ddb.state, &dm.id, None)
            .await
            .unwrap(),
        2
    );
    conversation::set_conversation_read(&ddb.state, "alice", &dm.id, &m2.id, NOW)
        .await
        .unwrap();
    let marker = conversation::conversation_read(&ddb.state, "alice", &dm.id)
        .await
        .unwrap();
    assert_eq!(
        message::unread_count(&ddb.state, &dm.id, marker.as_deref())
            .await
            .unwrap(),
        0
    );
}
