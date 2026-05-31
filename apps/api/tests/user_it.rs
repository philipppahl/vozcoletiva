//! Integration tests for the user profile / display name (decision 0019)
//! against DynamoDB-Local.
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use support::{docker_available, LocalDdb};
use voz_api::repo::user;

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
async fn upsert_creates_then_updates_the_display_name() {
    let ddb = ddb_or_skip!("upsert_creates_then_updates_the_display_name");
    let uid = "user-abc";

    // No profile yet → upsert creates it with the given name + defaults.
    let created = user::upsert_display_name(&ddb.state, uid, "Marina Alves")
        .await
        .unwrap();
    assert_eq!(created.display_name, "Marina Alves");
    assert_eq!(created.locale, "en");
    assert_eq!(created.theme, "system");

    // A second upsert updates the name in place…
    let updated = user::upsert_display_name(&ddb.state, uid, "Marina A.")
        .await
        .unwrap();
    assert_eq!(updated.display_name, "Marina A.");
    // …and preserves createdAt (no churn on edit).
    assert_eq!(updated.created_at, created.created_at);
}

#[tokio::test]
async fn get_or_create_after_upsert_returns_the_real_name() {
    let ddb = ddb_or_skip!("get_or_create_after_upsert_returns_the_real_name");
    let uid = "user-xyz";

    // Bootstrap the name, then a later get_or_create (the path memberships use
    // via display_name_for) must return the real name, not the fallback id.
    user::upsert_display_name(&ddb.state, uid, "Tomás Ferreira")
        .await
        .unwrap();
    let profile = user::get_or_create_profile(&ddb.state, uid, uid)
        .await
        .unwrap();
    assert_eq!(profile.display_name, "Tomás Ferreira");
}
