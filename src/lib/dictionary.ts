// Data layer for the LSF dictionary (`signes` / `categories_signes`).
//
// ⚠️ FIELD NAMES BELOW ARE UNCONFIRMED. Nargis has not shared the exact
// PocketBase schema for these two collections yet. The names used here
// (mot, image, video, categorie, premium, nom) are the exact words she
// used herself as examples when describing the schema — they are a
// best-effort guess, not a verified fact. Everything that depends on the
// real field names is isolated in the two config objects below: if the
// real names differ, this is the ONLY file that needs to change.
import { pb, type ZozzoUser } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const SIGN_FIELDS = {
	word: 'mot',
	image: 'image',
	video: 'video',
	category: 'categorie',
	premium: 'premium',
} as const;

export const CATEGORY_FIELDS = {
	name: 'nom',
	premium: 'premium',
} as const;

export interface SignRecord extends RecordModel {
	[key: string]: unknown;
}

export type FetchState<T> =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'empty' }
	| { status: 'ok'; data: T };

export async function searchSigns(
	query: string,
	opts: { categoryId?: string; limit?: number } = {},
): Promise<SignRecord[]> {
	const limit = opts.limit ?? 12;
	let filterExpr = '';

	if (query.trim()) {
		filterExpr = pb.filter(`${SIGN_FIELDS.word} ~ {:q}`, { q: query.trim() });
	}
	if (opts.categoryId) {
		const catFilter = pb.filter(`${SIGN_FIELDS.category} = {:c}`, { c: opts.categoryId });
		filterExpr = filterExpr ? `${filterExpr} && ${catFilter}` : catFilter;
	}

	const res = await pb.collection('signes').getList<SignRecord>(1, limit, {
		filter: filterExpr,
		sort: SIGN_FIELDS.word,
	});
	return res.items;
}

export async function getSignById(id: string): Promise<SignRecord> {
	return pb.collection('signes').getOne<SignRecord>(id);
}

export async function listCategories(): Promise<RecordModel[]> {
	// Kept separate from searchSigns() and allowed to fail silently at the
	// call site: a wrong field/collection guess here should only disable
	// the category filter, not break the whole dictionary.
	return pb.collection('categories_signes').getFullList({ sort: CATEGORY_FIELDS.name });
}

function resolveFileUrl(record: SignRecord, field: string): string | null {
	const value = record[field];
	if (!value || typeof value !== 'string') return null;
	// Defensive: works whether the field is a PocketBase file upload
	// (filename only) or already stores a full URL.
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getSignImageUrl(sign: SignRecord): string | null {
	return resolveFileUrl(sign, SIGN_FIELDS.image);
}

export function getSignVideoUrl(sign: SignRecord): string | null {
	return resolveFileUrl(sign, SIGN_FIELDS.video);
}

export function getSignWord(sign: SignRecord): string {
	const value = sign[SIGN_FIELDS.word];
	return typeof value === 'string' ? value : '';
}

// UI-only gate: hides the "locked" state and nudges towards /abonnement.
// This is NOT the real protection — a user editing the frontend must
// still be refused the premium video by PocketBase itself (API Rules on
// `signes`/`categories_signes`), which has to be configured server-side.
export function isSignLocked(sign: SignRecord, user: ZozzoUser | null): boolean {
	const premium = !!sign[SIGN_FIELDS.premium];
	return premium && user?.abonnement_actif !== true;
}
