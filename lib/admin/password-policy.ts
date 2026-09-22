export const ADMIN_PASSWORD_HELP =
  "Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a symbol.";

// bcrypt only considers the first 72 bytes. Reject longer inputs instead of truncating.
export function isAdminPasswordInput(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    new TextEncoder().encode(value).length <= 72
  );
}

export function isStrongAdminPassword(value: unknown): value is string {
  return (
    isAdminPasswordInput(value) &&
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9\s]/.test(value)
  );
}
