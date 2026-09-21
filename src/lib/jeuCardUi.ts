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

const LOCK_SVG = `
	<svg width="34" height="54" viewBox="0 0 40 64" fill="none" class="drop-shadow-md" aria-hidden="true">
		<path d="M5 30V21C5 10 11 3 20 3S35 10 35 21V30" stroke="#fff000" stroke-width="3" />
		<path d="M5 30V21C5 10 11 3 20 3S35 10 35 21V30" stroke="#2453f5" stroke-width="1" />
		<path d="M2 29H38V62H2Z" fill="#fff000" stroke="#e3ca00" />
		<path d="M24 43a4 4 0 1 0-7 2l-2 9h10l-2-9a4 4 0 0 0 1-2Z" fill="#2453f5" />
	</svg>
`;

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
		? `style="background-image: url(${escapeHtml(JSON.stringify(imageUrl))}); background-size: cover; background-position: center; background-repeat: no-repeat;"`
		: '';

	const lockOverlay = !open
		? `<span class="pointer-events-none absolute inset-0 z-10 grid place-items-center [&_svg]:h-[42px] [&_svg]:w-[26px] sm:[&_svg]:h-[54px] sm:[&_svg]:w-[34px]" aria-hidden="true">${LOCK_SVG}</span>`
		: '';

	return `
		<div class="relative w-full">
			<${tag} ${attrs} ${background} data-jeu-card
				class="group relative flex min-h-[74px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[26px] bg-[#84a2ef] px-[12%] py-3 text-center text-[#2855dc] sm:aspect-[5.385/1] sm:min-h-[100px] sm:rounded-[38px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#2855dc] motion-safe:transition-transform motion-safe:hover:scale-[1.015] motion-safe:active:scale-[0.99]"
			>
				<span class="relative flex min-w-0 flex-col gap-2 sm:gap-3">
					<span class="text-[16px] leading-tight font-normal sm:text-[24px]">${title}</span>
					${description ? `<span class="text-[13px] leading-snug sm:text-[18px]">${description}</span>` : ''}
				</span>
				${lockOverlay}
			</${tag}>
		</div>
	`;
}
