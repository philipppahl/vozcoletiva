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
            vec![],
        )
        .await
        .unwrap();
        ids.push(m.id);
    }

    // The newest page (3 of 5), returned oldest-first: [m2, m3, m4].
    let (page, has_more) = message::list(&ddb.state, &conv, None, 3)
        .await
        .unwrap();
    assert_eq!(page.len(), 3);
    assert!(has_more);
    assert_eq!(
        page.iter().map(|m| m.id.clone()).collect::<Vec<_>>(),
        vec![ids[2].clone(), ids[3].clone(), ids[4].clone()]
    );

    // Older page via the `before` cursor (before m2): [m0, m1].
    let (page2, has_more2) = message::list(&ddb.state, &conv, Some(&ids[2]), 3)
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

    let parent = message::post(&ddb.state, &conv, "owner", "Owner", "topic", None, vec![])
        .await
        .unwrap();
    let snap = |id: &str| message::ReplyTo {
        id: id.to_string(),
        author_id: "owner".to_string(),
        author_display_name: "Owner".to_string(),
        preview: "topic".to_string(),
        kind: "text".to_string(),
    };
    let r1 = message::post(
        &ddb.state,
        &conv,
        "u2",
        "Bob",
        "reply 1",
        Some(snap(&parent.id)),
        vec![],
    )
    .await
    .unwrap();
    message::post(
        &ddb.state,
        &conv,
        "owner",
        "Owner",
        "reply 2",
        Some(snap(&parent.id)),
        vec![],
    )
    .await
    .unwrap();

    // Replies now show inline in the main list (decision 0031): parent + 2.
    let (top, _) = message::list(&ddb.state, &conv, None, 50).await.unwrap();
    assert_eq!(top.len(), 3);
    assert_eq!(top[0].id, parent.id);
    assert_eq!(top[0].reply_count, 2, "parent reply_count bumped");
    // The reply carries the quote snapshot pointing at the parent.
    assert_eq!(
        top[1].reply_to.as_ref().map(|r| r.id.as_str()),
        Some(parent.id.as_str())
    );

    // The focused thread view lists the parent's replies chronologically.
    let replies = message::thread_replies(&ddb.state, &conv, &parent.id)
        .await
        .unwrap();
    assert_eq!(replies.len(), 2);
    assert_eq!(replies.first().map(|m| m.id.clone()), Some(r1.id.clone()));

    // Any message — including a reply — resolves by id (you can reply to a reply).
    assert_eq!(
        message::message_by_id(&ddb.state, &r1.id).await.unwrap().id,
        r1.id
    );
    assert_eq!(
        message::message_by_id(&ddb.state, &parent.id)
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
            message::post(
                &ddb.state,
                &conv,
                "owner",
                "Owner",
                &format!("m{i}"),
                None,
                vec![],
            )
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
async fn last_message_is_the_newest_message() {
    let ddb = ddb_or_skip!("last_message_is_the_newest_message");
    let (_pid, conv) = project_with_channel(&ddb, "epsilon").await;
    assert!(message::last_message(&ddb.state, &conv)
        .await
        .unwrap()
        .is_none());

    message::post(&ddb.state, &conv, "owner", "Owner", "first", None, vec![])
        .await
        .unwrap();
    let second = message::post(&ddb.state, &conv, "owner", "Owner", "second", None, vec![])
        .await
        .unwrap();
    // A reply is an inline message (decision 0031) — it becomes the latest.
    let reply = message::post(
        &ddb.state,
        &conv,
        "owner",
        "Owner",
        "a reply",
        Some(message::ReplyTo {
            id: second.id.clone(),
            author_id: "owner".into(),
            author_display_name: "Owner".into(),
            preview: "second".into(),
            kind: "text".into(),
        }),
        vec![],
    )
    .await
    .unwrap();

    let last = message::last_message(&ddb.state, &conv)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(last.id, reply.id);
}
