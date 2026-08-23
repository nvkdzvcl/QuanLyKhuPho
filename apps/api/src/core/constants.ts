export const SESSION_COOKIE_NAME = 'qlkp_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (604,800s)
export const OTP_EXPIRES_IN_SECONDS = 300; // 5 minutes
export const OTP_RATE_LIMIT_WINDOW_SECONDS = 60; // 60s
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_MAX_FAILED_ATTEMPTS = 3;
export const OTP_LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes (900s)
export const REGISTER_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes (900s)
