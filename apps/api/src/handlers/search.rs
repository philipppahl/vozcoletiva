//! Project-scoped search: a server-side substring match over proposals,
//! documents, members, and channels. Not full-text — sufficient for the MVP
//! (decision 0023). Reuses the existing list repos.

use std::collections::HashMap;

use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::error::AppError;
use crate::repo::conversation::Conversation;
use crate::repo::membership::Membership;
use crate::repo::proposal::Proposal;
use crate::repo::{conversation, document, membership, proposal};
use crate::state::AppState;

const MIN_QUERY_LEN: usize = 2;
const PER_SECTION_CAP: usize = 10;
const SNIPPET_WINDOW: usize = 80;

#[derive(Debug, Serialize)]
struct ProposalHit {
    id: String,
    title: String,
    snippet: String,
    status: String,
    proposal_kind: String,
}
#[derive(Debug, Serialize)]
struct DocumentHit {
    name: String,
    version_count: i64,
    snippet: String,
}
#[derive(Debug, Serialize)]
struct MemberHit {
    user_id: String,
    display_name: String,
    role: String,
}
#[derive(Debug, Serialize)]
struct ChannelHit {
    id: String,
    name: String,
    description: Option<String>,
}

#[derive(Debug, Serialize)]
struct Section<T> {
    hits: Vec<T>,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct Sections {
    proposals: Section<ProposalHit>,
    documents: Section<DocumentHit>,
    members: Section<MemberHit>,
    channels: Section<ChannelHit>,
}

#[derive(Debug, Serialize)]
struct SearchResponse {
    query: String,
    sections: Sections,
}

fn empty_sections() -> Sections {
    Sections {
        proposals: Section { hits: vec![], has_more: false },
        documents: Section { hits: vec![], has_more: false },
        members: Section { hits: vec![], has_more: false },
        channels: Section { hits: vec![], has_more: false },
    }
}

fn contains_ci(haystack: &str, needle_lower: &str) -> bool {
    haystack.to_lowercase().contains(needle_lower)
}

/// ~`SNIPPET_WINDOW` chars centred on the first match (case-insensitive), with
/// whitespace collapsed and ellipses where it's clipped.
fn snippet_around(haystack: &str, needle_lower: &str) -> String {
    let cleaned = haystack.split_whitespace().collect::<Vec<_>>().join(" ");
    let chars: Vec<char> = cleaned.chars().collect();
    let lower = cleaned.to_lowercase();
    let idx = lower.find(needle_lower);
    let start_char = match idx {
        // Convert the byte index to a char index, then centre the window.
        Some(byte) => {
            let char_idx = lower[..byte].chars().count();
            char_idx.saturating_sub(SNIPPET_WINDOW / 2)
        }
        None => 0,
    };
    let end_char = (start_char + SNIPPET_WINDOW).min(chars.len());
    let prefix = if start_char > 0 { "…" } else { "" };
    let suffix = if end_char < chars.len() { "…" } else { "" };
    let body: String = chars[start_char..end_char].iter().collect();
    format!("{prefix}{body}{suffix}")
}

fn recency(p: &Proposal) -> String {
    p.closed_at.unwrap_or(p.created_at).to_rfc3339()
}

pub async fn search(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let q = query_param(&req, "q").unwrap_or_default();
            let q = q.trim().to_string();
            if q.chars().count() < MIN_QUERY_LEN {
                return Ok(SearchResponse {
                    query: q,
                    sections: empty_sections(),
                });
            }
            let ql = q.to_lowercase();
            let project_id = &auth.project.id;

            let proposals = proposal::list_for_project(state, project_id).await?;
            let members = membership::list(state, project_id).await?;
            let channels = conversation::list_channels(state, project_id).await?;
            let doc_versions = document::passed_versions(state, project_id).await?;

            Ok(SearchResponse {
                query: q,
                sections: Sections {
                    proposals: proposal_section(&proposals, &ql),
                    documents: document_section(doc_versions, &ql),
                    members: member_section(&members, &ql),
                    channels: channel_section(&channels, &ql),
                },
            })
        },
        200,
    )
    .await
}

fn proposal_section(proposals: &[Proposal], ql: &str) -> Section<ProposalHit> {
    let mut matches: Vec<&Proposal> = proposals
        .iter()
        .filter(|p| contains_ci(&p.title, ql) || contains_ci(&p.body, ql))
        .collect();
    matches.sort_by_key(|p| std::cmp::Reverse(recency(p)));
    let has_more = matches.len() > PER_SECTION_CAP;
    let hits = matches
        .into_iter()
        .take(PER_SECTION_CAP)
        .map(|p| ProposalHit {
            id: p.id.clone(),
            title: p.title.clone(),
            snippet: snippet_around(&p.body, ql),
            status: p.status.as_str().to_string(),
            proposal_kind: p.proposal_kind.as_str().to_string(),
        })
        .collect();
    Section { hits, has_more }
}

