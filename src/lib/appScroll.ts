import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

/** Smooth vertical wheel input over carousels; touch and horizontal gestures stay native. */
export function initAppScroll() {
	gsap.registerPlugin(ScrollToPlugin);
	const rows = document.querySelectorAll<HTMLElement>('#stories-viewport, #lessons-flow, #cahier-flow');
	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
	let tween: gsap.core.Tween | undefined;
	let destination = window.scrollY;
	const stop = () => {
		tween?.kill();
		tween = undefined;
	};
	function wheel(event: WheelEvent) {
		if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.shiftKey ||
			reducedMotion.matches || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
			stop();
			return;
		}
		if (getComputedStyle(document.body).position === 'fixed' || getComputedStyle(document.body).overflowY === 'hidden') return;
		const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
		const delta = event.deltaY * unit;
		const base = tween?.isActive() && (destination - window.scrollY) * delta >= 0 ? destination : window.scrollY;
		const next = Math.max(0, Math.min(maximum, base + delta));
		if (Math.abs(next - window.scrollY) < 1) { stop(); return; }
		event.preventDefault();
		stop();
		destination = next;
		tween = gsap.to(window, {
			duration: 0.3,
			ease: 'power2.out',
			scrollTo: { y: destination, autoKill: true },
			onComplete: () => { tween = undefined; },
		});
	}
	for (const row of rows) row.addEventListener('wheel', wheel, { passive: false });
	// Cancel immediately when another input or the navigation takes over.
	for (const type of ['touchstart', 'pointerdown', 'keydown', 'hashchange']) {
		window.addEventListener(type, stop, { passive: true });
	}
	const outsideWheel = (event: WheelEvent) => {
		if (!(event.target instanceof Element) || !event.target.closest('#stories-viewport, #lessons-flow, #cahier-flow')) stop();
	};
	window.addEventListener('wheel', outsideWheel, { passive: true });
	reducedMotion.addEventListener('change', stop);
	document.addEventListener('astro:before-swap', () => {
		stop();
		for (const row of rows) row.removeEventListener('wheel', wheel);
		for (const type of ['touchstart', 'pointerdown', 'keydown', 'hashchange']) window.removeEventListener(type, stop);
		window.removeEventListener('wheel', outsideWheel);
		reducedMotion.removeEventListener('change', stop);
	}, { once: true });
}
