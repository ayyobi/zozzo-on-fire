// Renders one Cahier card for the home section: image on top, title below,
// same padlock as BonusBar/Histoires/Leçons for visual consistency.
// Premium cahiers stay visible (illustration + title always shown) with
// the lock overlaid — never replaced by a grey placeholder.
//
// Plain TS render function, not a literal `CahierCard.astro`, for the same
// reason as lessonCardUi.ts: the data comes from a client-side PocketBase
// fetch (auth-gated, no SSR).
import { getCahierImageUrl, getCahierSlug, getCahierTitle, type CahierRecord } from './cahiers';

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

export function renderCahierCardHTML(cahier: CahierRecord, open: boolean): string {
	const title = escapeHtml(getCahierTitle(cahier) || '—');
	const imageUrl = getCahierImageUrl(cahier);
	const slug = getCahierSlug(cahier);

	const tag = open ? 'a' : 'button';
	const attrs = open
		? `href="/app/cahiers/${encodeURIComponent(slug)}"`
		: `type="button" data-locked-cahier aria-label="${title} (verrouillé)"`;

	const img = imageUrl
		? `<img src="${escapeHtml(imageUrl)}" alt="${open ? title : ''}" class="cahier-card-image size-full object-contain p-3" loading="lazy" />`
		: `<span class="text-4xl" aria-hidden="true">📖</span>`;

	const lockOverlay = !open
		? `<span class="absolute inset-0 grid place-items-center bg-black/10 [&_img]:h-20 [&_img]:w-[50px]" aria-hidden="true">${LOCK_IMAGE}</span>`
		: '';

	return `
		<div class="h-52 w-40 shrink-0 snap-start sm:h-56 sm:w-48">
			<${tag} ${attrs} data-cahier-card
				class="group flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-lg transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe800] active:scale-95 ${open ? '' : 'opacity-90 [&_.cahier-card-image]:grayscale [&_.cahier-card-image]:opacity-70'}"
			>
				<span class="relative flex h-28 items-center justify-center bg-[var(--color-pale-pink)] sm:h-32">
					${img}
					${lockOverlay}
				</span>
				<span class="flex flex-1 items-center justify-center px-3 py-3 text-center text-sm font-semibold text-[#2854d7] sm:text-base">
					${title}
				</span>
			</${tag}>
		</div>
	`;
}
