// DOM rendering helpers shared between the mini dictionary panel (app home)
// and the full /dictionnaire page, so both stay visually identical without
// a duplicated template. Astro components only render server-side, so for
// data fetched client-side after login this plain-JS approach is used
// instead of a second ".astro" component that could never actually run in
// the browser.
import { getSignImageUrl, getSignWord, isSignLocked, type SignRecord } from './dictionary';
import type { ZozzoUser } from './pocketbase';

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

export function renderSignCardHTML(sign: SignRecord, user: ZozzoUser | null): string {
	const word = escapeHtml(getSignWord(sign) || '—');
	const imageUrl = getSignImageUrl(sign);
	const locked = isSignLocked(sign, user);

	const imgTag = imageUrl
		? `<img src="${imageUrl}" alt="Signe : ${word}" class="h-full w-full object-cover" loading="lazy" />`
		: `<span class="text-2xl" aria-hidden="true">🤟</span>`;

	const lockBadge = locked
		? `<span class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow" aria-hidden="true">🔒</span>`
		: '';

	return `
		<button type="button" data-sign-id="${sign.id}" data-locked="${locked ? '1' : '0'}"
			class="dico-card group relative flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--color-blue)] bg-white p-2 text-center transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-coral)]"
			aria-label="${locked ? `${word} (contenu Premium)` : word}">
			${lockBadge}
			<span class="flex h-16 w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--color-pale-pink)] sm:h-20">
				${imgTag}
			</span>
			<span class="text-sm font-medium text-neutral-800">${word}</span>
		</button>
	`;
}
