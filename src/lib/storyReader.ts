import { checkAppSession, watchAppSession } from './appPage';
import { getCurrentUser, type ZozzoUser } from './pocketbase';
import { getSignVideoUrl, getSignImageUrl, getSignWord, isSignLocked } from './dictionary';
import { getStoryById, listStories, listScenes, getStoryLockReason, getStoryTitle,
	getSceneImageUrl, getSceneSigns, isRewardScene, markStoryCompleted, type SceneRecord } from './stories';

export async function initStoryReader() {
	const root = document.getElementById('story-content');
	if (!root) return;
	const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
	const image = el<HTMLImageElement>('story-image');
	const stage = el('story-stage');
	const signs = el('story-signs');
	const prev = el<HTMLButtonElement>('story-prev');
	const next = el<HTMLButtonElement>('story-next');
	const reward = el('story-reward');
	const navigation = el('story-navigation');
	let pages: SceneRecord[] = [];
	let rewardPage: SceneRecord | undefined;
	let index = 0;
	let moving = false;
	let saving = false;
	let saved = false;
	let user: ZozzoUser;
	const storyId = root.dataset.storyId || new URLSearchParams(location.search).get('id') || '';
	const clearVideos = () => {
		for (const video of signs.querySelectorAll('video')) {
			video.pause(); video.removeAttribute('src'); video.load();
		}
		signs.replaceChildren();
	};
	function resize() {
		// The overlay parent is exactly the rendered image, never the letterboxed viewport.
		const ratio = image.naturalWidth / image.naturalHeight || 2880 / 2048;
		stage.style.maxWidth = `${innerHeight * ratio}px`;
	}
	const fullscreen = el<HTMLButtonElement>('story-fullscreen');
	fullscreen.hidden = !document.fullscreenEnabled;
	fullscreen.addEventListener('click', async () => {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await root.requestFullscreen();
		} catch { fullscreen.hidden = true; }
	});
	document.addEventListener('fullscreenchange', () => {
		fullscreen.textContent = document.fullscreenElement ? '⛶ Quitter' : '⛶ Plein écran';
		resize();
	});

	// Prompts a phone-sized portrait viewport to rotate as soon as a story
	// opens. Real auto-rotate (fullscreen + orientation.lock) only works on
	// Android Chrome — iOS Safari has no orientation-lock API at all, so
	// there it's always a physical-rotate ask. Either way the overlay
	// dismisses itself once the viewport is actually landscape.
	const rotatePrompt = el('story-rotate-prompt');
	const rotateFullscreenBtn = el<HTMLButtonElement>('story-rotate-fullscreen');
	const rotateDismissBtn = el<HTMLButtonElement>('story-rotate-dismiss');
	const portraitPhone = matchMedia('(max-width: 900px) and (orientation: portrait)');
	let rotateDismissed = false;
	const supportsOrientationLock = typeof screen !== 'undefined' && !!screen.orientation && 'lock' in screen.orientation;
	rotateFullscreenBtn.hidden = !document.fullscreenEnabled;
	function updateRotatePrompt() {
		rotatePrompt.classList.toggle('hidden', rotateDismissed || !portraitPhone.matches);
	}
	portraitPhone.addEventListener('change', updateRotatePrompt);
	rotateDismissBtn.addEventListener('click', () => { rotateDismissed = true; updateRotatePrompt(); });
	rotateFullscreenBtn.addEventListener('click', async () => {
		try {
			await root.requestFullscreen();
			if (supportsOrientationLock) await (screen.orientation as ScreenOrientation & { lock(orientation: string): Promise<void> }).lock('landscape');
		} catch {
			// Best-effort — the overlay just stays up as a physical-rotate ask.
		}
	});
	image.addEventListener('load', () => {
		resize(); signs.classList.remove('hidden'); el('story-image-error').classList.add('hidden');
	});
	image.addEventListener('error', () => {
		signs.classList.add('hidden'); el('story-image-error').classList.remove('hidden');
	});
	el('story-image-retry').addEventListener('click', () => {
		const src = image.getAttribute('src');
		if (src) { image.removeAttribute('src'); image.src = src; }
	});
	window.addEventListener('resize', resize);

	function showMessage(message: string, retry = false, premium = false) {
		el('story-reader').classList.add('hidden');
		el('story-message').classList.remove('hidden');
		el('story-message-text').textContent = message;
		const link = el<HTMLAnchorElement>('story-message-link');
		link.href = retry ? location.href : premium ? '/abonnement' : '/app#histoires';
		link.textContent = retry ? 'Réessayer' : premium ? 'Découvrir Premium' : 'Retour aux histoires';
	}

	function render() {
		clearVideos();
		const finished = index === pages.length;
		const scene = finished ? rewardPage ?? pages[pages.length - 1] : pages[index];
		const url = scene ? getSceneImageUrl(scene) : null;
		signs.classList.add('hidden');
		el('story-image-error').classList.toggle('hidden', !!url);
		if (url) { image.src = url; el<HTMLImageElement>('story-backdrop').src = url; } else { image.removeAttribute('src'); el('story-backdrop').removeAttribute('src'); }
		image.alt = finished ? 'Récompense de fin d’histoire' : `${el('story-title').textContent} — page ${index + 1}`;
		navigation.classList.toggle('hidden', finished);
		reward.classList.toggle('hidden', !finished);
		prev.classList.toggle('invisible', index === 0);
		prev.disabled = index === 0;
		next.setAttribute('aria-label', index === pages.length - 1 ? 'Terminer' : 'Page suivante');
		el('story-progress').textContent = `${Math.min(index + 1, pages.length)} / ${pages.length}`;
		if (!finished && scene) {
			for (const placement of getSceneSigns(scene)) {
				const fragment = (el<HTMLTemplateElement>('sign-video-template')).content.cloneNode(true) as DocumentFragment;
				const box = fragment.firstElementChild as HTMLElement;
				Object.assign(box.style, { left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, height: `${placement.height}%` });
				const video = box.querySelector('video')!;
				const error = box.querySelector('[data-media-error]') as HTMLElement;
				const word = getSignWord(placement.sign);
				box.querySelector('[data-sign-label]')!.textContent = word;
				video.setAttribute('aria-label', `Signe LSF : ${word}`);
				video.muted = true;
				const locked = isSignLocked(placement.sign, user);
				const videoUrl = locked ? null : getSignVideoUrl(placement.sign);
				const fail = () => { video.classList.add('hidden'); error.classList.replace('hidden', 'grid'); };
				if (videoUrl) {
					video.src = videoUrl;
					const poster = getSignImageUrl(placement.sign);
					if (poster) video.poster = poster;
					video.addEventListener('error', fail, { once: true });
				} else {
					error.textContent = locked ? `${word} : signe Premium` : `${word} : vidéo à venir`;
					fail();
				}
				signs.append(fragment);
				if (videoUrl) void video.play().catch(() => { video.controls = true; });
			}
			const following = pages[index + 1];
			const followingUrl = following && getSceneImageUrl(following);
			if (followingUrl) { const preload = new Image(); preload.src = followingUrl; }
		}
		resize();
	}

	async function saveCompletion() {
		if (saving || saved) return;
		saving = true;
		el('story-save-retry').classList.add('hidden');
		el('story-save-status').textContent = 'Enregistrement de ta progression…';
		try {
			user = await markStoryCompleted(getCurrentUser() ?? user, storyId);
			saved = true;
			el('story-save-status').textContent = 'Ta progression est enregistrée.';
		} catch {
			el('story-save-status').textContent = 'Ta progression n’a pas pu être enregistrée. Tu peux réessayer.';
			el('story-save-retry').classList.remove('hidden');
		} finally { saving = false; }
	}

	async function go(target: number) {
		if (moving || target < 0 || target > pages.length || target === index) return;
		moving = true; prev.disabled = true; next.disabled = true;
		const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150;
		try {
			await stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }).finished;
			index = target; render();
			await stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration, fill: 'forwards' }).finished;
			if (index === pages.length) {
				el('reward-title').focus({ preventScroll: true });
				void saveCompletion();
			} else if (document.activeElement === el('story-replay')) next.focus({ preventScroll: true });
		} finally { moving = false; prev.disabled = index === 0; next.disabled = false; }
	}
	prev.addEventListener('click', () => void go(index - 1));
	next.addEventListener('click', () => void go(index + 1));
	el('story-replay').addEventListener('click', () => void go(0));
	el('story-save-retry').addEventListener('click', () => void saveCompletion());
	root.addEventListener('keydown', event => {
		if (index === pages.length || el('story-reader').classList.contains('hidden') || (event.target as HTMLElement).closest('video,input,textarea')) return;
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); void go(index + (event.key === 'ArrowRight' ? 1 : -1)); }
	});
	try {
		const session = await checkAppSession(el('network-warning'));
		if (!session) return;
		user = session;
		let stopWatching = watchAppSession(updated => { user = updated; });
		window.addEventListener('pagehide', () => { clearVideos(); stopWatching(); window.removeEventListener('resize', resize); });
		window.addEventListener('pageshow', async event => {
			if (!event.persisted) return;
			const restoredUser = await checkAppSession(el('network-warning'));
			if (!restoredUser) return;
			user = restoredUser;
			stopWatching = watchAppSession(updated => { user = updated; });
			window.addEventListener('resize', resize);
			if (pages.length) render();
		});
		if (!/^[a-zA-Z0-9_-]+$/.test(storyId)) { showMessage('Cette histoire n’existe pas.'); return; }
		const [story, stories] = await Promise.all([getStoryById(storyId), listStories()]);
		if (!story) { showMessage('Cette histoire n’existe pas.'); return; }
		el('story-title').textContent = getStoryTitle(story);
		document.title = `${getStoryTitle(story)} | ZOZZO`;
		const lock = getStoryLockReason(story, stories.findIndex(s => s.id === storyId), stories, user);
		if (lock) {
			showMessage(lock === 'premium' ? 'Cette histoire est disponible avec ZOZZO Premium.' : 'Termine l’histoire précédente pour débloquer celle-ci.', false, lock === 'premium');
			return;
		}
		const scenes = await listScenes(storyId);
		pages = scenes.filter(scene => !isRewardScene(scene));
		rewardPage = scenes.find(isRewardScene);
		if (!pages.length) { showMessage('Cette histoire se prépare. Reviens bientôt !'); return; }
		el('story-reader').classList.remove('hidden');
		updateRotatePrompt();
		render();
	} catch {
		showMessage('Impossible de charger cette histoire pour le moment.', true);
	} finally {
		el('loading').classList.add('hidden');
		root.classList.remove('hidden');
		resize();
	}
}
