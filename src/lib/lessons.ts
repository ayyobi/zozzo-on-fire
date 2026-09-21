// Data layer for Leçons (`lecons`, `lecon_signes`).
//
// Field names below are CONFIRMED against the live PocketBase API (both
// collections are publicly readable). `lecons` has `categorie` (a
// relation to `categories`, same one used by the dictionary), but the
// actual signs shown in an exercise come from `lecon_signes` — a join
// table (lecon, signe, ordre) that's already curated with an explicit
// order for exactly the first 2 lessons (the ones this version unlocks).
// That's a more precise source than "every sign in the lesson's
// category" (which could include signs never meant for that lesson), so
// it's used here instead of category-matching.
//
// Sign media (mot/image/video) reuses the exact same field mapping as the
// dictionary (src/lib/dictionary.ts) rather than duplicating it.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';
import { type SignRecord } from './dictionary';

export const LESSON_FIELDS = {
	title: 'titre',
	image: 'image',
	description: 'description',
	difficulty: 'difficulte',
	order: 'ordre',
	category: 'categorie',
} as const;

export const LESSON_SIGN_FIELDS = {
	lesson: 'lecon',
	sign: 'signe',
	order: 'ordre',
} as const;

// Business rule for this version (point 14/54 of the brief): only the
// first 2 lessons (by `ordre`) are open. Not tied to progression/Premium —
// deliberately simple, per the brief.
export const OPEN_LESSON_COUNT = 2;

export interface LessonRecord extends RecordModel {
	[key: string]: unknown;
}

export async function listLessons(): Promise<LessonRecord[]> {
	return pb.collection('lecons').getFullList<LessonRecord>({ sort: LESSON_FIELDS.order });
}

export async function getLessonById(id: string): Promise<LessonRecord | null> {
	try {
		return await pb.collection('lecons').getOne<LessonRecord>(id);
	} catch {
		return null;
	}
}

export function isLessonOpen(lesson: LessonRecord, allLessons: LessonRecord[]): boolean {
	const order = Number(lesson[LESSON_FIELDS.order]);
	if (!Number.isFinite(order)) return false;
	// Rank by real ordre position rather than trusting the raw number in
	// case of gaps (e.g. ordre 1, 2, 5) — "the first 2" means position,
	// not "ordre <= 2" literally, though today they're the same.
	const sorted = [...allLessons].sort(
		(a, b) => Number(a[LESSON_FIELDS.order]) - Number(b[LESSON_FIELDS.order]),
	);
	const index = sorted.findIndex((l) => l.id === lesson.id);
	return index >= 0 && index < OPEN_LESSON_COUNT;
}

export function getLessonTitle(lesson: LessonRecord): string {
	const value = lesson[LESSON_FIELDS.title];
	return typeof value === 'string' ? value : '';
}

export function getLessonDescriptionHtml(lesson: LessonRecord): string {
	const value = lesson[LESSON_FIELDS.description];
	return typeof value === 'string' ? value : '';
}

function resolveFileUrl(record: RecordModel, field: string): string | null {
	const value = record[field];
	if (!value || typeof value !== 'string') return null;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getLessonImageUrl(lesson: LessonRecord): string | null {
	return resolveFileUrl(lesson, LESSON_FIELDS.image);
}

// Ordered, fully-expanded signs for a lesson's exercises — one request via
// PocketBase's `expand`, no N+1 lookups.
export async function listLessonSigns(lessonId: string): Promise<SignRecord[]> {
	const rows = await pb.collection('lecon_signes').getFullList<RecordModel>({
		filter: pb.filter(`${LESSON_SIGN_FIELDS.lesson} = {:id}`, { id: lessonId }),
		sort: LESSON_SIGN_FIELDS.order,
		expand: LESSON_SIGN_FIELDS.sign,
	});
	return rows
		.map((row) => row.expand?.[LESSON_SIGN_FIELDS.sign] as SignRecord | undefined)
		.filter((sign): sign is SignRecord => !!sign);
}
