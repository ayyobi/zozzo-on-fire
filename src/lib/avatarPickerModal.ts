// Controller for the shared <AvatarPickerModal />. Selecting an avatar
// saves it immediately (single click, no separate "confirm" step — kept
// simple for a kids' app) via updateAvatar(), which only ever sends the
// `avatar` field.
import { listSelectableAvatars, getAvatarImageUrl, type AvatarRecord } from './avatars';
import { getCurrentUser, updateAvatar } from './pocketbase';

export function initAvatarPicker(onSelected: (avatar: AvatarRecord) => void) {
	const modal = document.getElementById('avatar-modal');
	const panel = document.getElementById('avatar-modal-panel');
	const grid = document.getElementById('avatar-modal-grid');
	const status = document.getElementById('avatar-modal-status');
	const closeBtn = document.getElementById('avatar-modal-close');

	if (!modal || !panel || !grid || !status || !closeBtn) {
		return { open: async () => {}, close: () => {} };
	}

	let loaded = false;
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

	function show() {
		modal!.classList.remove('hidden');
		modal!.classList.add('flex');
		lockScroll();
		requestAnimationFrame(() => {
			modal!.classList.remove('opacity-0');
			panel!.classList.remove('scale-95');
		});
		document.addEventListener('keydown', onKeydown);
	}

	function close() {
		modal!.classList.add('opacity-0');
		panel!.classList.add('scale-95');
		document.removeEventListener('keydown', onKeydown);
		window.setTimeout(() => {
			modal!.classList.add('hidden');
			modal!.classList.remove('flex');
			unlockScroll();
		}, 200);
	}

	closeBtn.addEventListener('click', close);
	modal.addEventListener('click', (e) => {
		if (e.target === modal) close();
	});

	async function loadGrid() {
		status!.textContent = 'Chargement...';
		status!.classList.remove('hidden');

		try {
			const avatars = await listSelectableAvatars();

			if (avatars.length === 0) {
				status!.textContent = 'Aucun avatar disponible pour le moment.';
				return;
			}

			status!.classList.add('hidden');
			grid!.innerHTML = avatars
				.map((a) => {
					const url = getAvatarImageUrl(a);
					const img = url
						? `<img src="${url}" alt="" class="h-full w-full object-contain" />`
						: '';
					return `
						<button type="button" data-avatar-id="${a.id}" aria-label="${a.nom}"
							class="avatar-option flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border-2 border-transparent bg-neutral-50 p-1.5 transition hover:scale-105 hover:border-[var(--color-royal-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-coral)] disabled:opacity-50">
							${img}
						</button>
					`;
				})
				.join('');

			grid!.querySelectorAll<HTMLButtonElement>('[data-avatar-id]').forEach((btn) => {
				btn.addEventListener('click', async () => {
					const avatarId = btn.dataset.avatarId;
					const user = getCurrentUser();
					if (!avatarId || !user) return;

					grid!.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
					status!.classList.add('hidden');

					try {
						await updateAvatar(user.id, avatarId);
						const updated = getCurrentUser();
						const chosen = updated?.expand?.avatar as AvatarRecord | undefined;
						if (chosen) onSelected(chosen);
						close();
					} catch {
						status!.textContent = "Impossible d'enregistrer l'avatar pour le moment.";
						status!.classList.remove('hidden');
					} finally {
						grid!.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false));
					}
				});
			});
		} catch {
			status!.textContent = 'Impossible de charger les avatars pour le moment.';
		}
	}

	async function open() {
		show();
		if (!loaded) {
			loaded = true;
			await loadGrid();
		}
	}

	return { open, close };
}
