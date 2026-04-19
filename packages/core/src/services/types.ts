/**
 * Service layer result type.
 * All service methods return ServiceResult for consistent error handling.
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
