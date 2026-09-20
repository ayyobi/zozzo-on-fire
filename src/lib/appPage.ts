// Shared "is this a valid, server-confirmed PocketBase session?" guard used
// by every /app/* page. Centralizes the ~15 lines that used to be
// copy-pasted into every page's own <script> (app.astro, dictionnaire.astro,
// profil.astro, abonnement.astro) — same authStore/refreshAuth logic as
// always, just written once.
import { refreshAuth, getCurrentUser, onAuthChange, pb, type ZozzoUser } from './pocketbase';

// Redirects to /login (or /login?raison=expired) and resolves null when the
// session isn't valid. Callers do: `const user = await checkAppSession(...);
// if (!user) return;` and only reveal their content once a user comes back.
export async function checkAppSession(networkWarningEl?: HTMLElement | null): Promise<ZozzoUser | null> {
	if (!pb.authStore.isValid) {
		window.location.replace('/login');
		return null;
	}

	const result = await refreshAuth();

	if (result === 'invalid') {
		window.location.replace('/login?raison=expired');
		return null;
	}
	if (result === 'network-error') {
		networkWarningEl?.classList.remove('hidden');
	}

	const user = getCurrentUser();
	if (!user) {
		window.location.replace('/login');
		return null;
	}
	return user;
}

// Keeps a page in sync if the session changes in another tab (logout
// elsewhere, etc.) — redirects to /login once it becomes invalid.
export function watchAppSession(onUser: (user: ZozzoUser) => void) {
	return onAuthChange((user) => {
		if (!user) {
			window.location.replace('/login');
			return;
		}
		onUser(user);
	});
}
