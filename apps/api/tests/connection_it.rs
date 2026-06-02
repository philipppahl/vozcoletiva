//! Integration tests for the WebSocket connection registry (0028) against
//! DynamoDB-Local.

#![cfg(feature = "test-support")]

mod support;

use support::{docker_available, LocalDdb};
use voz_api::repo::connection;

const NOW: &str = "2026-06-02T00:00:00Z";
const TTL: i64 = 1_780_000_000;

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
async fn add_list_owner_remove() {
    let ddb = ddb_or_skip!("add_list_owner_remove");

    // One user with two sockets, another with one.
    connection::add(&ddb.state, "conn-a", "u1", NOW, TTL)
        .await
        .unwrap();
    connection::add(&ddb.state, "conn-b", "u1", NOW, TTL)
        .await
        .unwrap();
    connection::add(&ddb.state, "conn-c", "u2", NOW, TTL)
        .await
        .unwrap();

    let mut u1 = connection::list_for_user(&ddb.state, "u1").await.unwrap();
    u1.sort();
    assert_eq!(u1, vec!["conn-a".to_string(), "conn-b".to_string()]);
    assert_eq!(
        connection::list_for_user(&ddb.state, "u2").await.unwrap(),
        vec!["conn-c"]
    );

    // Owner resolves both ways.
    assert_eq!(
        connection::owner(&ddb.state, "conn-a")
            .await
            .unwrap()
            .as_deref(),
        Some("u1")
    );
    assert_eq!(
        connection::owner(&ddb.state, "missing").await.unwrap(),
        None
    );

    // Disconnect removes both directional items (pointer + META).
    connection::remove(&ddb.state, "conn-a").await.unwrap();
    assert_eq!(
        connection::list_for_user(&ddb.state, "u1").await.unwrap(),
        vec!["conn-b"]
    );
    assert_eq!(connection::owner(&ddb.state, "conn-a").await.unwrap(), None);
}

#[tokio::test]
async fn remove_is_idempotent_and_pair_targeted() {
    let ddb = ddb_or_skip!("remove_is_idempotent_and_pair_targeted");

    // Removing an unknown connection is a no-op, not an error.
    connection::remove(&ddb.state, "ghost").await.unwrap();

    connection::add(&ddb.state, "conn-x", "u9", NOW, TTL)
        .await
        .unwrap();
    // The broadcaster prunes a 410-Gone connection by (conn, user) directly.
    connection::remove_pair(&ddb.state, "conn-x", "u9")
        .await
        .unwrap();
    assert!(connection::list_for_user(&ddb.state, "u9")
        .await
        .unwrap()
        .is_empty());
    assert_eq!(connection::owner(&ddb.state, "conn-x").await.unwrap(), None);
}
