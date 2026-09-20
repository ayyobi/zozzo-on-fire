// Lets any script trigger the small toast bubble already built into
// AppHeader (present on every /app/* page via AppLayout), instead of each
// feature re-implementing its own toast UI.
export function showAppToast(message: string) {
	window.dispatchEvent(new CustomEvent('zozzo:toast', { detail: message }));
}
