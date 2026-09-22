/** Keep section links aligned while the app's asynchronous content appears. */
export function initAppSectionNavigation(header: HTMLElement) {
	const ids = ['histoires', 'lecons', 'cahier', 'jeux'];
	const sections = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
	let target: HTMLElement | null = null;
	let frame = 0;
	const isHome = () => location.pathname.replace(/\/+$/, '') === '/app';
	function align() {
		frame = 0;
		if (!target || document.getElementById('loading')?.classList.contains('hidden') === false) return;
		const top = window.scrollY + target.getBoundingClientRect().top - header.getBoundingClientRect().height;
		window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
	}
	function schedule() {
		if (target && !frame) frame = requestAnimationFrame(align);
	}
	function followHash() {
		target = isHome() ? sections.find(section => `#${section.id}` === location.hash) ?? null : null;
		schedule();
	}
	if (sections.length) {
		const resize = new ResizeObserver(schedule);
		for (const element of [header, document.getElementById('app-content'), ...sections]) {
			if (element) resize.observe(element);
		}
		const loading = document.getElementById('loading');
		if (loading) new MutationObserver(schedule).observe(loading, { attributes: true, attributeFilter: ['class'] });
		// Once the reader interacts, never pull them back to the previous anchor.
		for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
			window.addEventListener(type, () => { target = null; }, { passive: true });
		}
		window.addEventListener('hashchange', followHash);
		window.addEventListener('pageshow', followHash);
		followHash();
	}
	return (href: string) => {
		const url = new URL(href, location.href);
		if (url.origin === location.origin && url.pathname.replace(/\/+$/, '') === '/app' && isHome() && ids.includes(url.hash.slice(1))) {
			if (location.hash !== url.hash) history.pushState(null, '', url.hash);
			followHash();
		} else {
			location.href = href;
		}
	};
}
