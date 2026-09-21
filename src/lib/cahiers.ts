// Data layer for Cahier (`cahiers`).
//
// Field names CONFIRMED against the live PocketBase API (now public —
// see the report for what changed): titre, slug, image, ordre, premium,
// description. No `categorie` relation field exists on this collection.
//
// The real `slug` values are NOT clean URL slugs — they're the raw title
// re-typed ("L’alphabet" with a curly apostrophe and capital L, "Les
// couleur" with a typo/spaces, etc.). Rather than asking Nargis to go
// clean up PocketBase, routes here use a normalized version of that slug
// (normalizeSlug below: lowercase, accents stripped, non-alphanumeric ->
// hyphens) — so URLs are clean (/cahiers/l-alphabet) without needing the
// stored field to be clean.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const CAHIER_FIELDS = {
	title: 'titre',
	slug: 'slug',
	image: 'image',
	order: 'ordre',
	premium: 'premium',
	description: 'description',
} as const;

export interface CahierRecord extends RecordModel {
	[key: string]: unknown;
}

export function normalizeSlug(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // strip accents
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function getCahierSlug(cahier: CahierRecord): string {
	const raw = cahier[CAHIER_FIELDS.slug];
	const normalized = typeof raw === 'string' && raw ? normalizeSlug(raw) : '';
	return normalized || cahier.id;
}

export async function listCahiers(): Promise<CahierRecord[]> {
	return pb.collection('cahiers').getFullList<CahierRecord>({ sort: CAHIER_FIELDS.order });
}

// Matches by normalized slug client-side (not a PocketBase filter — the
// stored value isn't normalized, so there's nothing for the DB to match
// against). `cahiers` is a handful of records, so fetching them all is
// cheap.
export async function getCahierBySlug(slug: string): Promise<CahierRecord | null> {
	try {
		const cahiers = await listCahiers();
		return cahiers.find((c) => getCahierSlug(c) === slug) ?? null;
	} catch {
		return null;
	}
}

// Simple rule, per the brief: a cahier is open purely based on its own
// `premium` flag — no ordre-position logic like Leçons' "first 2".
export function isCahierOpen(cahier: CahierRecord): boolean {
	return cahier[CAHIER_FIELDS.premium] !== true;
}

export function getCahierTitle(cahier: CahierRecord): string {
	const value = cahier[CAHIER_FIELDS.title];
	return typeof value === 'string' ? value : '';
}

export function getCahierDescriptionHtml(cahier: CahierRecord): string {
	const value = cahier[CAHIER_FIELDS.description];
	return typeof value === 'string' ? value : '';
}

function resolveFileUrl(record: RecordModel, field: string): string | null {
	const value = record[field];
	if (!value || typeof value !== 'string') return null;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getCahierImageUrl(cahier: CahierRecord): string | null {
	return resolveFileUrl(cahier, CAHIER_FIELDS.image);
}

// `cahiers` has no `categorie` relation (confirmed), so the only way to
// find "which signs belong to this cahier" right now is by matching its
// (normalized) slug against a `categories` slug. Add an entry here for
// each cahier that gets real content; recommend Nargis add a real
// `categorie` relation field later to make this fully generic.
const CAHIER_SLUG_TO_CATEGORY_SLUG: Record<string, string> = {
	'l-alphabet': 'alphabet',
	alphabet: 'alphabet',
};

export async function getCahierCategoryId(cahier: CahierRecord): Promise<string | null> {
	const categorySlug = CAHIER_SLUG_TO_CATEGORY_SLUG[getCahierSlug(cahier)];
	if (!categorySlug) return null;

	try {
		const categories = await pb.collection('categories').getFullList();
		const match = categories.find((c) => normalizeSlug(String(c.slug ?? c.titre ?? '')) === categorySlug);
		return match?.id ?? null;
	} catch {
		return null;
	}
}
