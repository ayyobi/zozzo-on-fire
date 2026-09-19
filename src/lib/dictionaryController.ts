// Shared search/render wiring for both the mini "Dico" panel (app home)
// and the full /dictionnaire page — same behaviour, different amount of
// results and an optional category filter.
import { searchSigns, type SignRecord } from './dictionary';
import { renderSignCardHTML } from './dictionaryUi';
import type { ZozzoUser } from './pocketbase';

export interface DictionaryControllerOptions {
	searchInput: HTMLInputElement;
	resultsEl: HTMLElement;
	statusEl: HTMLElement;
	categorySelect?: HTMLSelectElement | null;
	limit: number;
	getUser: () => ZozzoUser | null;
	onCardClick: (sign: SignRecord) => void;
}

export function attachDictionaryController(opts: DictionaryControllerOptions) {
	let debounceTimer: number | undefined;
	let currentSigns: SignRecord[] = [];
	let requestId = 0;

	async function runSearch() {
		const thisRequest = ++requestId;
		opts.statusEl.textContent = 'Chargement...';
		opts.statusEl.classList.remove('hidden');
		opts.resultsEl.innerHTML = '';

		try {
			const signs = await searchSigns(opts.searchInput.value, {
				categoryId: opts.categorySelect?.value || undefined,
				limit: opts.limit,
			});

			if (thisRequest !== requestId) return; // a newer search already started

			currentSigns = signs;

			if (signs.length === 0) {
				opts.statusEl.textContent = 'Aucun signe trouvé.';
				opts.statusEl.classList.remove('hidden');
				return;
			}

			opts.statusEl.classList.add('hidden');
			opts.resultsEl.innerHTML = signs.map((s) => renderSignCardHTML(s, opts.getUser())).join('');
			opts.resultsEl.querySelectorAll<HTMLButtonElement>('[data-sign-id]').forEach((btn) => {
				btn.addEventListener('click', () => {
					const sign = currentSigns.find((s) => s.id === btn.dataset.signId);
					if (sign) opts.onCardClick(sign);
				});
			});
		} catch {
			if (thisRequest !== requestId) return;
			opts.statusEl.textContent = 'Impossible de charger le dictionnaire pour le moment.';
			opts.statusEl.classList.remove('hidden');
		}
	}

	opts.searchInput.addEventListener('input', () => {
		window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(runSearch, 250);
	});
	opts.categorySelect?.addEventListener('change', runSearch);

	runSearch();

	return { refresh: runSearch };
}
