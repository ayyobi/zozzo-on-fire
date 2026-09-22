// Renders one Leçons card: dark-blue rounded card, illustration on top,
// title below (a classic card, deliberately different from the Histoires
// panorama cards — point 5 of the brief). Same padlock as
// BonusBar/Histoires so "locked" reads as one visual language app-wide.
//
// Plain TS render function, not a literal `LessonCard.astro`, for the same
// reason as storyCardUi.ts: the data comes from a client-side PocketBase
// fetch (auth-gated, no SSR), and an Astro component only ever runs at
// build time.
import { getLessonImageUrl, getLessonTitle, type LessonRecord } from './lessons';

function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

const LOCK_IMAGE = `<img src="/images/lock.svg" alt="" class="block object-contain drop-shadow-md" />`;

export function renderLessonCardHTML(lesson: LessonRecord, open: boolean): string {
	const rawTitle = getLessonTitle(lesson);
	const displayTitles: Record<string, string> = {
		'la rentree': 'Zozzo et sa rentrée au primaire',
		'jardin': 'Zozzo et son jardin magique',
	};
	const title = escapeHtml(displayTitles[rawTitle.toLowerCase().trim()] || rawTitle || '—');
	const imageUrl = getLessonImageUrl(lesson);

	const tag = open ? 'a' : 'button';
	const attrs = open
		? `href="/app/lecons/${encodeURIComponent(lesson.id)}"`
		: `type="button" data-locked-lesson aria-label="${title} (verrouillée)"`;

	const img = imageUrl
		? `<img src="${escapeHtml(imageUrl)}" alt="${open ? title : ''}" class="lesson-card-image size-full object-contain" loading="lazy" />`
		: `<span class="text-4xl" aria-hidden="true">📘</span>`;

	const lockOverlay = !open
		? `<span class="lesson-card-lock absolute inset-0 grid place-items-center [&_img]:h-28 [&_img]:w-[70px] max-md:[&_img]:h-[135px] max-md:[&_img]:w-[86px]" aria-hidden="true">${LOCK_IMAGE}</span>`
		: '';

	// Desktop cards are deliberately modest now (basis-[320px], wrapped in
	// LessonsSection.astro rather than forced onto one scrolling row) so
	// all lessons fit without a horizontal scrollbar. Mobile keeps the
	// larger single-row-scroll card from before — different problem
	// (legibility on a small screen), different fix.
	return `
		<div class="lesson-card-slot group/slot basis-[320px] max-md:basis-[min(92vw,440px)] shrink-0 grow-0 snap-start">
			<${tag} ${attrs} data-lesson-card
				class="lesson-card max-md:min-h-[440px] max-md:rounded-[32px] max-md:p-7 flex min-h-[420px] w-full cursor-pointer flex-col rounded-[28px] bg-[#2450cf] px-6 pt-6 pb-7 text-center text-[#fcdfd7] no-underline hover:outline-3 hover:-outline-offset-3 hover:outline-[#fcdfd7] ${open ? '' : ' lesson-card--locked [&_.lesson-card-image]:grayscale [&_.lesson-card-image]:opacity-70'}"
			>
				<span class="lesson-cover relative grid h-[260px] max-md:h-[300px] w-full place-items-center p-3 max-md:p-4">
					${img}
					${lockOverlay}
				</span>
				<span class="lesson-card-title block pt-3 text-[24px] max-md:pt-4 max-md:text-[28px] leading-[1.25] font-medium group-first/slot:text-[#53bba7]">
					${title}
				</span>
			</${tag}>
		</div>
	`;
}
