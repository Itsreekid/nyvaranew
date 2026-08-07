export function showAdminSuccess(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin-success', { detail: message }));
  }
}
