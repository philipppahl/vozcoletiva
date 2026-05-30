//! Documents are a derived view over Document-kind proposals (decision 0004).
//! See `repo::document`. These endpoints assemble the derived shape; there is no
//! Document entity.

use std::collections::HashMap;

use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::error::AppError;
use crate::handlers::proposals::{view_with_tally, ProposalView};
use crate::repo::document;
use crate::repo::proposal::Proposal;
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct DocumentSummary {
    name: String,
    version_count: i64,
    current_version: Option<ProposalView>,
    active_amendment: Option<ProposalView>,
}

#[derive(Debug, Serialize)]
struct DocumentListResponse {
    documents: Vec<DocumentSummary>,
}

#[derive(Debug, Serialize)]
struct DocumentDetail {
    name: String,
    version_count: i64,
    current_version: ProposalView,
    versions: Vec<ProposalView>,
    active_amendment: Option<ProposalView>,
}

/// A document version / amendment DTO. Documents are historical records; the
/// caller's per-deliberation vote is not threaded in here (None), and each
/// version's own stored tally is used.
fn dto(p: &Proposal) -> ProposalView {
    view_with_tally(p, None, &p.tally)
}

pub async fn list(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;

            // Passed versions grouped by document name.
            let mut by_name: HashMap<String, Vec<Proposal>> = HashMap::new();
            for p in document::passed_versions(state, &auth.project.id).await? {
                if let Some(name) = p.document_name.clone() {
                    by_name.entry(name).or_default().push(p);
                }
            }
            // Active amendments, mapped by document name.
            let mut active: HashMap<String, Proposal> = HashMap::new();
            for p in document::active_doc_roots(state, &auth.project.id).await? {
                if let Some(name) = p.document_name.clone() {
                    active.insert(name, p);
                }
            }

            let mut documents: Vec<DocumentSummary> = by_name
                .into_iter()
                .map(|(name, mut versions)| {
                    versions.sort_by(|a, b| b.closed_at.cmp(&a.closed_at));
                    let current = versions.first().map(dto);
                    DocumentSummary {
                        active_amendment: active.get(&name).map(dto),
                        version_count: versions.len() as i64,
                        current_version: current,
                        name,
                    }
                })
                .collect();
            documents.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(DocumentListResponse { documents })
        },
        200,
    )
    .await
}

pub async fn by_name(
    state: &AppState,
    req: Request,
    slug: &str,
    raw_name: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let name = percent_decode(raw_name);

            let versions = document::versions_for_name(state, &auth.project.id, &name).await?;
            let current = versions.first().ok_or(AppError::NotFound)?;
            let active = document::active_for_name(state, &auth.project.id, &name).await?;

            Ok(DocumentDetail {
                name: name.clone(),
                version_count: versions.len() as i64,
                current_version: dto(current),
                versions: versions.iter().map(dto).collect(),
                active_amendment: active.as_ref().map(dto),
            })
        },
        200,
    )
    .await
}

/// Minimal percent-decoding for a single path segment (`%XX` → byte). Enough for
/// document names with spaces/punctuation; `+` is left as-is (matches
/// `decodeURIComponent`).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}
