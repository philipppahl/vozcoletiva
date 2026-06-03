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

#[tokio::test]
async fn set_handle_claims_and_resolves() {
    let ddb = ddb_or_skip!("set_handle_claims_and_resolves");
    let uid = "user-handle-1";

    // No handle yet.
    assert!(user::user_by_handle(&ddb.state, "marina").await.unwrap().is_none());

    // Claiming bootstraps the profile shell + the HANDLE# sentinel.
    user::set_handle(&ddb.state, uid, "marina").await.unwrap();
    assert_eq!(
        user::user_by_handle(&ddb.state, "marina").await.unwrap().as_deref(),
        Some(uid)
    );
    let profile = user::get_profile(&ddb.state, uid).await.unwrap().unwrap();
    assert_eq!(profile.handle.as_deref(), Some("marina"));
}

#[tokio::test]
async fn set_handle_rejects_a_taken_handle() {
    let ddb = ddb_or_skip!("set_handle_rejects_a_taken_handle");
    user::set_handle(&ddb.state, "owner", "tomas").await.unwrap();

    // A different user claiming the same handle is a 409 conflict.
    let err = user::set_handle(&ddb.state, "intruder", "tomas").await.unwrap_err();
    assert!(matches!(err, voz_api::error::AppError::Conflict(_)), "got {err:?}");
    // The original owner still holds it.
    assert_eq!(
        user::user_by_handle(&ddb.state, "tomas").await.unwrap().as_deref(),
        Some("owner")
    );
}

#[tokio::test]
async fn change_handle_releases_the_old_one() {
    let ddb = ddb_or_skip!("change_handle_releases_the_old_one");
    let uid = "user-handle-2";

    user::set_handle(&ddb.state, uid, "first").await.unwrap();
    user::set_handle(&ddb.state, uid, "second").await.unwrap();

    // Old handle freed, new one points at the user, profile reflects the new one.
    assert!(user::user_by_handle(&ddb.state, "first").await.unwrap().is_none());
    assert_eq!(
        user::user_by_handle(&ddb.state, "second").await.unwrap().as_deref(),
        Some(uid)
    );
    let profile = user::get_profile(&ddb.state, uid).await.unwrap().unwrap();
    assert_eq!(profile.handle.as_deref(), Some("second"));

    // After release, the old handle can be claimed by someone else.
    user::set_handle(&ddb.state, "newcomer", "first").await.unwrap();
    assert_eq!(
        user::user_by_handle(&ddb.state, "first").await.unwrap().as_deref(),
        Some("newcomer")
    );
}

#[tokio::test]
async fn set_handle_is_idempotent_for_the_same_owner() {
    let ddb = ddb_or_skip!("set_handle_is_idempotent_for_the_same_owner");
    let uid = "user-handle-3";

    user::set_handle(&ddb.state, uid, "stable").await.unwrap();
    // Re-claiming your own current handle is a no-op (not a conflict).
    user::set_handle(&ddb.state, uid, "stable").await.unwrap();
    assert_eq!(
        user::user_by_handle(&ddb.state, "stable").await.unwrap().as_deref(),
        Some(uid)
    );
}

#[tokio::test]
async fn profile_refs_returns_handle_and_avatar() {
    let ddb = ddb_or_skip!("profile_refs_returns_handle_and_avatar");
    let uid = "user-handle-4";
    user::upsert_display_name(&ddb.state, uid, "Marina").await.unwrap();
    user::set_handle(&ddb.state, uid, "marina2").await.unwrap();

    let refs = user::profile_refs(&ddb.state, &[uid.to_string()]).await.unwrap();
    let r = refs.get(uid).expect("ref present");
    assert_eq!(r.handle.as_deref(), Some("marina2"));
    assert!(r.avatar_key.is_none());
}
