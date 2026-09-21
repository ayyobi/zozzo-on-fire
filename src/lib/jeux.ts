// Data layer for Mini-jeux (`jeux`).
//
// Field names CONFIRMED directly by Nargis (titre, slug, description,
// image, type, actif) — she checked PocketBase herself this time, no
// guessing needed. A game must be active and its type implemented to
// be playable. Only the chrono engine is currently implemented.
// The `type = "quiz"` record is a different feature and is
// excluded from the Mini-jeux listing per the brief.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const JEU_FIELDS = {
	title: 'titre',
	slug: 'slug',
	description: 'description',
	image: 'image',
	type: 'type',
	active: 'actif',
} as const;

export interface JeuRecord extends RecordModel {
	[key: string]: unknown;
}

// No `ordre` field exists on `jeux` — sorted by `created` instead, which
// already matches the intended Top Chrono / Relis-tout / Reconsti order
// (that's the order they were added in PocketBase).
export async function listJeux(): Promise<JeuRecord[]> {
	const all = await pb.collection('jeux').getFullList<JeuRecord>({ sort: 'created' });
	return all.filter((j) => j[JEU_FIELDS.type] !== 'quiz');
}

export async function getJeuBySlug(slug: string): Promise<JeuRecord | null> {
	try {
		return await pb.collection('jeux').getFirstListItem<JeuRecord>(pb.filter(`${JEU_FIELDS.slug} = {:slug}`, { slug }));
	} catch {
		return null;
	}
}

export function isJeuOpen(jeu: JeuRecord): boolean {
	return jeu[JEU_FIELDS.active] === true && jeu[JEU_FIELDS.type] === 'chrono';
}

export function getJeuTitle(jeu: JeuRecord): string {
	const value = jeu[JEU_FIELDS.title];
	return typeof value === 'string' ? value : '';
}

export function getJeuDescriptionHtml(jeu: JeuRecord): string {
	const value = jeu[JEU_FIELDS.description];
	return typeof value === 'string' ? value : '';
}

function resolveFileUrl(record: RecordModel, field: string): string | null {
	const value = record[field];
	if (!value || typeof value !== 'string') return null;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getJeuImageUrl(jeu: JeuRecord): string | null {
	return resolveFileUrl(jeu, JEU_FIELDS.image);
}
