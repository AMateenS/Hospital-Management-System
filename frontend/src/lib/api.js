// Thin fetch wrapper. Cookies are httpOnly, so nothing sensitive is kept in JS.
export class ApiError extends Error {
  constructor(message, status, errors, data) { super(message); this.status = status; this.errors = errors; this.data = data; }
}
export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '';
  const res = await fetch(`/api${path}${qs}`, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && typeof window !== 'undefined') {
    if (data.code === 'PASSWORD_CHANGE_REQUIRED' && !location.pathname.startsWith('/change-password')) window.location.href = '/change-password';
    else if (res.status === 401 && !path.startsWith('/auth/') && !location.pathname.startsWith('/login')) window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(data.message || 'Request failed', res.status, data.errors, data);
  return data;
}
