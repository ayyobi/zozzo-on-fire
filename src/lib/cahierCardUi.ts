// Renders one Cahier card for the home section: image on top, title below,
// same padlock as BonusBar/Histoires/Leçons for visual consistency.
// Premium cahiers stay visible (illustration + title always shown) with
// the lock overlaid — never replaced by a grey placeholder.
//
// Plain TS render function, not a literal `CahierCard.astro`, for the same
// reason as lessonCardUi.ts: the data comes from a client-side PocketBase
// fetch (auth-gated, no SSR).
import { CAHIER_FIELDS, getCahierImageUrl, getCahierTitle, type CahierRecord } from './cahiers';

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

export function renderCahierCardHTML(cahier: CahierRecord, open: boolean): string {
	const title = escapeHtml(getCahierTitle(cahier) || '—');
	const imageUrl = getCahierImageUrl(cahier);
	const slugValue = cahier[CAHIER_FIELDS.slug];
	const slug = typeof slugValue === 'string' && slugValue ? slugValue : cahier.id;

	const tag = open ? 'a' : 'button';
	const attrs = open
		? `href="/cahiers/${encodeURIComponent(slug)}"`
		: `type="button" data-locked-cahier aria-label="${title} (verrouillé)"`;

	const img = imageUrl
		? `<img src="${escapeHtml(imageUrl)}" alt="${open ? title : ''}" class="cahier-card-image size-full object-contain p-3" loading="lazy" />`
		: `<span class="text-4xl" aria-hidden="true">📖</span>`;

	const lockOverlay = !open
		? `<span class="absolute inset-0 grid place-items-center bg-black/10 [&_svg]:h-20 [&_svg]:w-[50px]" aria-hidden="true">${LOCK_SVG}</span>`
		: '';

	return `
		<div class="w-40 shrink-0 snap-start sm:w-48">
			<${tag} ${attrs} data-cahier-card
				class="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-lg transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe800] active:scale-95 ${open ? '' : 'opacity-90 [&_.cahier-card-image]:grayscale [&_.cahier-card-image]:opacity-70'}"
			>
				<span class="relative flex h-28 items-center justify-center bg-[var(--color-pale-pink)] sm:h-32">
					${img}
					${lockOverlay}
				</span>
				<span class="flex-1 px-3 py-3 text-center text-sm font-semibold text-[#2854d7] sm:text-base">
					${title}
				</span>
			</${tag}>
		</div>
	`;
}
