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
	<svg width="124" height="200" viewBox="0 0 40 64" fill="none" aria-hidden="true">
		<path d="M4 30L5 20C6 10 11 4 20 2C29 4 34 11 35 21L36 31" stroke="#2453f5" stroke-width="3" />
		<path d="M4 30L5 20C6 10 11 4 20 2C29 4 34 11 35 21L36 31" stroke="#fff000" stroke-width="1.5" />
		<path d="M2 29L38 30L37 62L2 61Z" fill="#fff000" stroke="#2453f5" stroke-width="1.1" />
		<path d="M24 43a4 4 0 1 0-7 2l-2 9h10l-2-9a4 4 0 0 0 1-2Z" fill="#2453f5" />
	</svg>
`;

export function renderStoryCardHTML(story: StoryRecord, index: number, lockReason: LockReason): string {
	const variant = getStoryVariant(index);
	const title = escapeHtml(getStoryTitle(story) || '—');
	const imageUrl = getStoryImageUrl(story);
	const locked = lockReason !== null;

	let tag: string;
	let attrs: string;
	if (!locked) {
		tag = 'a';
		attrs = `href="/app/histoires/${encodeURIComponent(story.id)}" aria-label="${title}"`;
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
		? `<img src="${escapeHtml(imageUrl)}" alt="" class="story-illustration" decoding="async" />`
		: `<span class="story-image-fallback" aria-hidden="true">📖</span>`;

	const lockOverlay = locked
		? `<span class="story-padlock" aria-hidden="true">${LOCK_SVG}</span>`
		: '';

	return `
		<div class="story-card-slot" style="left:calc(${variant.x} * var(--story-unit));top:calc(${variant.y} * var(--story-unit));width:calc(${variant.width} * var(--story-unit));height:calc(${variant.height} * var(--story-unit));--story-bg:${variant.bg};--story-ink:${variant.titleColor};">
			<${tag} ${attrs} data-story-card
				class="story-card story-card--${variant.layout}${locked ? ' is-locked' : ''}"
			>
				${img}
				${lockOverlay}
				<span class="story-card-title">
					${title}
				</span>
			</${tag}>
		</div>
	`;
}
