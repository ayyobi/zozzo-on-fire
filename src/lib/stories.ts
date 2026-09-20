// Data layer for the Histoires section (`histoires`, `pages_histoires`).
//
// `histoires` and `pages_histoires` field names below are CONFIRMED
// against the live PocketBase API (both are publicly readable). There is
// no `slug` field on `histoires`, so stories are addressed by their real
// PocketBase `id` (see /histoires/[id].astro) rather than a pretend slug.
//
// Completion tracking uses `users.histoires_terminees` (an array of
// completed story ids on the user's own record, per src/lib/bonusProgress.ts
// and the `histoires_terminees` field already declared on ZozzoUser in
// pocketbase.ts) — not a separate `progression` collection. That
// collection exists but its API rules reject even an authenticated user's
// own read ("Only superusers can perform this action"), so
// `histoires_terminees` is the real mechanism already wired into BonusBar.
import { pb, type ZozzoUser } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const STORY_FIELDS = {
	title: 'titre',
	image: 'couverture',
	description: 'description',
	difficulty: 'difficulte',
	order: 'ordre',
	premium: 'premium',
} as const;

export const SCENE_FIELDS = {
	story: 'histoire',
	order: 'ordre',
	text: 'texte',
	image: 'image',
} as const;

export interface StoryRecord extends RecordModel {
	[key: string]: unknown;
}

export interface SceneRecord extends RecordModel {
	[key: string]: unknown;
}

export async function listStories(): Promise<StoryRecord[]> {
	return pb.collection('histoires').getFullList<StoryRecord>({ sort: STORY_FIELDS.order });
}

export async function getStoryById(id: string): Promise<StoryRecord | null> {
	try {
		return await pb.collection('histoires').getOne<StoryRecord>(id);
	} catch {
		return null;
	}
}

export async function listScenes(storyId: string): Promise<SceneRecord[]> {
	return pb.collection('pages_histoires').getFullList<SceneRecord>({
		filter: pb.filter(`${SCENE_FIELDS.story} = {:id}`, { id: storyId }),
		sort: SCENE_FIELDS.order,
	});
}

export function isStoryCompleted(user: ZozzoUser | null, storyId: string): boolean {
	return Array.isArray(user?.histoires_terminees) && user.histoires_terminees.includes(storyId);
}

// Adds a story id to the user's own `histoires_terminees` (read-modify-write
// the whole array rather than relying on PocketBase's "+" append modifier,
// which only applies to typed multi-select/relation fields — this works
// regardless of whether the field is plain JSON or a multi-relation).
// Idempotent: replaying an already-completed story is a no-op, matching
// bonusProgress.ts's "must not award another object" contract.
export async function markStoryCompleted(user: ZozzoUser, storyId: string): Promise<ZozzoUser> {
	if (isStoryCompleted(user, storyId)) return user;
	const current = Array.isArray(user.histoires_terminees) ? user.histoires_terminees : [];
	return pb.collection('users').update<ZozzoUser>(user.id, {
		histoires_terminees: [...current, storyId],
	});
}

export type LockReason = 'progression' | 'premium' | null;

// A story is premium-locked if it's flagged premium and the user isn't.
// Otherwise it's progression-locked unless the previous story (by `ordre`)
// is marked done. The first story is never progression-locked. This reads
// position from the `stories` array itself (their real PocketBase order),
// never from a hardcoded title/id.
export function getStoryLockReason(
	story: StoryRecord,
	index: number,
	stories: StoryRecord[],
	user: ZozzoUser | null,
): LockReason {
	const isPremiumStory = !!story[STORY_FIELDS.premium];
	if (isPremiumStory && user?.abonnement_actif !== true) return 'premium';

	if (index === 0) return null;
	const previous = stories[index - 1];
	if (!isStoryCompleted(user, previous.id)) return 'progression';

	return null;
}

export function getStoryTitle(story: StoryRecord): string {
	const value = story[STORY_FIELDS.title];
	return typeof value === 'string' ? value : '';
}

// `description` (histoires) and `texte` (pages_histoires) are PocketBase
// rich-text fields (real HTML like "<p>...</p>"), authored by Nargis in
// the PocketBase admin — safe to render as HTML, unlike arbitrary user
// input.
export function getStoryDescriptionHtml(story: StoryRecord): string {
	const value = story[STORY_FIELDS.description];
	return typeof value === 'string' ? value : '';
}

export function getSceneTextHtml(scene: SceneRecord): string {
	const value = scene[SCENE_FIELDS.text];
	return typeof value === 'string' ? value : '';
}

export function getStoryDifficulty(story: StoryRecord): string {
	const value = story[STORY_FIELDS.difficulty];
	return typeof value === 'string' ? value : '';
}

function resolveFileUrl(record: RecordModel, field: string): string | null {
	const value = record[field];
	if (!value || typeof value !== 'string') return null;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getStoryImageUrl(story: StoryRecord): string | null {
	return resolveFileUrl(story, STORY_FIELDS.image);
}

export function getSceneImageUrl(scene: SceneRecord): string | null {
	return resolveFileUrl(scene, SCENE_FIELDS.image);
}
