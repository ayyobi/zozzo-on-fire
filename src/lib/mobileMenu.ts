// Shared burger-menu behaviour for both the promo site's Header.astro and
// the app's AppHeader.astro: open/close state, the burger↔X morph, scroll
// locking, Escape-to-close, and the staggered link reveal. Only the
// markup/content differs between the two headers — this is the ~130 lines
// of identical behaviour extracted so it isn't duplicated per instruction
// #34 ("ne duplique pas le menu promo").
//
// Pairs with the global [data-mobile-burger] / [data-mobile-panel] CSS
// rules in src/styles/global.css.
export interface MobileMenuRefs {
	header: HTMLElement;
	burgerBtn: HTMLButtonElement;
	panel: HTMLElement;
}

export interface MobileMenuController {
	open: () => void;
	close: (onDone?: () => void) => void;
	isOpen: () => boolean;
	mobileLinks: HTMLElement[];
}

export function initMobileMenu({ header, burgerBtn, panel }: MobileMenuRefs): MobileMenuController {
	const mobileLinks = Array.from(panel.querySelectorAll<HTMLElement>('[data-mobile-link]'));

	let isOpen = false;
	let savedScrollY = 0;
	let closeTimers: number[] = [];

	function clearCloseTimers() {
		closeTimers.forEach((id) => window.clearTimeout(id));
		closeTimers = [];
	}

	function lockScroll() {
		savedScrollY = window.scrollY;
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.position = 'fixed';
		document.body.style.top = `-${savedScrollY}px`;
		document.body.style.left = '0';
		document.body.style.right = '0';
		if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
	}

	function unlockScroll() {
		document.body.style.position = '';
		document.body.style.top = '';
		document.body.style.left = '';
		document.body.style.right = '';
		document.body.style.paddingRight = '';
		window.scrollTo(0, savedScrollY);
	}

	function morphToX() {
		burgerBtn.setAttribute('data-open', 'true');
		header.setAttribute('data-menu-open', 'true');
	}

	function morphToBurger() {
		burgerBtn.setAttribute('data-open', 'false');
		header.setAttribute('data-menu-open', 'false');
	}

	function showLinks() {
		mobileLinks.forEach((el) => el.classList.remove('translate-y-full', 'opacity-0'));
	}

	function hideLinks() {
		mobileLinks.forEach((el) => el.classList.add('translate-y-full', 'opacity-0'));
	}

	function openMenu() {
		if (isOpen) return;
		clearCloseTimers();
		isOpen = true;
		burgerBtn.setAttribute('aria-expanded', 'true');
		burgerBtn.setAttribute('aria-label', 'Fermer le menu');

		morphToX();
		lockScroll();

		panel.classList.remove('hidden');
		panel.classList.add('flex');
		// Force layout so the closed state is committed before animating open.
		void panel.offsetHeight;

		requestAnimationFrame(() => {
			panel.setAttribute('data-open', 'true');
			showLinks();
		});
	}

	function closeMenu(onDone?: () => void) {
		if (!isOpen) return;
		isOpen = false;
		burgerBtn.setAttribute('aria-expanded', 'false');
		burgerBtn.setAttribute('aria-label', 'Ouvrir le menu');

		hideLinks();
		morphToBurger();

		const closePanel = window.setTimeout(() => {
			panel.setAttribute('data-open', 'false');
		}, 120);

		const finish = window.setTimeout(() => {
			panel.classList.remove('flex');
			panel.classList.add('hidden');
			unlockScroll();
			onDone?.();
		}, 520);

		closeTimers.push(closePanel, finish);
	}

	burgerBtn.addEventListener('click', () => (isOpen ? closeMenu() : openMenu()));

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen) closeMenu();
	});

	return { open: openMenu, close: closeMenu, isOpen: () => isOpen, mobileLinks };
}
