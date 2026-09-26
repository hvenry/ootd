/**
 * The product name lives here and nowhere else. It is a working name and will
 * probably change; never hard-code it in copy.
 */
export const BRAND = "OOTD" as const;

/**
 * Single hardcoded owner while there is one user. When Better Auth arrives this
 * becomes the session's user id — every query already filters on it, so that
 * swap touches this constant and the session lookup, nothing else.
 */
export const OWNER_ID = "00000000-0000-7000-8000-000000000001" as const;
