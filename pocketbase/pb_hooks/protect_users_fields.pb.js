/// <reference path="../pb_data/types.d.ts" />

// ─────────────────────────────────────────────────────────────────────────
// NOT part of the Astro app — this file must be copied onto the PocketBase
// SERVER (the pb_hooks/ folder next to your pocketbase executable / pb_data,
// on the machine serving https://api.zozzo.fr), then PocketBase must be
// restarted so it picks it up.
//
// Why this exists: PocketBase's "users" API Rules only control WHICH
// records a request can touch (e.g. "a user can only update their own
// record"). They cannot restrict WHICH FIELDS may be changed on that
// record. Without this hook, any authenticated user could send a normal
// update request to their own account and set:
//   abonnement_actif: true   (fake Premium)
//   niveau / experience / vies: anything (fake progression)
//   role: anything
// directly against the PocketBase API — no frontend code path needed, and
// no amount of hiding buttons in Astro would stop it.
//
// This hook resets those fields to a safe value on every create/update
// request to the `users` collection, UNLESS the request is authenticated
// as a superuser (i.e. trusted server-side/admin logic, such as a future
// payment webhook running with a superuser/service token).
// ─────────────────────────────────────────────────────────────────────────

const PROTECTED_FIELDS = ["niveau", "experience", "vies", "abonnement_actif", "role"];

// Applied on account creation so signup never has to (and never gets to)
// choose its own starting progression/subscription state.
// Adjust these if your intended defaults differ.
const SAFE_DEFAULTS = {
	niveau: 1,
	experience: 0,
	vies: 3,
	abonnement_actif: false,
	role: "enfant",
};

onRecordCreateRequest((e) => {
	if (!e.hasSuperuserAuth()) {
		for (const field of PROTECTED_FIELDS) {
			e.record.set(field, SAFE_DEFAULTS[field]);
		}
	}
	e.next();
}, "users");

onRecordUpdateRequest((e) => {
	if (!e.hasSuperuserAuth()) {
		const original = e.record.original();
		for (const field of PROTECTED_FIELDS) {
			e.record.set(field, original.get(field));
		}
	}
	e.next();
}, "users");
