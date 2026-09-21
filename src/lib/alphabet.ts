// Fetches the A–Z signs for the Alphabet cahier. Reuses `signes`'s exact
// field mapping from dictionary.ts (SIGN_FIELDS, getSignImageUrl,
// getSignWord) rather than duplicating it — this is not a new dataset,
// just the existing `signes` collection filtered to one category.
//
// CONFIRMED against the live API: 26 signs in the "Alphabet" category,
// `titre` = lowercase letter ("a".."z"), `mot` = uppercase letter — sorted
// by `titre` gives correct A→Z order (verified directly), never relying
// on PocketBase's default/insertion order.
import { pb } from './pocketbase';
import { SIGN_FIELDS, getSignWord, type SignRecord } from './dictionary';

export async function listAlphabetSigns(categoryId: string): Promise<SignRecord[]> {
	return pb.collection('signes').getFullList<SignRecord>({
		filter: pb.filter(`${SIGN_FIELDS.category} = {:c}`, { c: categoryId }),
		sort: 'titre',
	});
}

// One letter -> its sign record, for O(1) lookup by the keyboard/arrow nav.
export function buildLetterMap(signs: SignRecord[]): Map<string, SignRecord> {
	const map = new Map<string, SignRecord>();
	for (const sign of signs) {
		const letter = getSignWord(sign).trim().toUpperCase();
		if (letter.length === 1) map.set(letter, sign);
	}
	return map;
}

export const ALPHABET_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
