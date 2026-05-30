//! Pure outcome computation for a closed deliberation.
//!
//! Faithful port of the mock layer's `decideOutcome`
//! (`apps/web/src/mocks/outcome.ts`) + decision 0005. Each user casts one vote
//! per deliberation; the choice is an alternative's proposal id, "none of
//! these", or "abstain". Four rules decide the winner; quorum is an optional
//! minimum of decisive votes.
//!
//! Returns the winning proposal id (or `None`) plus a status label. The caller
//! sets the status on each proposal in the tree (winner → passed, losers →
//! rejected, everything → quorum_failed when quorum fails).

use std::collections::HashSet;

use crate::domain::proposal::Tally;
use crate::domain::voting_rule::VotingRule;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutcomeStatus {
    HasWinner,
    NoWinner,
    QuorumFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutcomeResult {
    pub winner_id: Option<String>,
    pub status: OutcomeStatus,
}

impl OutcomeResult {
    fn no_winner() -> Self {
        Self {
            winner_id: None,
            status: OutcomeStatus::NoWinner,
        }
    }
    fn quorum_failed() -> Self {
        Self {
            winner_id: None,
            status: OutcomeStatus::QuorumFailed,
        }
    }
    fn winner(id: String) -> Self {
        Self {
            winner_id: Some(id),
            status: OutcomeStatus::HasWinner,
        }
    }
}

/// Decide the winner of a deliberation.
///
/// `valid_ids` is the set of alternative proposal ids in the tree (for a plain
/// decision with no forks, just the root id). Choices for ids outside this set
/// are ignored — they can't win.
pub fn decide_outcome(
    valid_ids: &HashSet<String>,
    tally: &Tally,
    rule: VotingRule,
    quorum: Option<i64>,
) -> OutcomeResult {
    if let Some(q) = quorum {
        if tally.decisive() < q {
            return OutcomeResult::quorum_failed();
        }
    }
    if tally.decisive() == 0 {
        return OutcomeResult::no_winner();
    }

    // Alternatives ranked by votes desc, then id asc for a deterministic winner.
    let mut ranked: Vec<(&String, i64)> = tally
        .by_choice
        .iter()
        .filter(|(id, _)| valid_ids.contains(id.as_str()))
        .map(|(id, n)| (id, *n))
        .collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));

    let Some(&(top_id, top_count)) = ranked.first() else {
        // Everyone who voted decisively picked "none of these".
        return OutcomeResult::no_winner();
    };
    let second = ranked.get(1).map(|&(_, n)| n).unwrap_or(0);

    // "None of these" competes against alternatives.
    if tally.none > top_count {
        return OutcomeResult::no_winner();
    }
    let tied = top_count == second || top_count == tally.none;
    let decisive = tally.decisive();

    match rule {
        VotingRule::Plurality => {
            if tied {
                OutcomeResult::no_winner()
            } else {
                OutcomeResult::winner(top_id.clone())
            }
        }
        VotingRule::SimpleMajority => {
            if top_count * 2 <= decisive {
                OutcomeResult::no_winner()
            } else {
                OutcomeResult::winner(top_id.clone())
            }
        }
        VotingRule::TwoThirds => {
            if top_count * 3 < decisive * 2 {
                OutcomeResult::no_winner()
            } else {
                OutcomeResult::winner(top_id.clone())
            }
        }
        VotingRule::Consensus => {
            // All decisive votes must converge on one alternative — no "none",
            // no second alternative. Abstain is silence-as-consent.
            if tally.none > 0 || ranked.len() > 1 {
                OutcomeResult::no_winner()
            } else {
                OutcomeResult::winner(top_id.clone())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(xs: &[&str]) -> HashSet<String> {
        xs.iter().map(|s| s.to_string()).collect()
    }

    fn tally(by: &[(&str, i64)], none: i64, abstain: i64) -> Tally {
        Tally {
            by_choice: by.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
            none,
            abstain,
        }
    }

    // ── single-candidate (root-only) — slice A's reality ────────────────────

    #[test]
    fn root_only_simple_majority_passes_when_picks_beat_none() {
        let r = decide_outcome(
            &ids(&["root"]),
            &tally(&[("root", 3)], 1, 0),
            VotingRule::SimpleMajority,
            None,
        );
        assert_eq!(r, OutcomeResult::winner("root".into()));
    }

    #[test]
    fn root_only_simple_majority_rejected_when_none_ties() {
        // 2 pick root, 2 none → top_count*2 (4) <= decisive (4) → no winner.
        let r = decide_outcome(
            &ids(&["root"]),
            &tally(&[("root", 2)], 2, 0),
            VotingRule::SimpleMajority,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn none_beating_top_is_no_winner() {
        let r = decide_outcome(
            &ids(&["root"]),
            &tally(&[("root", 1)], 5, 0),
            VotingRule::Plurality,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn abstain_is_excluded_from_decisive() {
        // 2 pick / 0 none / 100 abstain → decisive 2, majority on root.
        let r = decide_outcome(
            &ids(&["root"]),
            &tally(&[("root", 2)], 0, 100),
            VotingRule::SimpleMajority,
            None,
        );
        assert_eq!(r, OutcomeResult::winner("root".into()));
    }

    // ── multi-alternative (reachable in slice B; logic supports it now) ──────

    #[test]
    fn plurality_clear_leader_wins() {
        let r = decide_outcome(
            &ids(&["a", "b", "c"]),
            &tally(&[("a", 5), ("b", 3), ("c", 1)], 0, 0),
            VotingRule::Plurality,
            None,
        );
        assert_eq!(r, OutcomeResult::winner("a".into()));
    }

    #[test]
    fn plurality_tie_is_no_winner() {
        let r = decide_outcome(
            &ids(&["a", "b"]),
            &tally(&[("a", 3), ("b", 3)], 0, 0),
            VotingRule::Plurality,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn two_thirds_exact_passes() {
        // top 2 of decisive 3 → 2*3 (6) >= 3*2 (6) → pass.
        let r = decide_outcome(
            &ids(&["a", "b"]),
            &tally(&[("a", 2), ("b", 1)], 0, 0),
            VotingRule::TwoThirds,
            None,
        );
        assert_eq!(r, OutcomeResult::winner("a".into()));
    }

    #[test]
    fn two_thirds_just_below_fails() {
        // top 3 of decisive 5 → 3*3 (9) < 5*2 (10) → no winner.
        let r = decide_outcome(
            &ids(&["a", "b"]),
            &tally(&[("a", 3), ("b", 2)], 0, 0),
            VotingRule::TwoThirds,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn consensus_single_alternative_no_none_passes() {
        let r = decide_outcome(
            &ids(&["a"]),
            &tally(&[("a", 4)], 0, 2),
            VotingRule::Consensus,
            None,
        );
        assert_eq!(r, OutcomeResult::winner("a".into()));
    }

    #[test]
    fn consensus_with_dissent_fails() {
        let r = decide_outcome(
            &ids(&["a", "b"]),
            &tally(&[("a", 4), ("b", 1)], 0, 0),
            VotingRule::Consensus,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn consensus_with_none_fails() {
        let r = decide_outcome(
            &ids(&["a"]),
            &tally(&[("a", 4)], 1, 0),
            VotingRule::Consensus,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    // ── quorum + empties ────────────────────────────────────────────────────

    #[test]
    fn quorum_failed_when_below() {
        let r = decide_outcome(
            &ids(&["a"]),
            &tally(&[("a", 3)], 0, 0),
            VotingRule::SimpleMajority,
            Some(5),
        );
        assert_eq!(r.status, OutcomeStatus::QuorumFailed);
    }

    #[test]
    fn quorum_counts_decisive_not_abstain() {
        // decisive 5 (3 a + 2 none) meets quorum 5; abstainers don't help.
        let r = decide_outcome(
            &ids(&["a"]),
            &tally(&[("a", 3)], 2, 9),
            VotingRule::SimpleMajority,
            Some(5),
        );
        assert_eq!(r, OutcomeResult::winner("a".into()));
    }

    #[test]
    fn no_decisive_votes_is_no_winner() {
        let r = decide_outcome(&ids(&["a"]), &tally(&[], 0, 4), VotingRule::Plurality, None);
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }

    #[test]
    fn picks_for_unknown_ids_are_ignored() {
        // A stale pick for an id not in the tree can't win; only "none" remains
        // decisive-but-not-an-alternative → no winner.
        let r = decide_outcome(
            &ids(&["a"]),
            &tally(&[("ghost", 9)], 0, 0),
            VotingRule::Plurality,
            None,
        );
        assert_eq!(r.status, OutcomeStatus::NoWinner);
    }
}
