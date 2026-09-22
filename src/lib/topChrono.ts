// Game logic for Top Chrono, built on `questions_jeux`.
//
// Field names CONFIRMED live via curl (see the report): actif,
// bonne_reponse, choix_1, choix_2, choix_3, choix_4, difficulte, id, jeu
// (a MULTI-relation array — one question can belong to several games at
// once), signe (relation to `signes`, sometimes empty), updated.
//
// `jeu` being multi-relation means "does this question belong to game X"
// needs the `~` (contains) operator, not a plain `=` (which expects an
// exact array match) — confirmed live: `?=` returned 0 results against
// real data, `~` correctly matched all 9 questions linked to Top Chrono.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';
import { getSignImageUrl, getSignVideoUrl, isGifUrl, SIGN_FIELDS, type SignRecord } from './dictionary';

export const QUESTION_FIELDS = {
	game: 'jeu',
	correct: 'bonne_reponse',
	choice1: 'choix_1',
	choice2: 'choix_2',
	choice3: 'choix_3',
	choice4: 'choix_4',
	sign: 'signe',
	active: 'actif',
} as const;

export const LEVELS = [15, 30, 50] as const;
export type Level = (typeof LEVELS)[number];

export interface GameQuestion {
	id: string;
	correctAnswer: string;
	options: string[];
	signImageUrl: string | null;
	signVideoUrl: string | null;
	// True when signVideoUrl is actually a .gif (some signs have one
	// uploaded in the video field instead of a real video) — a <video>
	// element can't play it, callers must render it as an <img> instead.
	signVideoIsGif: boolean;
}

function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// Draws up to `count` active questions for this game. There is no
// per-level field on `questions_jeux` — the 15/30/50 choice just caps how
// many questions get pulled from the pool, shuffled. If fewer active
// questions exist than requested, the round simply uses what's available
// (never throws/blocks play).
export async function fetchGameQuestions(jeuId: string, count: number): Promise<GameQuestion[]> {
	const rows = await pb.collection('questions_jeux').getFullList<RecordModel>({
		filter: pb.filter(`${QUESTION_FIELDS.game} ~ {:id} && ${QUESTION_FIELDS.active} = true`, { id: jeuId }),
		expand: QUESTION_FIELDS.sign,
	});

	// Filter before drawing so unfinished signs never take a question slot.
	const playableRows = rows.filter((row) => {
		const sign = row.expand?.[QUESTION_FIELDS.sign] as SignRecord | undefined;
		const video = sign?.[SIGN_FIELDS.video];
		return typeof video === 'string' && video.trim().length > 0;
	});

	return shuffle(playableRows)
		.slice(0, count)
		.map((row) => {
			const correctAnswer = String(row[QUESTION_FIELDS.correct] ?? '');
			const rawChoices = [row[QUESTION_FIELDS.choice1], row[QUESTION_FIELDS.choice2], row[QUESTION_FIELDS.choice3], row[QUESTION_FIELDS.choice4]].filter(
				(c): c is string => typeof c === 'string' && c.length > 0,
			);
			// choix_1..4 already include the correct answer as one of the 4
			// (confirmed in the live data). This just guards a malformed record.
			if (correctAnswer && !rawChoices.includes(correctAnswer)) rawChoices.push(correctAnswer);

			const sign = row.expand?.[QUESTION_FIELDS.sign] as SignRecord | undefined;
			const signVideoUrl = sign ? getSignVideoUrl(sign) : null;

			return {
				id: row.id,
				correctAnswer,
				options: shuffle(rawChoices),
				signImageUrl: sign ? getSignImageUrl(sign) : null,
				signVideoUrl,
				signVideoIsGif: signVideoUrl ? isGifUrl(signVideoUrl) : false,
			};
		});
}

export function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
