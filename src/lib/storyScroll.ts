// Sizes the Histoires panorama responsively (--story-unit) and lets it
// scroll like every other horizontal row in the app (Leçons/Cahier/
// Mini-jeux): native overflow-x-auto on #stories-viewport — drag/swipe/
// wheel/scrollbar, no scroll-jacking. An earlier version drove the
// horizontal position via a GSAP ScrollTrigger pin (vertical page scroll
// -> automatic horizontal pan) to match an early mockup; that felt buggy
// across devices/browsers, so it's gone — native scroll is far more
// reliable and matches the rest of the app.
/** Owns only this section's sizing; never touches scroll position. */
export function createStoryScroll(section: HTMLElement, viewport: HTMLElement) {
	const desktop = window.matchMedia('(min-width: 768px)');
	const header = document.querySelector<HTMLElement>('header');
	let disposed = false;
	let frame = 0;

	function rebuild() {
		frame = 0;
		if (disposed || viewport.hidden) return;
		const headerHeight = header?.getBoundingClientRect().height ?? 54;
		const scale = desktop.matches ? 0.95 : Math.min(0.78, Math.max(0.55, (window.innerWidth - 48) / 434));
		section.style.setProperty('--story-unit', scale + 'px');
		section.style.setProperty('--story-header', headerHeight + 'px');
		section.scrollMarginTop = headerHeight + 'px';
	}

	function refresh() {
		if (!disposed && !frame) frame = requestAnimationFrame(rebuild);
	}

	window.addEventListener('resize', refresh);
	desktop.addEventListener('change', refresh);
	const observer = new ResizeObserver(refresh);
	if (header) observer.observe(header);

	return {
		reset() {},
		layout(_width: number) { refresh(); },
		refresh,
		destroy() {
			disposed = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('resize', refresh);
			desktop.removeEventListener('change', refresh);
		},
	};
}
