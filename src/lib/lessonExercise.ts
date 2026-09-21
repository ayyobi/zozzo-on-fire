// Turns an ordered list of signs (from lessons.ts's listLessonSigns) into a
// quiz: each sign becomes one question, itself the correct answer, with up
// to 3 distractors drawn from the OTHER signs already curated for this
// same lesson (via lecon_signes) — never hardcoded, never from the whole
// dictionary. Kept separate from rendering per the brief's "data / display
// / interaction" split.
import { getSignWord, type SignRecord } from './dictionary';

export interface ExerciseQuestion {
	sign: SignRecord;
	options: SignRecord[];
}

function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function buildExerciseQuestions(signs: SignRecord[]): ExerciseQuestion[] {
	return signs.map((sign) => {
		const distractors = shuffle(signs.filter((s) => s.id !== sign.id)).slice(0, 3);
		return { sign, options: shuffle([sign, ...distractors]) };
	});
}

export function isCorrectOption(question: ExerciseQuestion, option: SignRecord): boolean {
	return option.id === question.sign.id;
}

export function getOptionLabel(option: SignRecord): string {
	return getSignWord(option) || '—';
}

export type ResultTier = 'excellent' | 'consolider' | 'revoir';

// 80–100% -> excellent, 50–79% -> consolider, 0–49% -> revoir (point 48).
export function getResultTier(correctCount: number, total: number): ResultTier {
	if (total === 0) return 'revoir';
	const pct = (correctCount / total) * 100;
	if (pct >= 80) return 'excellent';
	if (pct >= 50) return 'consolider';
	return 'revoir';
}

// Star count shown/saved for a result tier — used both on screen and as
// the `etoiles` value saved to `progression`.
export function getResultStars(tier: ResultTier): number {
	return { excellent: 3, consolider: 2, revoir: 1 }[tier];
}
