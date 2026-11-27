/**
 * Sign-in identifier helpers.
 *
 * Supabase auth is keyed by an email address, so an account created from the
 * admin screen gets the deterministic internal address
 * `<username>@prakashpump.local`. The person types only their username; because
 * the mapping is deterministic the browser can build the address itself, with
 * no service-role lookup and no way to enumerate accounts.
 */
export const LOGIN_EMAIL_DOMAIN = "prakashpump.local";

/** 3–32 characters: letters, numbers, dot, dash or underscore, starting alphanumeric. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normaliseUsername(value));
}

/** `ravi.k` → `ravi.k@prakashpump.local`; anything containing @ is treated as an email. */
export function signInEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${LOGIN_EMAIL_DOMAIN}`;
}
