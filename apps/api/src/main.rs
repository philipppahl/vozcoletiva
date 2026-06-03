use lambda_http::{run, service_fn, tracing as lambda_tracing, Error, Request, Response};

use voz_api::handlers;
use voz_api::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();

    let app_state = AppState::from_env()
        .await
        .map_err(|e| Error::from(format!("app state init failed: {e}")))?;

    run(service_fn(move |req: Request| {
        let state = app_state.clone();
        async move { route(state, req).await }
    }))
    .await
}

async fn route(state: AppState, event: Request) -> Result<Response<lambda_http::Body>, Error> {
    let raw_path = event.uri().path().to_string();
    let method = event.method().clone();
    // API Gateway may include the stage prefix in the forwarded path
    // ("/v1/hello") or strip it ("/hello") depending on the integration shape.
    let path = raw_path
        .strip_prefix("/v1")
        .unwrap_or(&raw_path)
        .to_string();

    tracing::info!(?method, %raw_path, %path, "request_received");

    if method == "OPTIONS" {
        return cors_preflight();
    }

    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();

    match (method.as_str(), segments.as_slice()) {
        ("GET", ["hello"]) => handlers::hello::handle().await,
        ("GET", ["me"]) => handlers::me::handle(&state, event).await,
        ("PATCH", ["me"]) => handlers::me::update(&state, event).await,

        // Handles (unique @mention identifiers)
        ("PUT", ["me", "handle"]) => handlers::handles::set(&state, event).await,
        ("GET", ["handles", h, "availability"]) => {
            handlers::handles::availability(&state, event, h).await
        }

        // Avatar (profile photo)
        ("POST", ["me", "avatar"]) => handlers::avatar::upload(&state, event).await,
        ("DELETE", ["me", "avatar"]) => handlers::avatar::delete(&state, event).await,

        // Presigned upload URL for chat media
        ("POST", ["uploads"]) => handlers::uploads::create(&state, event).await,

        // Inbox / notifications
        ("GET", ["me", "inbox"]) => handlers::inbox::list(&state, event).await,
        ("POST", ["me", "inbox", id, "read"]) => {
            handlers::inbox::mark_read(&state, event, id).await
        }
        ("POST", ["me", "inbox", "read-all"]) => {
            handlers::inbox::mark_all_read(&state, event).await
        }

        // Web Push — subscriptions + notification preferences
        ("POST", ["me", "push-subscriptions"]) => handlers::push::subscribe(&state, event).await,
        ("POST", ["me", "push-subscriptions", "remove"]) => {
            handlers::push::unsubscribe(&state, event).await
        }
        ("GET", ["me", "notification-prefs"]) => handlers::push::get_prefs(&state, event).await,
        ("PUT", ["me", "notification-prefs"]) => handlers::push::put_prefs(&state, event).await,

        // Projects
        ("POST", ["projects"]) => handlers::projects::create(&state, event).await,
        ("GET", ["projects"]) => handlers::projects::list_mine(&state, event).await,
        ("GET", ["projects", slug]) => handlers::projects::get(&state, event, slug).await,

        // Members
        ("GET", ["projects", slug, "members"]) => {
            handlers::members::list(&state, event, slug).await
        }

        // Categories (topics)
        ("GET", ["projects", slug, "categories"]) => {
            handlers::categories::list(&state, event, slug).await
        }
        ("POST", ["projects", slug, "categories"]) => {
            handlers::categories::create(&state, event, slug).await
        }
        ("PATCH", ["projects", slug, "categories", id]) => {
            handlers::categories::update(&state, event, slug, id).await
        }
        ("DELETE", ["projects", slug, "categories", id]) => {
            handlers::categories::delete(&state, event, slug, id).await
        }

        // Documents (derived view over Document-kind proposals)
        ("GET", ["projects", slug, "documents"]) => {
            handlers::documents::list(&state, event, slug).await
        }
        ("GET", ["projects", slug, "documents", "by-name", name]) => {
            handlers::documents::by_name(&state, event, slug, name).await
        }

        // Invites — project-scoped
        ("POST", ["projects", slug, "invites"]) => {
            handlers::invites::issue(&state, event, slug).await
        }
        ("GET", ["projects", slug, "invites"]) => {
            handlers::invites::list(&state, event, slug).await
        }
        ("DELETE", ["projects", slug, "invites", invite_id]) => {
            handlers::invites::revoke(&state, event, slug, invite_id).await
        }

        // Invites — accept flow
        ("GET", ["invites", token]) => {
            handlers::invites::preview_by_token(&state, event, token).await
        }
        ("GET", ["invites", "by-code", code]) => {
            handlers::invites::preview_by_code(&state, event, code).await
        }
        ("POST", ["invites", "by-code", code, "accept"]) => {
            handlers::invites::accept_by_code(&state, event, code).await
        }
        ("POST", ["invites", token, "accept"]) => {
            handlers::invites::accept(&state, event, token).await
        }

        // Proposals
        ("POST", ["projects", slug, "proposals"]) => {
            handlers::proposals::create(&state, event, slug).await
        }
        ("GET", ["projects", slug, "proposals"]) => {
            handlers::proposals::list(&state, event, slug).await
        }
        ("GET", ["projects", slug, "proposals", id]) => {
            handlers::proposals::get(&state, event, slug, id).await
        }
        ("GET", ["projects", slug, "proposals", id, "tree"]) => {
            handlers::proposals::tree(&state, event, slug, id).await
        }
        ("POST", ["projects", slug, "proposals", id, "vote"]) => {
            handlers::votes::cast(&state, event, slug, id).await
        }
        ("DELETE", ["projects", slug, "proposals", id, "vote"]) => {
            handlers::votes::retract(&state, event, slug, id).await
        }
        ("POST", ["projects", slug, "proposals", id, "withdraw"]) => {
            handlers::proposals::withdraw(&state, event, slug, id).await
        }

        // Comments
        ("POST", ["projects", slug, "proposals", id, "comments"]) => {
            handlers::comments::create(&state, event, slug, id).await
        }
        ("GET", ["projects", slug, "proposals", id, "comments"]) => {
            handlers::comments::list(&state, event, slug, id).await
        }
        ("PATCH", ["projects", slug, "proposals", id, "comments", comment_id]) => {
            handlers::comments::update(&state, event, slug, id, comment_id).await
        }
        ("DELETE", ["projects", slug, "proposals", id, "comments", comment_id]) => {
            handlers::comments::delete(&state, event, slug, id, comment_id).await
        }

        // Messaging — channels (project-scoped) + DMs (user-pair) +
        // conversations/messages/threads
        ("GET", ["projects", slug, "channels"]) => {
            handlers::conversations::list_channels(&state, event, slug).await
        }
        ("GET", ["projects", slug, "search"]) => {
            handlers::search::search(&state, event, slug).await
        }
        ("GET", ["dms"]) => handlers::conversations::list_dms(&state, event).await,
        ("POST", ["dms"]) => handlers::conversations::create_dm(&state, event).await,
        ("GET", ["conversations", id]) => {
            handlers::conversations::get_conversation(&state, event, id).await
        }
        ("GET", ["conversations", id, "messages"]) => {
            handlers::conversations::list_messages(&state, event, id).await
        }
        ("POST", ["conversations", id, "messages"]) => {
            handlers::conversations::post_message(&state, event, id).await
        }
        ("POST", ["conversations", id, "read"]) => {
            handlers::conversations::mark_read(&state, event, id).await
        }
        ("GET", ["messages", id, "thread"]) => {
            handlers::conversations::get_thread(&state, event, id).await
        }

        _ => not_found(),
    }
}

fn cors_preflight() -> Result<Response<lambda_http::Body>, Error> {
    Ok(Response::builder()
        .status(204)
        .header("access-control-allow-origin", "*")
        .header("access-control-allow-headers", "authorization,content-type")
        .header(
            "access-control-allow-methods",
            "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        )
        .body(lambda_http::Body::Empty)?)
}

fn not_found() -> Result<Response<lambda_http::Body>, Error> {
    Ok(Response::builder()
        .status(404)
        .header("content-type", "application/json")
        .header("access-control-allow-origin", "*")
        .body(r#"{"error":"not_found","message":"route not found"}"#.into())?)
}
