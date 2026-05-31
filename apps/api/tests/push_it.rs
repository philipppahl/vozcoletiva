//! Integration tests for push subscriptions + notification prefs (0025)
//! against DynamoDB-Local.

#![cfg(feature = "test-support")]

mod support;

use support::{docker_available, LocalDdb};
use voz_api::repo::push::{self, NotificationPrefs};

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
async fn subscriptions_add_list_delete() {
    let ddb = ddb_or_skip!("subscriptions_add_list_delete");
    push::add_subscription(&ddb.state, "u1", "https://fcm/abc", "p256", "auth", Some("UA"), NOW)
        .await
        .unwrap();
    // Re-subscribing the same endpoint upserts (still one).
    push::add_subscription(&ddb.state, "u1", "https://fcm/abc", "p256b", "authb", None, NOW)
        .await
        .unwrap();
    push::add_subscription(&ddb.state, "u1", "https://fcm/xyz", "p2", "a2", None, NOW)
        .await
        .unwrap();

    let subs = push::list_subscriptions(&ddb.state, "u1").await.unwrap();
    assert_eq!(subs.len(), 2);

    push::delete_subscription(&ddb.state, "u1", "https://fcm/abc")
        .await
        .unwrap();
    let subs = push::list_subscriptions(&ddb.state, "u1").await.unwrap();
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].endpoint, "https://fcm/xyz");
}

#[tokio::test]
async fn prefs_default_then_roundtrip() {
    let ddb = ddb_or_skip!("prefs_default_then_roundtrip");
    // Default: everything on.
    let prefs = push::get_prefs(&ddb.state, "u2").await.unwrap();
    assert!(prefs.push_enabled && prefs.mention && prefs.document_amended);
    assert!(prefs.allows("mention"));

    // Toggle: master on, but mute proposal-closed + document-amended.
    let next = NotificationPrefs {
        push_enabled: true,
        mention: true,
        reply: true,
        comment_on_yours: true,
        proposal_closed: false,
        document_amended: false,
    };
    push::put_prefs(&ddb.state, "u2", &next).await.unwrap();
    let got = push::get_prefs(&ddb.state, "u2").await.unwrap();
    assert!(got.allows("mention"));
    assert!(!got.allows("proposal-closed"));
    assert!(!got.allows("document-amended"));

    // Master off mutes everything.
    let off = NotificationPrefs {
        push_enabled: false,
        ..NotificationPrefs::default()
    };
    push::put_prefs(&ddb.state, "u2", &off).await.unwrap();
    assert!(!push::get_prefs(&ddb.state, "u2").await.unwrap().allows("mention"));
}
