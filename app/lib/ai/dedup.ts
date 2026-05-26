import { createHash } from 'crypto';

// Mirror of act.passages_fill_defaults() and act.questions_fill_defaults().
// These hashes are precomputed only as a debugging aid — the DB trigger
// recomputes them on insert, so the canonical source of truth is Postgres.
// We expose them here so callers can detect a likely-duplicate up-front
// (currently unused in generate.ts; the trigger + UNIQUE constraint is the
// real gate).
//
// IMPORTANT: the Postgres trigger does NO normalization (no lowercasing,
// no whitespace collapse). Pass the exact bytes that will land in the row.
export function dedupHashPassage(
  section: string,
  passage_type: string,
  body: string,
): string {
  const basis = `${section}|${passage_type}|${body}`;
  return createHash('sha256').update(basis).digest('hex');
}

// Mirror of act.questions_fill_defaults(). The DB trigger casts choices (jsonb)
// to text, which produces Postgres's canonical jsonb serialization. We can't
// replicate that from JS perfectly, so callers that want a "real" match should
// rely on the DB trigger; this helper is only for sanity-checking from tests.
//
// We accept the already-serialized choices string as input — the caller is
// expected to produce the same text Postgres would emit (or close to it).
export function dedupHashQuestion(
  section: string,
  skill: string,
  stem: string,
  choicesJsonText: string,
): string {
  const basis = `${section}|${skill}|${stem}|${choicesJsonText}`;
  return createHash('sha256').update(basis).digest('hex');
}
