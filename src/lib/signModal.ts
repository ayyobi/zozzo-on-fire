// Controller for the shared <SignModal /> component. A page includes the
// component once, calls initSignModal(), and gets back a `show(sign)`
// function to wire up on dictionary card clicks.
//
// The video is only loaded once a sign is actually opened (the <video src>
// is written to the DOM here, not ahead of time), so the grid itself never
// downloads video data.
import { getSignById, getSignVideoUrl, getSignWord, isSignLocked, isGifUrl, type SignRecord } from './dictionary';
import type { ZozzoUser } from './pocketbase';

export function initSignModal(getUser: () => ZozzoUser | null) {
	const modal = document.getElementById('sign-modal');
	const panel = document.getElementById('sign-modal-panel');
	const title = document.getElementById('sign-modal-title');
	const body = document.getElementById('sign-modal-body');
	const closeBtn = document.getElementById('sign-modal-close');

	if (!modal || !panel || !title || !body || !closeBtn) {
		return { show: async () => {}, close: () => {} };
	}

	let lastFocused: HTMLElement | null = null;
	let savedScrollY = 0;

	function lockScroll() {
		savedScrollY = window.scrollY;
		document.body.style.position = 'fixed';
		document.body.style.top = `-${savedScrollY}px`;
		document.body.style.left = '0';
		document.body.style.right = '0';
	}

	function unlockScroll() {
		document.body.style.position = '';
		document.body.style.top = '';
		document.body.style.left = '';
		document.body.style.right = '';
		window.scrollTo(0, savedScrollY);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function open() {
		lastFocused = document.activeElement as HTMLElement;
		modal!.classList.remove('hidden');
		modal!.classList.add('flex');
		lockScroll();
		requestAnimationFrame(() => {
			modal!.classList.remove('opacity-0');
			panel!.classList.remove('scale-95');
		});
		closeBtn!.focus();
		document.addEventListener('keydown', onKeydown);
	}

	function close() {
		modal!.classList.add('opacity-0');
		panel!.classList.add('scale-95');
		document.removeEventListener('keydown', onKeydown);
		window.setTimeout(() => {
			modal!.classList.add('hidden');
			modal!.classList.remove('flex');
			body!.innerHTML = '';
			unlockScroll();
			lastFocused?.focus();
		}, 200);
	}

	closeBtn.addEventListener('click', close);
	modal.addEventListener('click', (e) => {
		if (e.target === modal) close();
	});

	async function show(signOrId: SignRecord | string) {
		title!.textContent = '';
		body!.innerHTML = '<p class="py-8 text-center text-sm text-neutral-500">Chargement...</p>';
		open();

		try {
			const sign = typeof signOrId === 'string' ? await getSignById(signOrId) : signOrId;
			title!.textContent = getSignWord(sign) || 'Signe';

			if (isSignLocked(sign, getUser())) {
				body!.innerHTML = `
					<div class="flex flex-col items-center gap-4 py-4 text-center">
						<p class="text-4xl" aria-hidden="true">🔒</p>
						<p class="text-sm text-neutral-600">Ce signe fait partie du contenu Premium.</p>
						<a href="/abonnement" class="rounded-full bg-[var(--color-coral)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">Découvrir Premium</a>
					</div>
				`;
				return;
			}

			// A <video> element can't play a .gif — some signs have one
			// uploaded in the video field instead of a real video file.
			const videoUrl = getSignVideoUrl(sign);
			body!.innerHTML = !videoUrl
				? '<p class="py-8 text-center text-sm text-neutral-500">Vidéo non disponible pour ce signe.</p>'
				: isGifUrl(videoUrl)
					? `<img src="${videoUrl}" alt="" class="w-full rounded-2xl bg-black object-contain" style="max-height:60vh" />`
					: `<video src="${videoUrl}" controls autoplay playsinline class="w-full rounded-2xl bg-black" style="max-height:60vh"></video>`;
		} catch {
			title!.textContent = 'Signe';
			body!.innerHTML =
				'<p class="py-8 text-center text-sm text-red-600">Impossible de charger ce signe pour le moment.</p>';
		}
	}

	return { show, close };
}
