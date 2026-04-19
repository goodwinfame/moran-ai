/**
 * Service layer exports.
 *
 * All services use getDb() for lazy DB connection.
 * All public methods return ServiceResult<T> for consistent error handling.
 */

export type { ServiceResult } from "./types.js";

export * as authService from "./auth.service.js";
