//! DynamoDB-Local harness for repo/job integration tests.
//!
//! Spins up one `amazon/dynamodb-local` container per test, creates the single
//! table (PK/SK + GSI1/2/3), and tears the container down on drop. Requires a
//! running Docker daemon; tests that can't reach Docker should skip via
//! [`docker_available`].

#![cfg(feature = "test-support")]

use std::net::TcpListener;
use std::process::Command;
use std::time::Duration;

use aws_sdk_dynamodb::config::{BehaviorVersion, Credentials, Region};
use aws_sdk_dynamodb::types::{
    AttributeDefinition, BillingMode, GlobalSecondaryIndex, KeySchemaElement, KeyType, Projection,
    ProjectionType, ScalarAttributeType,
};
use aws_sdk_dynamodb::Client;
use voz_api::state::AppState;

/// True if a Docker daemon is reachable. Integration tests early-return when
/// false so the suite degrades gracefully off-CI.
pub fn docker_available() -> bool {
    Command::new("docker")
        .arg("info")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    port
}

pub struct LocalDdb {
    container: String,
    pub state: AppState,
}

impl LocalDdb {
    /// Start a container, wait for readiness, and create the table. Panics on
    /// any setup failure (the caller should gate on [`docker_available`]).
    pub async fn start() -> Self {
        let port = free_port();
        let container = format!("voz-ddb-test-{port}");

        let run = Command::new("docker")
            .args([
                "run",
                "-d",
                "--rm",
                "-p",
                &format!("{port}:8000"),
                "--name",
                &container,
                "amazon/dynamodb-local",
            ])
            .output()
            .expect("docker run");
        assert!(
            run.status.success(),
            "docker run failed: {}",
            String::from_utf8_lossy(&run.stderr)
        );

        let conf = aws_sdk_dynamodb::config::Builder::default()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("eu-west-1"))
            .endpoint_url(format!("http://127.0.0.1:{port}"))
            .credentials_provider(Credentials::new("AKIDTEST", "SECRET", None, None, "test"))
            .build();
        let client = Client::from_conf(conf);

        // Wait for the container to accept connections.
        let mut ready = false;
        for _ in 0..60 {
            if client.list_tables().send().await.is_ok() {
                ready = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        assert!(ready, "dynamodb-local did not become ready");

        let table_name = "vozcoletiva-test".to_string();
        create_table(&client, &table_name).await;

        Self {
            container,
            state: AppState::for_test(client, table_name),
        }
    }
}

impl Drop for LocalDdb {
    fn drop(&mut self) {
        let _ = Command::new("docker")
            .args(["rm", "-f", &self.container])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

fn attr(name: &str) -> AttributeDefinition {
    AttributeDefinition::builder()
        .attribute_name(name)
        .attribute_type(ScalarAttributeType::S)
        .build()
        .unwrap()
}

fn key(name: &str, kt: KeyType) -> KeySchemaElement {
    KeySchemaElement::builder()
        .attribute_name(name)
        .key_type(kt)
        .build()
        .unwrap()
}

fn gsi(n: u8) -> GlobalSecondaryIndex {
    GlobalSecondaryIndex::builder()
        .index_name(format!("GSI{n}"))
        .key_schema(key(&format!("GSI{n}PK"), KeyType::Hash))
        .key_schema(key(&format!("GSI{n}SK"), KeyType::Range))
        .projection(
            Projection::builder()
                .projection_type(ProjectionType::All)
                .build(),
        )
        .build()
        .unwrap()
}

async fn create_table(client: &Client, name: &str) {
    client
        .create_table()
        .table_name(name)
        .billing_mode(BillingMode::PayPerRequest)
        .attribute_definitions(attr("PK"))
        .attribute_definitions(attr("SK"))
        .attribute_definitions(attr("GSI1PK"))
        .attribute_definitions(attr("GSI1SK"))
        .attribute_definitions(attr("GSI2PK"))
        .attribute_definitions(attr("GSI2SK"))
        .attribute_definitions(attr("GSI3PK"))
        .attribute_definitions(attr("GSI3SK"))
        .key_schema(key("PK", KeyType::Hash))
        .key_schema(key("SK", KeyType::Range))
        .global_secondary_indexes(gsi(1))
        .global_secondary_indexes(gsi(2))
        .global_secondary_indexes(gsi(3))
        .send()
        .await
        .expect("create_table");
}
