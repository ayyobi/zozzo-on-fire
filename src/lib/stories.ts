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
import illustrations from '../data/storyIllustrations.json';
import orderCorrections from '../data/storyOrderCorrections.json';
import type { SignRecord } from './dictionary';

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
	} catch (error) {
		if ((error as { status?: number }).status === 404) return null;
		throw error;
	}
}

export async function listScenes(storyId: string): Promise<SceneRecord[]> {
	const scenes = await pb.collection('pages_histoires').getFullList<SceneRecord>({
		filter: pb.filter(`${SCENE_FIELDS.story} = {:id}`, { id: storyId }),
		sort: SCENE_FIELDS.order,
		expand: 'signe_associe,signes_pages_histoires_via_page.signe',
	});
	// Temporary repair for the known negative order. The author confirmed the
	// ball illustration belongs on page 16. Valid server ordering stays authoritative.
	const correction = (orderCorrections as Record<string, { trigger: string; expectedOrder: number; orders: Record<string, number> }>)[storyId];
	if (correction && scenes.some(scene => scene.id === correction.trigger && scene.ordre === correction.expectedOrder)) {
		return scenes.map(scene => ({ ...scene, ordre: correction.orders[scene.id] ?? scene.ordre }))
			.sort((a, b) => Number(a.ordre) - Number(b.ordre));
	}
	return scenes;
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
// Jardin magique is available without completing the previous story.
// Other stories are progression-locked unless the previous story (by `ordre`)
// is marked done. The first story is never progression-locked. This reads
// position from the `stories` array itself (their real PocketBase order),
// except for the explicitly unlocked Jardin magique record.
export function getStoryLockReason(
	story: StoryRecord,
	index: number,
	stories: StoryRecord[],
	user: ZozzoUser | null,
): LockReason {
	const isPremiumStory = !!story[STORY_FIELDS.premium];
	if (isPremiumStory && user?.abonnement_actif !== true) return 'premium';

	// Shared by the catalogue and reader so direct links follow the same rule.
	if (story.id === '1a844mjzqx1uigg') return null;

	if (index === 0) return null;
	const previous = stories[index - 1];
	if (!previous || !isStoryCompleted(user, previous.id)) return 'progression';

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
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return pb.files.getURL(record, value);
}

export function getStoryImageUrl(story: StoryRecord): string | null {
	return resolveFileUrl(story, STORY_FIELDS.image);
}

export function getSceneImageUrl(scene: SceneRecord): string | null {
	return resolveFileUrl(scene, SCENE_FIELDS.image);
}

export interface SignPlacement {
	signe: string;
	x: number;
	y: number;
	width: number;
	height: number;
}
type Illustration = { type?: string; placements: SignPlacement[] };
function legacyIllustration(scene: SceneRecord): Illustration | undefined {
	return (illustrations as Record<string, Illustration>)[scene.id];
}

export function isRewardScene(scene: SceneRecord): boolean {
	return scene.type_page === 'recompense' || (!scene.type_page && legacyIllustration(scene)?.type === 'recompense');
}

export function getSceneSigns(scene: SceneRecord): Array<SignPlacement & { sign: SignRecord }> {
	const links = scene.expand?.signes_pages_histoires_via_page as RecordModel[] | undefined;
	const candidates = links?.length
		? [...links].sort((a, b) => Number(a.ordre) - Number(b.ordre)).map(link => ({ ...link, sign: link.expand?.signe as SignRecord }))
		: !scene.type_page ? (legacyIllustration(scene)?.placements ?? []).map(placement => ({
			...placement,
			// The legacy config only supplies geometry. PocketBase still authorizes the association.
			sign: (scene.expand?.signe_associe as SignRecord[] | undefined)?.find(sign => sign.id === placement.signe),
		})) : [];
	return candidates.filter((item) => item.sign &&
		[item.x, item.y, item.width, item.height].every(value => typeof value === 'number' && Number.isFinite(value)) &&
		item.x >= 0 && item.y >= 0 && item.width > 0 && item.height > 0 &&
		item.x + item.width <= 100 && item.y + item.height <= 100) as Array<SignPlacement & { sign: SignRecord }>;
}
