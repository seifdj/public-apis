/** Username rules, mirrored by the database (complete_profile / is_username_available). */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** What the user types -> what is allowed: lowercase, no accents, [a-z0-9_]. */
export function sanitizeUsernameInput(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s.-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX);
}

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_RE.test(username);
}

/** "Sweet Cakes Lyon" -> "sweet_cakes_lyon". Returns '' when nothing usable remains. */
export function suggestUsername(displayName: string): string {
  const base = sanitizeUsernameInput(displayName.trim()).replace(/_+/g, '_').replace(/^_|_$/g, '');
  return base.length >= USERNAME_MIN ? base : '';
}
