//! The fixed chat reaction set (decision 0031). Keeping it a small, curated set
//! (rather than a full emoji picker) keeps reactions calm + fast and the storage
//! bounded.

pub const REACTIONS: [&str; 6] = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

pub fn is_allowed(emoji: &str) -> bool {
    REACTIONS.contains(&emoji)
}
