/// Matching the model's guesses to the company's own records happens here, on
/// the server, so the directory of buyers never has to be sent to the provider.

/// Legal-form words that people write or omit at random: "Atelier Nord SRL",
/// "SRL Atelier Nord" and "ООО Атэлье" should meet on the name alone.
const LEGAL_FORMS = new Set(['srl', 'sa', 'ii', 'î.i', 'ооо', 'оао', 'ао', 'ип', 'ltd', 'llc', 'sc', 'ic']);

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»"'„“”`()]/g, ' ')
    .split(/[\s,.;:]+/)
    .filter((word) => word && !LEGAL_FORMS.has(word))
    .join(' ');
}

export interface Candidate {
  id: string;
  name: string;
}

export type MatchResult = { kind: 'match'; id: string } | { kind: 'none' } | { kind: 'ambiguous' };

/// An exact normalised name wins. Otherwise one name containing the other
/// counts, but only when exactly one record qualifies — guessing between two
/// buyers on a fiscal document is worse than asking the person to pick.
export function matchByName(candidates: readonly Candidate[], query: string | null): MatchResult {
  const wanted = query ? normalizeName(query) : '';
  if (wanted.length < 3) return { kind: 'none' };

  const normalized = candidates.map((candidate) => ({
    id: candidate.id,
    name: normalizeName(candidate.name),
  }));
  const exact = normalized.filter((candidate) => candidate.name === wanted);
  if (exact.length === 1 && exact[0]) return { kind: 'match', id: exact[0].id };
  if (exact.length > 1) return { kind: 'ambiguous' };

  const partial = normalized.filter(
    (candidate) =>
      candidate.name.length >= 3 && (candidate.name.includes(wanted) || wanted.includes(candidate.name)),
  );
  if (partial.length === 1 && partial[0]) return { kind: 'match', id: partial[0].id };
  return partial.length > 1 ? { kind: 'ambiguous' } : { kind: 'none' };
}
