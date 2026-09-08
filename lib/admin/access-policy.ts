import { MODULES, ModuleKey } from "./types";
export type PolicyGrant = {
  module: ModuleKey;
  kind: string;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};
export function evaluateAccess(
  status: string,
  role: string,
  paidExpiry: Date | null,
  grants: PolicyGrant[],
  now = new Date(),
) {
  return Object.fromEntries(
    MODULES.map((module) => {
      const current = grants.filter(
        (g) =>
          g.module === module &&
          !g.revokedAt &&
          g.startsAt <= now &&
          (!g.expiresAt || g.expiresAt > now),
      );
      const denied = current.some((g) => g.kind === "deny");
      const free = current.filter((g) => g.kind === "grant");
      const lifetime = free.some((g) => !g.expiresAt);
      const expiry =
        [paidExpiry, ...free.map((g) => g.expiresAt)]
          .filter((d): d is Date => Boolean(d && d > now))
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const active =
        status === "active" &&
        (role === "admin" || (!denied && (lifetime || Boolean(expiry))));
      return [
        module,
        {
          active,
          expiresAt: active && !lifetime && role !== "admin" ? expiry : null,
          source:
            role === "admin"
              ? "admin"
              : denied
                ? "blocked"
                : free.length
                  ? "grant"
                  : expiry
                    ? "paid"
                    : "none",
        },
      ];
    }),
  ) as Record<
    ModuleKey,
    { active: boolean; expiresAt: Date | null; source: string }
  >;
}
