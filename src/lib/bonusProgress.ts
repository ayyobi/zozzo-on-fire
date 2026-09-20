// Contract for the future story completion flow: stable IDs of distinct
// stories completed by this user, recorded by the server. Replaying a story
// must not award another object. Missing/invalid progress stays locked.
export function countCompletedStories(storyIds: unknown): number {
	if (!Array.isArray(storyIds)) return 0;
	return new Set(storyIds.filter((id): id is string =>
		typeof id === 'string' && id.trim().length > 0,
	).map((id) => id.trim())).size;
}
