import { domainToASCII } from "node:url";
import disposableDomains from "./data/disposable-domains.json";
import { RegistrationError } from "./errors";

const blockedDomains = new Set([
  ...disposableDomains,
  "example.com",
  "example.org",
  "example.net",
]);
const placeholders =
  /^(?:test(?:ing)?|testuser|testaccount|dummy|dummyuser|fake|fakeuser|fakeemail|demo|example|sample|temp|temporary|tempmail|disposable|noemail|noone|nobody|noreply|asdf|qwerty)\d*$/;

export function validateSignupEmail(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const parts = raw.split("@");
  const local = parts[0];
  const domain = parts.length === 2 ? domainToASCII(parts[1]) : "";
  const labels = domain.split(".");
  if (
    !local ||
    local.length > 64 ||
    raw.length > 254 ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    labels.length < 2 ||
    !labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    ) ||
    !/^[a-z]{2,}$|^xn--[a-z0-9-]+$/.test(labels.at(-1)!)
  )
    throw new RegistrationError("Enter a valid email address.");
  for (let i = 0; i < labels.length - 1; i++) {
    if (blockedDomains.has(labels.slice(i).join(".")))
      throw new RegistrationError(
        "Temporary or disposable email addresses aren't accepted. Please use your regular email address.",
      );
  }
  if (["test", "invalid", "localhost", "example"].includes(labels.at(-1)!))
    throw new RegistrationError(
      "Please use your regular email address, not an example or test address.",
    );
  // Match whole placeholder names, not substrings: e.g. 'testerman' is a real surname.
  const base = local.split("+")[0].replace(/[._-]/g, "");
  if (placeholders.test(base))
    throw new RegistrationError(
      "Placeholder addresses such as test@gmail.com aren't accepted. Please use your regular email address.",
    );
  return `${local}@${domain}`;
}
