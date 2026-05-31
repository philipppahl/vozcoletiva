//! Integration tests for project messaging (channels + messages + threads +
//! read markers) against DynamoDB-Local.
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use support::{docker_available, LocalDdb};
use voz_api::auth::AuthenticatedUser;
use voz_api::domain::slug::Slug;
use voz_api::error::AppError;
use voz_api::repo::{conversation, message, project};

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

/// Create a project and return (project_id, default channel id).
async fn project_with_channel(ddb: &LocalDdb, slug: &str) -> (String, String) {
    let p = project::create(
        &ddb.state,
        &user("owner"),
        "Owner",
        "A Project".to_string(),
        Slug::parse(slug).unwrap(),
        "default".to_string(),
    )
    .await
    .expect("create project");
    let channels = conversation::list_channels(&ddb.state, &p.id)
        .await
        .unwrap();
    assert_eq!(channels.len(), 1);
    (p.id, channels[0].id.clone())
}

#[tokio::test]
async fn project_create_makes_a_default_commons_channel() {
    let ddb = ddb_or_skip!("project_create_makes_a_default_commons_channel");
    let p = project::create(
        &ddb.state,
        &user("owner"),
        "Owner",
        "A Project".to_string(),
        Slug::parse("alpha").unwrap(),
        "default".to_string(),
    )
    .await
    .unwrap();
    let channels = conversation::list_channels(&ddb.state, &p.id)
        .await
        .unwrap();
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].name, "Commons");
}

#[tokio::test]
async fn post_list_and_paginate_top_level_messages() {
    let ddb = ddb_or_skip!("post_list_and_paginate_top_level_messages");
    let (_pid, conv) = project_with_channel(&ddb, "beta").await;

    let mut ids = Vec::new();
    for i in 0..5 {
        let m = message::post(
            &ddb.state,
            &conv,
            "owner",
            "Owner",
            &format!("msg {i}"),
            None,
        )
        .await
        .unwrap();
        ids.push(m.id);
    }

    // The newest page (3 of 5), returned oldest-first: [m2, m3, m4].
    let (page, has_more) = message::list_top_level(&ddb.state, &conv, None, 3)
        .await
        .unwrap();
    assert_eq!(page.len(), 3);
    assert!(has_more);
    assert_eq!(
        page.iter().map(|m| m.id.clone()).collect::<Vec<_>>(),
        vec![ids[2].clone(), ids[3].clone(), ids[4].clone()]
    );

    // Older page via the `before` cursor (before m2): [m0, m1].
    let (page2, has_more2) = message::list_top_level(&ddb.state, &conv, Some(&ids[2]), 3)
        .await
        .unwrap();
    assert_eq!(
        page2.iter().map(|m| m.id.clone()).collect::<Vec<_>>(),
        vec![ids[0].clone(), ids[1].clone()]
    );
    assert!(!has_more2);
}

#[tokio::test]
async fn replies_form_a_thread_and_bump_the_parent() {
    let ddb = ddb_or_skip!("replies_form_a_thread_and_bump_the_parent");
    let (_pid, conv) = project_with_channel(&ddb, "gamma").await;

    let parent = message::post(&ddb.state, &conv, "owner", "Owner", "topic", None)
        .await
        .unwrap();
    let r1 = message::post(&ddb.state, &conv, "u2", "Bob", "reply 1", Some(&parent.id))
        .await
        .unwrap();
    message::post(
        &ddb.state,
        &conv,
        "owner",
        "Owner",
        "reply 2",
        Some(&parent.id),
    )
    .await
    .unwrap();

    // Replies don't show in the top-level list.
    let (top, _) = message::list_top_level(&ddb.state, &conv, None, 50)
        .await
        .unwrap();
    assert_eq!(top.len(), 1);
    assert_eq!(top[0].id, parent.id);
    assert_eq!(top[0].reply_count, 2, "parent reply_count bumped");

    // The thread lists replies chronologically.
    let replies = message::thread_replies(&ddb.state, &parent.id)
        .await
        .unwrap();
    assert_eq!(
        replies
            .iter()
            .map(|m| m.id.clone())
            .collect::<Vec<_>>()
            .first(),
        Some(&r1.id)
    );
    assert_eq!(replies.len(), 2);

    // A reply is not resolvable as a top-level message (so the handler rejects
    // replying to a reply).
    assert!(matches!(
        message::top_level_by_id(&ddb.state, &r1.id).await,
        Err(AppError::NotFound)
    ));
    // The parent resolves by id alone.
    assert_eq!(
        message::top_level_by_id(&ddb.state, &parent.id)
            .await
            .unwrap()
            .id,
        parent.id
    );
}

#[tokio::test]
async fn read_marker_drives_unread_count() {
    let ddb = ddb_or_skip!("read_marker_drives_unread_count");
    let (_pid, conv) = project_with_channel(&ddb, "delta").await;

    let mut ids = Vec::new();
    for i in 0..3 {
        ids.push(
            message::post(&ddb.state, &conv, "owner", "Owner", &format!("m{i}"), None)
                .await
                .unwrap()
                .id,
        );
    }

    // No marker → everything is unread.
    assert_eq!(
        message::unread_count(&ddb.state, &conv, None)
            .await
            .unwrap(),
        3
    );

    // Read up to the 2nd message → only the newest remains unread.
    conversation::set_conversation_read(
        &ddb.state,
        "owner",
        &conv,
        &ids[1],
        "2026-05-31T00:00:00Z",
    )
    .await
    .unwrap();
    let marker = conversation::conversation_read(&ddb.state, "owner", &conv)
        .await
        .unwrap();
    assert_eq!(marker.as_deref(), Some(ids[1].as_str()));
    assert_eq!(
        message::unread_count(&ddb.state, &conv, marker.as_deref())
            .await
            .unwrap(),
        1
    );

    // Read up to the newest → zero unread.
    conversation::set_conversation_read(
        &ddb.state,
        "owner",
        &conv,
        &ids[2],
        "2026-05-31T00:01:00Z",
    )
    .await
    .unwrap();
    let marker = conversation::conversation_read(&ddb.state, "owner", &conv)
        .await
        .unwrap();
    assert_eq!(
        message::unread_count(&ddb.state, &conv, marker.as_deref())
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn last_message_is_the_newest_top_level() {
    let ddb = ddb_or_skip!("last_message_is_the_newest_top_level");
    let (_pid, conv) = project_with_channel(&ddb, "epsilon").await;
    assert!(message::last_message(&ddb.state, &conv)
        .await
        .unwrap()
        .is_none());

    message::post(&ddb.state, &conv, "owner", "Owner", "first", None)
        .await
        .unwrap();
    let second = message::post(&ddb.state, &conv, "owner", "Owner", "second", None)
        .await
        .unwrap();
    // A reply must not become the "last message".
    message::post(
        &ddb.state,
        &conv,
        "owner",
        "Owner",
        "a reply",
        Some(&second.id),
    )
    .await
    .unwrap();

    let last = message::last_message(&ddb.state, &conv)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(last.id, second.id);
}
