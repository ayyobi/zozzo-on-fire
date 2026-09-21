// Client-rendered cards in the illustrated panorama. Each layout preserves
// the cover's proportions and places its title according to the mockup.
//
// This is a plain TS render function rather than a literal
// `StoryCard.astro` component because the data it renders is fetched
// client-side (PocketBase, behind auth, no SSR) — an Astro component only
// ever runs at build time, so it can't receive a record fetched in the
// browser. Same pattern as dictionaryUi.ts elsewhere in this app.
import { getStoryImageUrl, getStoryTitle, type LockReason, type StoryRecord } from './stories';
import { getStoryVariant } from './storyLayout';

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

// Yellow/blue padlock with an irregular outline, matching the illustrated map.
const LOCK_SVG = `
	<svg class="block h-[calc(200*var(--story-unit))] w-[calc(124*var(--story-unit))] overflow-visible" width="124" height="200" viewBox="0 0 40 64" fill="none" aria-hidden="true">
		<path d="M4 30L5 20C6 10 11 4 20 2C29 4 34 11 35 21L36 31" stroke="#2453f5" stroke-width="3" />
		<path d="M4 30L5 20C6 10 11 4 20 2C29 4 34 11 35 21L36 31" stroke="#fff000" stroke-width="1.5" />
		<path d="M2 29L38 30L37 62L2 61Z" fill="#fff000" stroke="#2453f5" stroke-width="1.1" />
		<path d="M24 43a4 4 0 1 0-7 2l-2 9h10l-2-9a4 4 0 0 0 1-2Z" fill="#2453f5" />
	</svg>
`;

// Static utility strings let Tailwind discover every illustration layout.
const layoutClasses = {
	school: '[&_.story-illustration]:w-[120%] [&_.story-illustration]:h-auto [&_.story-illustration]:-left-[5%] [&_.story-illustration]:-top-[19%] [&_.story-card-title]:inset-x-[20%] [&_.story-card-title]:top-auto [&_.story-card-title]:bottom-[6%]',
	garden: '[&_.story-illustration]:top-[14%] [&_.story-illustration]:-left-[2%] [&_.story-illustration]:w-[108%] [&_.story-illustration]:h-auto [&_.story-padlock]:top-[49%]',
	sport: '[&_.story-illustration]:-top-[5%] [&_.story-illustration]:-left-[3%] [&_.story-illustration]:w-[106%] [&_.story-illustration]:h-auto [&_.story-card-title]:inset-x-[4%] [&_.story-card-title]:top-auto [&_.story-card-title]:bottom-[4%] [&_.story-padlock]:top-[40%]',
	sky: '[&_.story-illustration]:top-[20%] [&_.story-illustration]:-left-[3%] [&_.story-illustration]:w-[112%] [&_.story-illustration]:h-3/4 [&_.story-padlock]:top-[58%] [&_.story-padlock_svg]:w-[calc(104*var(--story-unit))] [&_.story-padlock_svg]:h-[calc(170*var(--story-unit))]',
	space: '[&_.story-illustration]:left-0 [&_.story-illustration]:-top-[4%] [&_.story-illustration]:w-[105%] [&_.story-illustration]:h-[110%] [&_.story-card-title]:top-[34%] [&_.story-card-title]:right-auto [&_.story-card-title]:left-[3%] [&_.story-card-title]:w-[29%] [&_.story-padlock]:left-[52%]',
};

export function renderStoryCardHTML(story: StoryRecord, index: number, lockReason: LockReason): string {
	const variant = getStoryVariant(index);
	const title = escapeHtml(getStoryTitle(story) || '—');
	const imageUrl = getStoryImageUrl(story);
	const locked = lockReason !== null;

	let tag: string;
	let attrs: string;
	if (!locked) {
		tag = 'a';
		attrs = `href="/app/histoires/lire?id=${encodeURIComponent(story.id)}" aria-label="${title}"`;
	} else if (lockReason === 'premium') {
		// Premium lock genuinely navigates to the subscription page —
		// distinct behaviour from a progression lock.
		tag = 'a';
		attrs = `href="/abonnement" aria-label="${title} (contenu Premium)"`;
	} else {
		tag = 'button';
		attrs = `type="button" data-locked-progression aria-label="${title} (verrouillée, termine l'histoire précédente)"`;
	}

	const img = imageUrl
		? `<img src="${escapeHtml(imageUrl)}" alt="" class="story-illustration pointer-events-none absolute size-full max-w-none object-contain" decoding="async" />`
		: `<span class="story-image-fallback grid h-4/5 place-items-center text-[64px]" aria-hidden="true">📖</span>`;

	const lockOverlay = locked
		? `<span class="story-padlock pointer-events-none absolute top-1/2 left-1/2 z-3 -translate-1/2" aria-hidden="true">${LOCK_SVG}</span>`
		: '';

	return `
		<div class="story-card-slot absolute left-[calc(var(--story-x)*var(--story-unit))] top-[calc(var(--story-y)*var(--story-unit))] w-[calc(var(--story-width)*var(--story-unit))] h-[calc(var(--story-height)*var(--story-unit))]" style="--story-x:${variant.x};--story-y:${variant.y};--story-width:${variant.width};--story-height:${variant.height};--story-bg:${variant.bg};--story-ink:${variant.titleColor};">
			<${tag} ${attrs} data-story-card
				class="story-card relative block size-full cursor-pointer rounded-[calc(28*var(--story-unit))] bg-[var(--story-bg)] text-[var(--story-ink)] no-underline focus-visible:outline-4 focus-visible:outline-offset-5 focus-visible:outline-[#fff000] hover:outline-2 hover:outline-offset-3 hover:outline-current ${layoutClasses[variant.layout]} ${locked ? 'is-locked [&_.story-illustration]:grayscale ' + (variant.layout === 'space' ? '[&_.story-illustration]:mix-blend-luminosity [&_.story-illustration]:opacity-50' : '[&_.story-illustration]:mix-blend-multiply [&_.story-illustration]:opacity-80') : ''}"
			>
				${img}
				${lockOverlay}
				<span class="story-card-title pointer-events-none absolute inset-x-3 top-[14px] z-2 text-center text-[max(18px,calc(37*var(--story-unit)))] leading-[1.2] font-normal">
					${title}
				</span>
			</${tag}>
		</div>
	`;
}
