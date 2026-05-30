//! Integration tests for categories (topics) against DynamoDB-Local: the
//! default-on-create, CRUD building blocks, the delete-guard inputs, and
//! category wiring through proposals.
//!
//! Run with: `cargo test -p voz-api --features test-support`
//! Requires a running Docker daemon (tests skip gracefully otherwise).

#![cfg(feature = "test-support")]

mod support;

use chrono::{Duration, Utc};
use support::{docker_available, LocalDdb};
use voz_api::auth::AuthenticatedUser;
use voz_api::domain::proposal::ProposalKind;
use voz_api::domain::slug::Slug;
use voz_api::domain::voting_rule::VotingRule;
use voz_api::repo::{category, project, proposal};

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

/// Create a project and return its id.
async fn make_project(ddb: &LocalDdb, slug: &str) -> String {
    project::create(
        &ddb.state,
        &user("owner"),
        "Owner",
        "A Project".to_string(),
        Slug::parse(slug).unwrap(),
        "default".to_string(),
    )
    .await
    .expect("create project")
    .id
}

#[tokio::test]
async fn project_create_makes_default_commons() {
    let ddb = ddb_or_skip!("project_create_makes_default_commons");
    let pid = make_project(&ddb, "alpha").await;

    let cats = category::list_for_project(&ddb.state, &pid).await.unwrap();
    assert_eq!(cats.len(), 1);
    assert_eq!(cats[0].name, "Commons");
    assert_eq!(cats[0].position, 0);

    let default = category::default_for(&ddb.state, &pid).await.unwrap();
    assert_eq!(default.id, cats[0].id);
}

#[tokio::test]
async fn create_list_and_rename() {
    let ddb = ddb_or_skip!("create_list_and_rename");
    let pid = make_project(&ddb, "beta").await;

    let a = category::create(&ddb.state, &pid, "Housing", 1)
        .await
        .unwrap();
    category::create(&ddb.state, &pid, "Transport", 2)
        .await
        .unwrap();

    let cats = category::list_for_project(&ddb.state, &pid).await.unwrap();
    assert_eq!(
        cats.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(),
        vec!["Commons", "Housing", "Transport"]
    );

    category::rename(&ddb.state, &pid, &a.id, "Homes")
        .await
        .unwrap();
    let renamed = category::get(&ddb.state, &pid, &a.id).await.unwrap();
    assert_eq!(renamed.name, "Homes");
}

#[tokio::test]
async fn count_referencing_drives_the_delete_guard() {
    let ddb = ddb_or_skip!("count_referencing_drives_the_delete_guard");
    let pid = make_project(&ddb, "gamma").await;
    let used = category::create(&ddb.state, &pid, "Used", 1).await.unwrap();
    let empty = category::create(&ddb.state, &pid, "Empty", 2)
        .await
        .unwrap();

    // A proposal in `used`.
    proposal::create(
        &ddb.state,
        &pid,
        &user("owner"),
        "Q".to_string(),
        "Body.".to_string(),
        VotingRule::SimpleMajority,
        None,
        Utc::now() + Duration::hours(1),
        used.id.clone(),
        ProposalKind::Decision,
        None,
    )
    .await
    .unwrap();

    assert_eq!(
        category::count_referencing(&ddb.state, &pid, &used.id)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        category::count_referencing(&ddb.state, &pid, &empty.id)
            .await
            .unwrap(),
        0
    );

    // The empty one is removable.
    category::delete(&ddb.state, &pid, &empty.id).await.unwrap();
    let names: Vec<String> = category::list_for_project(&ddb.state, &pid)
        .await
        .unwrap()
        .into_iter()
        .map(|c| c.name)
        .collect();
    assert!(!names.contains(&"Empty".to_string()));
    assert!(names.contains(&"Used".to_string()));
}

#[tokio::test]
async fn proposal_and_fork_carry_the_category() {
    let ddb = ddb_or_skip!("proposal_and_fork_carry_the_category");
    let pid = make_project(&ddb, "delta").await;
    let cat = category::create(&ddb.state, &pid, "Budget", 1)
        .await
        .unwrap();

    let r = proposal::create(
        &ddb.state,
        &pid,
        &user("owner"),
        "Root".to_string(),
        "Body.".to_string(),
        VotingRule::Plurality,
        None,
        Utc::now() + Duration::hours(1),
        cat.id.clone(),
        ProposalKind::Decision,
        None,
    )
    .await
    .unwrap();
    assert_eq!(r.category_id, cat.id);

    let f = proposal::create_fork(
        &ddb.state,
        &pid,
        &user("forker"),
        "Alt".to_string(),
        "Alt body.".to_string(),
        &r.id,
        &r,
    )
    .await
    .unwrap();
    assert_eq!(f.category_id, cat.id, "fork inherits the root's category");
}
