import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { STORY_SCENE_HEIGHT } from './storyLayout';

gsap.registerPlugin(ScrollTrigger);

/** Owns only this section's animation; never kills other page triggers. */
export function createStoryScroll(section: HTMLElement, viewport: HTMLElement) {
 const desktop = window.matchMedia('(min-width: 768px)');
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
 const header = document.querySelector<HTMLElement>('header');
 const home = document.getElementById('app-content');
 let tween: gsap.core.Tween | undefined;
 let sceneWidth = 0;
 let frame = 0;
 let disposed = false;
 let resumeProgress: number | null = null;

 function reset() {
  const trigger = tween?.scrollTrigger;
  if (trigger?.isActive) resumeProgress = trigger.progress;
  trigger?.kill();
  tween?.kill();
  tween = undefined;
  delete section.dataset.pinned;
 }
 function rebuild() {
  frame = 0;
  if (disposed || !sceneWidth || viewport.hidden) return;
  reset();
  const headerHeight = header?.getBoundingClientRect().height ?? 54;
  const headingHeight = section.querySelector('h2')!.getBoundingClientRect().height;
  const scale = desktop.matches ? 1.15 : Math.min(.78, Math.max(.55, (window.innerWidth - 48) / 434));
  section.style.setProperty('--story-unit', scale + 'px');
  section.style.setProperty('--story-header', headerHeight + 'px');
  section.style.setProperty('--story-scene-width', String(sceneWidth));
  section.style.scrollMarginTop = headerHeight + 'px';
  const distance = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  // Wait until the auth-controlled home is visible so pin positions are real.
  if (!desktop.matches || reduced.matches || STORY_SCENE_HEIGHT * scale + headingHeight + headerHeight > window.innerHeight || distance() <= 1 || home?.classList.contains('hidden')) {
   resumeProgress = null;
   return;
  }
  section.dataset.pinned = '';
  const progress = resumeProgress;
  resumeProgress = null;
  viewport.scrollLeft = 0;
  tween = gsap.fromTo(viewport, { scrollLeft: 0 }, {
   scrollLeft: distance,
   ease: 'none',
   scrollTrigger: {
    trigger: section,
    start: () => 'top ' + (header?.getBoundingClientRect().height ?? 54),
    end: () => '+=' + distance(),
    pin: true,
    pinSpacing: true,
    scrub: .6,
    invalidateOnRefresh: true,
   },
  });
  ScrollTrigger.refresh();
  if (progress !== null && tween.scrollTrigger) {
   const trigger = tween.scrollTrigger;
   window.scrollTo({top: trigger.start + progress * (trigger.end - trigger.start), behavior: 'instant'});
   ScrollTrigger.update();
   tween.progress(progress);
  }
 }
 function refresh() {
  if (!disposed && !frame) frame = requestAnimationFrame(rebuild);
 }
 function onFocus(event: FocusEvent) {
  const card = (event.target as Element).closest<HTMLElement>('[data-story-card]');
  // Moving a card between pointerdown and click would swallow mouse/touch clicks.
  // Only keyboard focus should advance the panorama automatically.
  if (!card || !card.matches(':focus-visible')) return;
  const slot = card.parentElement!;
  const max = viewport.scrollWidth - viewport.clientWidth;
  const target = Math.max(0, Math.min(max, slot.offsetLeft - (viewport.clientWidth - slot.offsetWidth) / 2));
  const trigger = tween?.scrollTrigger;
  if (trigger && max > 0) {
   const progress = target / max;
   window.scrollTo({top: trigger.start + progress * (trigger.end - trigger.start), behavior: 'instant'});
   ScrollTrigger.update();
   tween?.progress(progress);
  } else viewport.scrollTo({left: target, behavior: 'instant'});
 }
 viewport.addEventListener('focusin', onFocus);
 window.addEventListener('resize', refresh);
 desktop.addEventListener('change', refresh);
 reduced.addEventListener('change', refresh);
 const observer = new ResizeObserver(refresh);
 if (home) observer.observe(home);
 if (header) observer.observe(header);
 return {
  reset,
  layout(width: number) { sceneWidth = width; refresh(); },
  refresh,
  destroy() {
   disposed = true;
   cancelAnimationFrame(frame);
   reset();
   observer.disconnect();
   viewport.removeEventListener('focusin', onFocus);
   window.removeEventListener('resize', refresh);
   desktop.removeEventListener('change', refresh);
   reduced.removeEventListener('change', refresh);
  },
 };
}
