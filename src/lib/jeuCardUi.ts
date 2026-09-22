// Renders one Mini-jeux card for the home section: large HORIZONTAL rounded
// card (not the vertical/square shape used by Histoires/Leçons/Cahier),
// blue background, full-card decoration, centered title and description.
//
// Plain TS render function, not a literal `.astro` component — same reason
// as lessonCardUi.ts/cahierCardUi.ts: the data comes from a client-side
// PocketBase fetch, so it has to run after the page has already been built.
import { getJeuDescriptionHtml, getJeuImageUrl, getJeuTitle, type JeuRecord } from './jeux';

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

export function renderJeuCardHTML(jeu: JeuRecord, open: boolean): string {
	const title = escapeHtml(getJeuTitle(jeu) || '—');
	// Parse PocketBase rich text in an inert document, then escape plain text.
	// This decodes entities without injecting authored HTML into the card.
	const document = new DOMParser().parseFromString(getJeuDescriptionHtml(jeu), 'text/html');
	document.querySelectorAll('script,style,iframe,object').forEach(node => node.remove());
	const description = escapeHtml((document.body.textContent ?? '').trim());
	const imageUrl = getJeuImageUrl(jeu);
	const slug = typeof jeu.slug === 'string' ? jeu.slug : jeu.id;

	const tag = open ? 'a' : 'button';
	const attrs = open
		? `href="/app/jeux/${encodeURIComponent(slug)}"`
		: `type="button" data-locked-jeu aria-label="${title} (verrouillé)"`;

	const background = imageUrl
		? `<span class="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat ${open ? '' : 'grayscale opacity-30'}" style="background-image: url(${escapeHtml(JSON.stringify(imageUrl))});" aria-hidden="true"></span>`
		: '';
	const lock = !open ? `<span class="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-1/2 [&_img]:h-9 [&_img]:w-6 sm:[&_img]:h-11 sm:[&_img]:w-7" aria-hidden="true">${LOCK_IMAGE}</span>` : '';

	return `
		<div class="relative w-full">
			<${tag} ${attrs} data-jeu-card
				class="group relative flex min-h-[70px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[22px] px-[12%] py-3 text-center sm:aspect-[5.385/1] sm:min-h-[100px] sm:rounded-[38px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#2855dc] motion-safe:transition-transform motion-safe:hover:scale-[1.015] motion-safe:active:scale-[0.99] ${open ? 'bg-[#84a2ef] text-[#2855dc]' : 'bg-[#a9abb0] text-[#626367]'}"
			>
				${background}
				${lock}
				<span class="relative z-10 flex min-w-0 flex-col items-center gap-2 sm:gap-3">
					<span class="text-[16px] leading-tight font-normal sm:text-[24px]">${title}</span>
					${description ? `<span class="text-[13px] leading-snug sm:text-[18px]">${description}</span>` : ''}
				</span>
			</${tag}>
		</div>
	`;
}
