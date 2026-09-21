// Persisted global classement — a real `classement` collection (visible in
// PocketBase admin next to progression/scores), one row per user,
// recomputed and upserted every time that user finishes a lesson or a
// mini-jeu (see upsertClassementForUser, called from the Leçons and Top
// Chrono result screens). The ranking page just reads this table sorted
// by score — it no longer recomputes totals from progression+scores live
// on every page load.
//
// REQUIRES a `classement` collection created in PocketBase first (this
// code can't create collections — only the admin UI/a superuser can).
// Exact fields + API rules are in the report.
//
// `scores` field names (utilisateur, jeu, niveau, nombre_mots, score,
// temps_secondes, date_partie) are CONFIRMED live against the real API.
import { pb, getCurrentUser, type ZozzoUser } from './pocketbase';
import type { RecordModel } from 'pocketbase';
import { PROGRESSION_FIELDS } from './progression';
import { listLessons } from './lessons';
import { getAvatarImageUrl, resolveDisplayAvatar, type AvatarRecord } from './avatars';

export const CLASSEMENT_FIELDS = {
	user: 'utilisateur',
	scoreTotal: 'score_total',
	etoilesTotal: 'etoiles_total',
	progressPercent: 'progression_pourcentage',
	lessonsCompleted: 'lecons_terminees',
} as const;

const SCORE_FIELDS = { user: 'utilisateur', score: 'score' } as const;

export interface ClassementRecord extends RecordModel {
	[key: string]: unknown;
}

export interface RankingEntry {
	userId: string;
	pseudo: string;
	avatarUrl: string | null;
	scoreTotal: number;
	etoilesTotal: number;
	lessonsCompleted: number;
	progressPercent: number;
}

async function computeUserTotals(userId: string) {
	const [progressionRows, scoreRows, allLessons] = await Promise.all([
		pb.collection('progression').getFullList<RecordModel>({
			filter: pb.filter(`${PROGRESSION_FIELDS.user} = {:id}`, { id: userId }),
		}),
		pb.collection('scores').getFullList<RecordModel>({
			filter: pb.filter(`${SCORE_FIELDS.user} = {:id}`, { id: userId }),
		}),
		listLessons(),
	]);

	let scoreTotal = 0;
	let etoilesTotal = 0;
	const lessonIds = new Set<string>();
	for (const row of progressionRows) {
		scoreTotal += Number(row[PROGRESSION_FIELDS.score] ?? 0);
		etoilesTotal += Number(row[PROGRESSION_FIELDS.stars] ?? 0);
		if (row[PROGRESSION_FIELDS.done] === true) {
			const lessonId = row[PROGRESSION_FIELDS.lesson] as string | undefined;
			if (lessonId) lessonIds.add(lessonId);
		}
	}
	for (const row of scoreRows) {
		scoreTotal += Number(row[SCORE_FIELDS.score] ?? 0);
	}

	const totalLessons = allLessons.length;
	return {
		scoreTotal,
		etoilesTotal,
		lessonsCompleted: lessonIds.size,
		progressPercent: totalLessons > 0 ? Math.round((lessonIds.size / totalLessons) * 100) : 0,
	};
}

// Best-effort: recomputes ONE user's totals from their real progression +
// scores rows, then upserts their `classement` row (one per user, never
// duplicated). Called right after a lesson or mini-jeu result is saved —
// must never block that result screen if it fails (e.g. `classement`
// isn't created yet, or its API rules aren't open).
export async function upsertClassementForUser(userId: string): Promise<void> {
	const totals = await computeUserTotals(userId);

	let existing: ClassementRecord | null = null;
	try {
		existing = await pb
			.collection('classement')
			.getFirstListItem<ClassementRecord>(pb.filter(`${CLASSEMENT_FIELDS.user} = {:id}`, { id: userId }));
	} catch {
		existing = null;
	}

	const payload = {
		[CLASSEMENT_FIELDS.user]: userId,
		[CLASSEMENT_FIELDS.scoreTotal]: totals.scoreTotal,
		[CLASSEMENT_FIELDS.etoilesTotal]: totals.etoilesTotal,
		[CLASSEMENT_FIELDS.progressPercent]: totals.progressPercent,
		[CLASSEMENT_FIELDS.lessonsCompleted]: totals.lessonsCompleted,
	};

	if (existing) {
		await pb.collection('classement').update(existing.id, payload);
	} else {
		await pb.collection('classement').create(payload);
	}
}

// Reads the persisted table, sorted by score. Always includes the current
// user even if they have no row yet (e.g. right after signup), so "je
// suis dans quel range" always has an answer.
//
// Pseudo/avatar come from expanding `classement.utilisateur` into the
// `users` collection — requires `users`' own View/List rule to allow any
// authenticated player to read it (per Nargis's explicit call: "c'est pas
// grave si je vois le mail et l'age des user" — simpler than a dedicated
// public-fields-only view, at the cost of exposing email/age to other
// logged-in players too).
export async function buildRanking(): Promise<RankingEntry[]> {
	const rows = await pb.collection('classement').getFullList<ClassementRecord>({
		sort: `-${CLASSEMENT_FIELDS.scoreTotal}`,
		expand: `${CLASSEMENT_FIELDS.user}.avatar`,
	});

	const me = getCurrentUser();
	const entries: RankingEntry[] = [];
	for (const row of rows) {
		const userId = row[CLASSEMENT_FIELDS.user] as string;
		const expandedUser = row.expand?.[CLASSEMENT_FIELDS.user] as ZozzoUser | undefined;
		const isMe = userId === me?.id;
		const avatar = await resolveDisplayAvatar((expandedUser ?? (isMe ? me : undefined))?.expand?.avatar as AvatarRecord | undefined);
		entries.push({
			userId,
			pseudo: expandedUser?.pseudo || (isMe ? me?.pseudo : undefined) || 'Joueur ZOZZO',
			avatarUrl: getAvatarImageUrl(avatar),
			scoreTotal: Number(row[CLASSEMENT_FIELDS.scoreTotal] ?? 0),
			etoilesTotal: Number(row[CLASSEMENT_FIELDS.etoilesTotal] ?? 0),
			lessonsCompleted: Number(row[CLASSEMENT_FIELDS.lessonsCompleted] ?? 0),
			progressPercent: Number(row[CLASSEMENT_FIELDS.progressPercent] ?? 0),
		});
	}

	if (me && !entries.some((entry) => entry.userId === me.id)) {
		const avatar = await resolveDisplayAvatar(me.expand?.avatar as AvatarRecord | undefined);
		entries.push({
			userId: me.id,
			pseudo: me.pseudo || 'Joueur ZOZZO',
			avatarUrl: getAvatarImageUrl(avatar),
			scoreTotal: 0,
			etoilesTotal: 0,
			lessonsCompleted: 0,
			progressPercent: 0,
		});
	}

	return entries;
}
