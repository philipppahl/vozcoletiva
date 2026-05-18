use rand::distributions::Slice;
use rand::Rng;

use crate::error::AppError;

/// Alphabet for short invite codes. Avoids visually ambiguous characters
/// (`0/O`, `1/I/l`) so users can read codes off a slip of paper without
/// guessing.
const ALPHABET: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN: usize = 8;

/// Generate a fresh 8-character invite code.
pub fn generate() -> String {
    let dist = Slice::new(ALPHABET).expect("non-empty alphabet");
    let mut rng = rand::thread_rng();
    (0..CODE_LEN).map(|_| *rng.sample(dist) as char).collect()
}

/// Validate a user-entered short code. Accepts the same alphabet (case-insensitive
/// on input but normalised to upper-case before lookup). Returns the canonical
/// (upper-case) form.
pub fn parse(input: &str) -> Result<String, AppError> {
    let trimmed = input.trim().to_ascii_uppercase();
    if trimmed.len() != CODE_LEN {
        return Err(AppError::BadRequest(format!(
            "code must be exactly {CODE_LEN} characters"
        )));
    }
    if !trimmed
        .bytes()
        .all(|b| ALPHABET.contains(&b))
    {
        return Err(AppError::BadRequest(
            "code contains characters outside the allowed alphabet".into(),
        ));
    }
    Ok(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_code_has_correct_length_and_alphabet() {
        for _ in 0..100 {
            let c = generate();
            assert_eq!(c.len(), CODE_LEN);
            assert!(c.bytes().all(|b| ALPHABET.contains(&b)));
        }
    }

    #[test]
    fn generation_yields_diverse_codes() {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..200 {
            seen.insert(generate());
        }
        // We don't expect 200 unique codes 100% of the time, but the chance
        // of fewer than 190 by chance is astronomically small.
        assert!(seen.len() > 190);
    }

    #[test]
    fn parse_accepts_canonical_code() {
        let c = generate();
        assert_eq!(parse(&c).unwrap(), c);
    }

    #[test]
    fn parse_normalises_case() {
        // Generated codes are upper-case; users may type lower-case.
        let c = generate();
        let lower = c.to_lowercase();
        assert_eq!(parse(&lower).unwrap(), c);
    }

    #[test]
    fn parse_rejects_wrong_length() {
        assert!(matches!(parse("ABC"), Err(AppError::BadRequest(_))));
        assert!(matches!(parse("ABCDEFGHIJK"), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn parse_rejects_ambiguous_chars() {
        // 0 and 1 are not in the alphabet.
        assert!(matches!(parse("ABCDEFG0"), Err(AppError::BadRequest(_))));
        assert!(matches!(parse("1BCDEFGH"), Err(AppError::BadRequest(_))));
        // I and O are not either.
        assert!(matches!(parse("ABCDEFGI"), Err(AppError::BadRequest(_))));
        assert!(matches!(parse("OBCDEFGH"), Err(AppError::BadRequest(_))));
    }
}
