// Data layer for Cahier (`cahiers`).
//
// ⚠️ UNVERIFIED — unlike histoires/lecons/signes/categories, an anonymous
// read on `cahiers` returns "Only superusers can perform this action".
// I could not inspect its real fields, slugs, or whether it has a
// `categorie` relation. Field names below follow this project's
// established convention (every sibling content collection uses the
// French `titre`, not `title`) plus what Nargis described. This is a real
// blocker, not just a nicety: until `cahiers`' List/View rule allows
// public (or at least authenticated) read, NOTHING here — including for
// a real logged-in user — will ever load, and getStaticPaths() below will
// silently build zero /cahiers/[slug] pages. See the report for the exact
// PocketBase steps needed.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const CAHIER_FIELDS = {
	title: 'titre',
	slug: 'slug',
	image: 'image',
	order: 'ordre',
	premium: 'premium',
	description: 'description',
	// Not confirmed to exist — see getCahierCategoryId's fallback below.
	category: 'categorie',
} as const;

export interface CahierRecord extends RecordModel {
	[key: string]: unknown;
}

export async function listCahiers(): Promise<CahierRecord[]> {
	return pb.collection('cahiers').getFullList<CahierRecord>({ sort: CAHIER_FIELDS.order });
}

export async function getCahierBySlug(slug: string): Promise<CahierRecord | null> {
	try {
		return await pb
			.collection('cahiers')
			.getFirstListItem<CahierRecord>(pb.filter(`${CAHIER_FIELDS.slug} = {:slug}`, { slug }));
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

// Stopgap until `cahiers` has a confirmed `categorie` relation (recommended
// — see report, this is exactly the lecons -> categorie -> signes pattern
// already used elsewhere, and would make this fully generic for future
// cahiers with zero code changes). Until then: if the cahier record itself
// has a `categorie` value, use it directly; otherwise fall back to
// matching this cahier's slug against a `categories` slug.
const SLUG_TO_CATEGORY_SLUG: Record<string, string> = {
	'l-alphabet': 'Alphabet',
	alphabet: 'Alphabet',
};

export async function getCahierCategoryId(cahier: CahierRecord): Promise<string | null> {
	const direct = cahier[CAHIER_FIELDS.category];
	if (typeof direct === 'string' && direct) return direct;

	const slugValue = cahier[CAHIER_FIELDS.slug];
	const slug = typeof slugValue === 'string' ? slugValue.toLowerCase() : '';
	const categorySlug = SLUG_TO_CATEGORY_SLUG[slug];
	if (!categorySlug) return null;

	try {
		const categories = await pb.collection('categories').getFullList();
		const match = categories.find((c) => String(c.slug ?? '').toLowerCase() === categorySlug.toLowerCase());
		return match?.id ?? null;
	} catch {
		return null;
	}
}
