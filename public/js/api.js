// Thin API client over fetch. Throws ApiError(status, message) on any failure
// so callers can branch on `.status` (e.g. 401 -> redirect to login).

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(method, path, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* response had no JSON body */
  }

  if (!res.ok || !payload || payload.success === false) {
    throw new ApiError(res.status, payload?.error || `请求失败（${res.status}）`);
  }
  return payload.data;
}

export const api = {
  auth: {
    me: () => request('GET', '/api/auth/me'),
    login: (username, password) => request('POST', '/api/auth/login', { username, password }),
    register: (username, password) =>
      request('POST', '/api/auth/register', { username, password }),
    logout: () => request('POST', '/api/auth/logout'),
  },
  entries: {
    list: () => request('GET', '/api/entries'),
    create: (entry) => request('POST', '/api/entries', entry),
    update: (id, entry) => request('PATCH', `/api/entries/${id}`, entry),
    remove: (id) => request('DELETE', `/api/entries/${id}`),
  },
  categories: {
    list: () => request('GET', '/api/categories'),
    add: (type, name) => request('POST', '/api/categories', { type, name }),
    remove: (type, name) => request('DELETE', '/api/categories', { type, name }),
  },
};
