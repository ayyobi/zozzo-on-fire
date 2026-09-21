// Data layer for `progression` — CONFIRMED fields (given directly by
// Nargis, not guessed): utilisateur (relation -> users), lecon (relation
// -> lecons), termine (bool), pourcentage (number 0-100), etoiles (number),
// score (number), date_completion (date).
//
// One row per (utilisateur, lecon) pair, ever — replaying a lesson updates
// the existing row instead of creating a duplicate (see saveLessonProgress).
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const PROGRESSION_FIELDS = {
	user: 'utilisateur',
	lesson: 'lecon',
	done: 'termine',
	percent: 'pourcentage',
	stars: 'etoiles',
	score: 'score',
	completedAt: 'date_completion',
} as const;

export interface ProgressionRecord extends RecordModel {
	[key: string]: unknown;
}

export interface LessonResult {
	done: boolean;
	percent: number;
	stars: number;
	score: number;
}

async function findProgression(userId: string, lessonId: string): Promise<ProgressionRecord | null> {
	try {
		return await pb.collection('progression').getFirstListItem<ProgressionRecord>(
			pb.filter(`${PROGRESSION_FIELDS.user} = {:user} && ${PROGRESSION_FIELDS.lesson} = {:lesson}`, {
				user: userId,
				lesson: lessonId,
			}),
		);
	} catch {
		return null;
	}
}

// Upserts the user's result for one lesson. A replay only overwrites the
// previous percent/etoiles/score when the new attempt is actually better,
// so a worse retry never erases a good result (per the brief: "conserver
// de préférence le meilleur résultat"). `termine` stays true once reached,
// even if a later replay is abandoned early.
export async function saveLessonProgress(userId: string, lessonId: string, result: LessonResult): Promise<void> {
	const existing = await findProgression(userId, lessonId);

	const payload = {
		[PROGRESSION_FIELDS.user]: userId,
		[PROGRESSION_FIELDS.lesson]: lessonId,
		[PROGRESSION_FIELDS.done]: result.done || existing?.[PROGRESSION_FIELDS.done] === true,
		[PROGRESSION_FIELDS.percent]: Math.max(result.percent, Number(existing?.[PROGRESSION_FIELDS.percent] ?? 0)),
		[PROGRESSION_FIELDS.stars]: Math.max(result.stars, Number(existing?.[PROGRESSION_FIELDS.stars] ?? 0)),
		[PROGRESSION_FIELDS.score]: Math.max(result.score, Number(existing?.[PROGRESSION_FIELDS.score] ?? 0)),
		[PROGRESSION_FIELDS.completedAt]: new Date().toISOString(),
	};

	if (existing) {
		await pb.collection('progression').update(existing.id, payload);
	} else {
		await pb.collection('progression').create(payload);
	}
}
