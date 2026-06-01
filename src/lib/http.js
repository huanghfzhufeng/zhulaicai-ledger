/**
 * Consistent API response envelope + typed error for routes to throw.
 * Shape: { success: boolean, data: T | null, error: string | null }
 */

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function ok(res, data = null, status = 200) {
  return res.status(status).json({ success: true, data, error: null });
}

export function fail(res, status, message) {
  return res.status(status).json({ success: false, data: null, error: message });
}

/** Throw an ApiError when a precondition is not met. */
export function assert(condition, status, message) {
  if (!condition) throw new ApiError(status, message);
}
