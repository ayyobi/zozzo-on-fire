// Real PocketBase-backed avatars (collection `avatars`: nom, image, actif).
//
// Confirmed from Nargis's PocketBase screenshot: there is a dedicated
// `avatars` collection, and a placeholder record named
// "avatar-non-choisir" is what `users.avatar` should point to until the
// player picks a real one. `users.avatar` is treated as a relation
// (single) storing an `avatars` record id.
import { pb } from './pocketbase';
import type { RecordModel } from 'pocketbase';

export const DEFAULT_AVATAR_NAME = 'avatar-non-choisir';

export interface AvatarRecord extends RecordModel {
	nom: string;
	image: string;
	actif: boolean;
}

let cachedDefaultAvatar: AvatarRecord | null | undefined;

// The "avatar-non-choisir" record: assigned to brand new accounts, and
// also used as a display fallback for older accounts whose `avatar`
// relation is still empty (created before this system existed) — so the
// avatar circle is never left truly blank.
export async function getDefaultAvatar(): Promise<AvatarRecord | null> {
	if (cachedDefaultAvatar !== undefined) return cachedDefaultAvatar;
	try {
		cachedDefaultAvatar = await pb
			.collection('avatars')
			.getFirstListItem<AvatarRecord>(pb.filter('nom = {:nom}', { nom: DEFAULT_AVATAR_NAME }));
	} catch {
		cachedDefaultAvatar = null;
	}
	return cachedDefaultAvatar;
}

export async function getDefaultAvatarId(): Promise<string | null> {
	const record = await getDefaultAvatar();
	return record?.id ?? null;
}

// Avatars a player can actually pick — active, and excluding the
// "not chosen yet" placeholder.
export async function listSelectableAvatars(): Promise<AvatarRecord[]> {
	const items = await pb.collection('avatars').getFullList<AvatarRecord>({
		filter: pb.filter('actif = {:actif}', { actif: true }),
		sort: 'nom',
	});
	return items.filter((a) => a.nom !== DEFAULT_AVATAR_NAME);
}

export function getAvatarImageUrl(avatar: AvatarRecord | null | undefined): string | null {
	if (!avatar || !avatar.image) return null;
	return pb.files.getURL(avatar, avatar.image);
}

// Used wherever a user's avatar is displayed: falls back to the
// "avatar-non-choisir" illustration instead of leaving the circle empty
// when the account has no avatar relation set yet.
export async function resolveDisplayAvatar(
	expanded: AvatarRecord | null | undefined,
): Promise<AvatarRecord | null> {
	if (expanded) return expanded;
	return getDefaultAvatar();
}
