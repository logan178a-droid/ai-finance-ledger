import dns from "node:dns/promises";
import disposableDomains from "disposable-email-domains/index.json";

const DISPOSABLE_DOMAINS = new Set<string>((disposableDomains as string[]).map((d) => d.toLowerCase()));

export type EmailRejectionReason = "disposable" | "no-mail-server";

export interface EmailValidationResult {
  ok: boolean;
  reason?: EmailRejectionReason;
  message?: string;
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/** Known disposable/throwaway email providers (mailinator, guerrillamail, tempmail, etc.) via a maintained community blocklist — not hand-rolled. */
export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

type ResolveOutcome = "found" | "no-record" | "blocked";

/** True if a DNS error means "this record genuinely doesn't exist" as opposed to the query itself failing (network/resolver unavailable). */
function isDefinitiveNoRecord(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

async function tryResolve(fn: () => Promise<unknown[]>): Promise<ResolveOutcome> {
  try {
    const records = await fn();
    return records.length > 0 ? "found" : "no-record";
  } catch (err) {
    return isDefinitiveNoRecord(err) ? "no-record" : "blocked";
  }
}

/**
 * Confirms the domain can genuinely receive mail: a real MX lookup (the
 * requested approach), then A/AAAA (RFC 5321 allows mail delivery straight
 * to a host's address record when it has no MX of its own, so a domain
 * with only an A record is still valid). If every one of those queries came
 * back "blocked" rather than a definitive answer — some sandboxed/
 * restricted network environments block raw outbound DNS queries entirely,
 * which is an infrastructure failure, not evidence the domain is fake — we
 * fall back to `dns.lookup` (the OS resolver) as a last resort so real
 * domains are never wrongly rejected just because direct DNS is unavailable.
 */
export async function domainCanReceiveMail(domain: string): Promise<boolean> {
  const mx = await tryResolve(() => dns.resolveMx(domain));
  if (mx === "found") return true;

  const a = await tryResolve(() => dns.resolve4(domain));
  if (a === "found") return true;

  const aaaa = await tryResolve(() => dns.resolve6(domain));
  if (aaaa === "found") return true;

  const allBlocked = mx === "blocked" && a === "blocked" && aaaa === "blocked";
  if (allBlocked) {
    try {
      await dns.lookup(domain);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Full layered validation used at registration: format is checked upstream
 * by the Zod schema (`z.string().email()`) before this ever runs. This
 * layer adds (1) a disposable-provider blocklist and (2) a real DNS check
 * that the domain can actually receive mail — rejecting typo'd or
 * nonexistent domains that would merely "look like" a valid address.
 */
export async function validateRegistrationEmail(email: string): Promise<EmailValidationResult> {
  const domain = extractDomain(email);
  if (!domain) return { ok: false, message: "Enter a valid email address." };

  if (isDisposableDomain(domain)) {
    return {
      ok: false,
      reason: "disposable",
      message: "Temporary/disposable email addresses aren't allowed. Please use a real email address.",
    };
  }

  const canReceive = await domainCanReceiveMail(domain);
  if (!canReceive) {
    return {
      ok: false,
      reason: "no-mail-server",
      message: "This email address doesn't appear to be able to receive mail — please use a real email address.",
    };
  }

  return { ok: true };
}
