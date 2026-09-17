// Más alto que el default de la librería (10): margen extra dado lo sensible
// del dato y el bajo volumen de login de un panel interno.
export const BCRYPT_ROUNDS = 12;

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_TTL_SECONDS = 60;
export const LOGIN_FAILURES_TTL_SECONDS = 120;

export const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

export const REFRESH_TOKEN_TTL = '7d';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Menor que ACCESS_TOKEN_TTL: un cambio de rol/estado se refleja como máximo
// este tiempo después, sin depender de que el usuario vuelva a loguearse.
export const USER_CACHE_TTL_SECONDS = 5 * 60;

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  CSRF_TOKEN: 'csrfToken',
} as const;

export const REDIS_KEYS = {
  loginFailures: (username: string) => `login_failures:${username}`,
  loginLockout: (username: string) => `login_lockout:${username}`,
  userCache: (usuarioId: string) => `user_cache:${usuarioId}`,
};

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RESET_BY_ADMIN: 'PASSWORD_RESET_BY_ADMIN',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
} as const;
