export function showAdminError(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin-error', { detail: message }));
  }
}
