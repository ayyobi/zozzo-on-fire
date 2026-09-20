// Single source of truth for PocketBase access and authentication state.
//
// This module must only be imported from client-side <script> blocks
// (never from Astro frontmatter), because the whole site is static/SSR-less
// and PocketBase's authStore relies on window/localStorage.
//
// Do not create a second PocketBase client, a second token store, or a
// parallel "isLoggedIn" flag anywhere else in the project — everything
// should read/write through this file.

import PocketBase, { type RecordModel, ClientResponseError } from 'pocketbase';

export const pb = new PocketBase(import.meta.env.PUBLIC_POCKETBASE_URL);

// The `users` auth collection fields, as they actually exist in PocketBase.
// `niveau`, `experience`, `vies`, `abonnement_actif` and `role` are
// progression/subscription data: the profile UI must never expose editable
// inputs for them, and any change from the client is expected to be
// rejected/reset server-side by the PocketBase hook (see
// pocketbase/pb_hooks/protect_users_fields.pb.js).
export interface ZozzoUser extends RecordModel {
	// Optional integration contract; the story module/schema is not built yet.
	// Only trusted story completion logic should populate these unique IDs.
	histoires_terminees?: string[];
	email: string;
	pseudo: string;
	age: number;
	role: string;
	experience: number;
	niveau: number;
	vies: number;
	abonnement_actif: boolean;
	avatar: string;
	verified: boolean;
}

export function getCurrentUser(): ZozzoUser | null {
	return pb.authStore.isValid ? (pb.authStore.record as ZozzoUser) : null;
}

export function isLoggedIn(): boolean {
	return pb.authStore.isValid;
}

// Every place that authenticates/refreshes expands `avatar` so the UI
// always has the related `avatars` record (nom, image) without a second
// request — see src/lib/avatars.ts.
const AVATAR_EXPAND = { expand: 'avatar' };

export async function login(email: string, password: string) {
	return pb.collection('users').authWithPassword(email, password, AVATAR_EXPAND);
}

export interface RegisterInput {
	pseudo: string;
	email: string;
	age: number;
	password: string;
	passwordConfirm: string;
}

export async function register(input: RegisterInput) {
	// Intentionally does NOT send role / experience / niveau / vies /
	// abonnement_actif: those are progression & billing state and must be
	// assigned safe defaults server-side, never chosen by the signup form.
	// Avatar selection now happens in a popup right after signup (see
	// /app's "bienvenue" flow), so new accounts start on the
	// "avatar-non-choisir" placeholder record.
	const { getDefaultAvatarId } = await import('./avatars');
	const defaultAvatarId = await getDefaultAvatarId();

	await pb.collection('users').create({
		pseudo: input.pseudo,
		email: input.email,
		age: input.age,
		password: input.password,
		passwordConfirm: input.passwordConfirm,
		...(defaultAvatarId ? { avatar: defaultAvatarId } : {}),
	});

	// Real sign-in through PocketBase right after account creation —
	// not a simulated/local "logged in" state.
	return pb.collection('users').authWithPassword(input.email, input.password, AVATAR_EXPAND);
}

export async function requestPasswordReset(email: string) {
	return pb.collection('users').requestPasswordReset(email);
}

export function logout() {
	pb.authStore.clear();
}

export interface ProfileUpdateInput {
	pseudo: string;
	age: number;
}

// Only ever sends the fields a user is legitimately allowed to change
// themselves. Progression/subscription fields (niveau, experience, vies,
// abonnement_actif, role) are deliberately never sent from here — see
// pocketbase/pb_hooks/protect_users_fields.pb.js for the server-side
// enforcement, which is the real protection.
export async function updateProfile(userId: string, input: ProfileUpdateInput) {
	return pb.collection('users').update<ZozzoUser>(userId, {
		pseudo: input.pseudo,
		age: input.age,
	});
}

// Dedicated call for avatar changes (kept separate from updateProfile so
// each form only ever sends the field it actually shows).
export async function updateAvatar(userId: string, avatarId: string) {
	return pb.collection('users').update<ZozzoUser>(userId, { avatar: avatarId }, AVATAR_EXPAND);
}

export type AuthCheckResult = 'ok' | 'invalid' | 'network-error';

let inFlightRefresh: Promise<AuthCheckResult> | null = null;

// Confirms the locally-stored session is still accepted by PocketBase.
// Never call this in a loop/interval — call it once per page load (see
// requireAuth) and let authStore.onChange() react to further changes.
export async function refreshAuth(): Promise<AuthCheckResult> {
	if (!pb.authStore.isValid) return 'invalid';

	if (inFlightRefresh) return inFlightRefresh;

	inFlightRefresh = (async () => {
		try {
			await pb.collection('users').authRefresh(AVATAR_EXPAND);
			return 'ok' as const;
		} catch (err) {
			const status = err instanceof ClientResponseError ? err.status : 0;
			if (status === 401 || status === 403) {
				// The server actively rejected the session: it really is
				// invalid (expired, revoked, deleted user...).
				pb.authStore.clear();
				return 'invalid' as const;
			}
			// status 0 (offline) or 5xx: transient failure, not proof the
			// session is invalid. Keep the existing local session.
			return 'network-error' as const;
		} finally {
			inFlightRefresh = null;
		}
	})();

	return inFlightRefresh;
}

function goToLogin(reason?: 'expired') {
	const target = reason ? `/login?raison=${reason}` : '/login';
	window.location.replace(target);
}

// Guard for pages that require an authenticated user (e.g. /profil).
// Redirects to /login when there is no valid, server-confirmed session.
// Returns the current user record when the session is valid, or null when
// the caller should stop (a redirect is already in progress).
export async function requireAuth(): Promise<ZozzoUser | null> {
	if (!pb.authStore.isValid) {
		goToLogin();
		return null;
	}

	const result = await refreshAuth();

	if (result === 'invalid') {
		goToLogin('expired');
		return null;
	}

	// 'ok' or 'network-error': trust the local session optimistically on a
	// network hiccup rather than kicking the user out.
	return getCurrentUser();
}

// Keeps every open tab/page in sync: if another tab logs out (or logs in as
// someone else), this tab's authStore updates automatically (PocketBase's
// LocalAuthStore listens for the browser "storage" event), and callers can
// react via this helper.
export function onAuthChange(callback: (user: ZozzoUser | null) => void) {
	return pb.authStore.onChange(() => {
		callback(getCurrentUser());
	}, true);
}

export function friendlyErrorMessage(err: unknown): string {
	if (err instanceof ClientResponseError) {
		if (err.status === 0) {
			return 'Impossible de contacter le serveur. Réessayez dans quelques instants.';
		}
		if (err.status === 400) {
			const data = err.response?.data ?? {};
			if (data.email?.message) return 'Un compte existe déjà avec cette adresse email.';
			if (data.password?.message) return 'Le mot de passe ne respecte pas les règles requises.';
			if (data.pseudo?.message) return 'Ce pseudo n’est pas valide.';
			if (data.age?.message) return 'Âge invalide.';
			return 'Certaines informations saisies ne sont pas valides.';
		}
		if (err.status === 401 || err.status === 403) {
			return 'Email ou mot de passe incorrect.';
		}
		return 'Une erreur est survenue. Merci de réessayer.';
	}
	return 'Une erreur est survenue. Merci de réessayer.';
}