fn document_section(versions: Vec<Proposal>, ql: &str) -> Section<DocumentHit> {
    // Group passed versions by document name, current = most-recently-closed.
    let mut by_name: HashMap<String, Vec<Proposal>> = HashMap::new();
    for v in versions {
        if let Some(name) = v.document_name.clone() {
            by_name.entry(name).or_default().push(v);
        }
    }
    let mut docs: Vec<(String, i64, Proposal)> = by_name
        .into_iter()
        .filter_map(|(name, mut vs)| {
            vs.sort_by_key(|p| std::cmp::Reverse(recency(p)));
            let count = vs.len() as i64;
            vs.into_iter().next().map(|current| (name, count, current))
        })
        .filter(|(name, _, current)| contains_ci(name, ql) || contains_ci(&current.body, ql))
        .collect();
    docs.sort_by_key(|d| std::cmp::Reverse(recency(&d.2)));
    let has_more = docs.len() > PER_SECTION_CAP;
    let hits = docs
        .into_iter()
        .take(PER_SECTION_CAP)
        .map(|(name, count, current)| DocumentHit {
            name,
            version_count: count,
            snippet: snippet_around(&current.body, ql),
        })
        .collect();
    Section { hits, has_more }
}

fn member_section(members: &[Membership], ql: &str) -> Section<MemberHit> {
    let mut matches: Vec<&Membership> = members
        .iter()
        .filter(|m| contains_ci(&m.display_name, ql))
        .collect();
    matches.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    let has_more = matches.len() > PER_SECTION_CAP;
    let hits = matches
        .into_iter()
        .take(PER_SECTION_CAP)
        .map(|m| MemberHit {
            user_id: m.user_id.clone(),
            display_name: m.display_name.clone(),
            role: m.role.as_str().to_string(),
        })
        .collect();
    Section { hits, has_more }
}

fn channel_section(channels: &[Conversation], ql: &str) -> Section<ChannelHit> {
    let mut matches: Vec<&Conversation> = channels
        .iter()
        .filter(|c| {
            contains_ci(&c.name, ql) || c.description.as_deref().is_some_and(|d| contains_ci(d, ql))
        })
        .collect();
    matches.sort_by(|a, b| a.name.cmp(&b.name));
    let has_more = matches.len() > PER_SECTION_CAP;
    let hits = matches
        .into_iter()
        .take(PER_SECTION_CAP)
        .map(|c| ChannelHit {
            id: c.id.clone(),
            name: c.name.clone(),
            description: c.description.clone(),
        })
        .collect();
    Section { hits, has_more }
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn query_param(req: &Request, key: &str) -> Option<String> {
    let query = req.uri().query()?;
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(urlencoding_decode(v));
            }
        }
    }
    None
}

/// Minimal percent-decoding for the `q` query value (handles `%XX` + `+`).
fn urlencoding_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::proposal::{ProposalKind, ProposalStatus, Tally};
    use crate::domain::voting_rule::VotingRule;
    use chrono::{TimeZone, Utc};

    fn prop(id: &str, title: &str, body: &str, kind: ProposalKind, doc: Option<&str>, closed_min: i64) -> Proposal {
        Proposal {
            id: id.into(),
            project_id: "p".into(),
            root_id: id.into(),
            parent_id: None,
            category_id: "c".into(),
            proposal_kind: kind,
            document_name: doc.map(String::from),
            is_question: false,
            author_id: "u".into(),
            title: title.into(),
            body: body.into(),
            voting_rule: VotingRule::SimpleMajority,
            quorum: None,
            ends_at: Utc.timestamp_opt(0, 0).unwrap(),
            status: ProposalStatus::Passed,
            tally: Tally::default(),
            created_at: Utc.timestamp_opt(0, 0).unwrap(),
            closed_at: Some(Utc.timestamp_opt(closed_min * 60, 0).unwrap()),
            schedule_arn: None,
        }
    }

    #[test]
    fn proposal_section_matches_title_or_body_and_caps() {
        let proposals = vec![
            prop("a", "Bicicletário na praça", "corpo", ProposalKind::Decision, None, 1),
            prop("b", "Outra coisa", "menciona bicicletário aqui", ProposalKind::Decision, None, 2),
            prop("c", "Nada a ver", "nada", ProposalKind::Decision, None, 3),
        ];
        let s = proposal_section(&proposals, "bicicletário");
        assert_eq!(s.hits.len(), 2);
        assert!(!s.has_more);
        // Most-recently-closed first (b closed after a).
        assert_eq!(s.hits[0].id, "b");
    }

    #[test]
    fn document_section_groups_by_name_with_version_count() {
        let versions = vec![
            prop("v1", "Regras v1", "primeira versão", ProposalKind::Document, Some("Regras"), 1),
            prop("v2", "Regras v2", "segunda versão regras", ProposalKind::Document, Some("Regras"), 2),
        ];
        let s = document_section(versions, "regras");
        assert_eq!(s.hits.len(), 1);
        assert_eq!(s.hits[0].name, "Regras");
        assert_eq!(s.hits[0].version_count, 2);
        // Snippet comes from the current (most-recent) version.
        assert!(s.hits[0].snippet.contains("segunda"));
    }

    #[test]
    fn snippet_centres_and_collapses() {
        let body = "The quick   brown fox jumps over the lazy dog";
        assert_eq!(snippet_around(body, "brown"), "The quick brown fox jumps over the lazy dog");
    }

    #[test]
    fn snippet_clips_long_text_with_ellipses() {
        let body = "x ".repeat(100) + "needle " + &"y ".repeat(100);
        let s = snippet_around(&body, "needle");
        assert!(s.starts_with('…') && s.ends_with('…'));
        assert!(s.contains("needle"));
    }

    #[test]
    fn decodes_query_value() {
        assert_eq!(urlencoding_decode("bike%20racks"), "bike racks");
        assert_eq!(urlencoding_decode("a+b"), "a b");
    }
}
