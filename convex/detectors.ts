/**
 * Pure detectors. No Convex imports, no network — a string of HTML in, findings out.
 * Keeping them pure is what makes them testable without a deployment.
 *
 * These run on Firecrawl's `rawHtml`, never `markdown`. Markdown strips form
 * markup and meta tags, which is exactly what we need to look at.
 */

export type Severity = "broken" | "risky" | "polish";

export type Finding = {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string | null;
};

/** A URL we found in the page and still need to check over the network. */
export type PendingCheck = {
  kind: "form_endpoint" | "image" | "link";
  url: string;
  raw: string;
};

const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

/** Attribute read that tolerates single, double, and unquoted values. */
function attr(tag: string, name: string): string | null {
  const m =
    tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i")) ??
    tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return m ? m[1] : null;
}

export function findTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() || null : null;
}

/**
 * Forms with no `action` submit back to the page itself. On a static host that
 * means the message is silently discarded — the visitor sees no error and the
 * owner never learns anyone tried to reach them. This is the single most
 * expensive failure on an AI-built small business site.
 */
export function checkForms(html: string): {
  findings: Finding[];
  pending: PendingCheck[];
} {
  const findings: Finding[] = [];
  const pending: PendingCheck[] = [];
  const forms = stripComments(html).match(/<form[^>]*>/gi) ?? [];

  for (const tag of forms) {
    const action = attr(tag, "action");
    const id = attr(tag, "id") ?? attr(tag, "name");
    const label = id ? `the "${id}" form` : "a form on your page";

    if (action === null || action.trim() === "") {
      findings.push({
        code: "form_no_action",
        severity: "broken",
        title: "Your contact form throws messages away",
        detail:
          `When someone fills in ${label} and hits send, nothing is sent ` +
          `anywhere. The page looks like it worked, so the customer thinks ` +
          `they reached you and waits for a reply that is never coming. ` +
          `You have no way of knowing how many you have already missed.`,
        evidence: tag,
      });
      continue;
    }

    if (/^(javascript:|#)/i.test(action.trim())) {
      findings.push({
        code: "form_no_action",
        severity: "broken",
        title: "Your contact form throws messages away",
        detail:
          `${label.charAt(0).toUpperCase() + label.slice(1)} does not send ` +
          `anywhere real. Messages typed into it are lost the moment the ` +
          `visitor presses the button.`,
        evidence: tag,
      });
      continue;
    }

    pending.push({ kind: "form_endpoint", url: action.trim(), raw: tag });
  }

  return { findings, pending };
}

/**
 * No viewport tag means phones render the desktop layout zoomed out: text the
 * size of a grain of rice. Most visitors to a local business site are on a phone.
 */
export function checkViewport(html: string): Finding[] {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html;
  const hasViewport = /<meta[^>]+name\s*=\s*["']?viewport["']?/i.test(head);
  if (hasViewport) return [];
  return [
    {
      code: "missing_viewport",
      severity: "broken",
      title: "Your site is unreadable on a phone",
      detail:
        "Phones are being shown the full desktop layout shrunk down, so the " +
        "text arrives too small to read and visitors have to pinch and drag " +
        "to get anywhere. Most people looking up a local business are on a " +
        "phone, and most of them leave rather than fight with it.",
      evidence: null,
    },
  ];
}

/** Search engines show this sentence under your name. Absent means they invent one. */
export function checkMetaDescription(html: string): Finding[] {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html;
  const tag = head.match(
    /<meta[^>]+name\s*=\s*["']?description["']?[^>]*>/i,
  )?.[0];
  const content = tag ? attr(tag, "content") : null;
  if (content && content.trim().length > 0) return [];
  return [
    {
      code: "missing_meta_description",
      severity: "risky",
      title: "Google has nothing to show under your name",
      detail:
        "Search results show a line of description under each business. You " +
        "have not written one, so Google grabs whatever text it finds first " +
        "on the page. That is usually a navigation menu or a stray sentence, " +
        "and it is the first thing a customer reads about you.",
      evidence: null,
    },
  ];
}

export function checkTitle(html: string): Finding[] {
  const title = findTitle(html);
  if (title && !/^(document|untitled|home|index|my app|create next app)$/i.test(title)) {
    return [];
  }
  return [
    {
      code: "placeholder_title",
      severity: "risky",
      title: "Your browser tab still says the placeholder",
      detail:
        `The name at the top of the browser tab is "${title ?? "(empty)"}", ` +
        `which is the default the site builder left behind. It is also the ` +
        `headline Google shows in search results and the name saved when ` +
        `someone bookmarks you.`,
      evidence: title,
    },
  ];
}

/** Collect images and links so the caller can check them over the network. */
export function collectAssets(html: string, pageUrl: string): PendingCheck[] {
  const clean = stripComments(html);
  const out: PendingCheck[] = [];
  const seen = new Set<string>();

  const push = (kind: PendingCheck["kind"], value: string | null, raw: string) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || /^(data:|mailto:|tel:|javascript:|#)/i.test(trimmed)) return;
    let absolute: string;
    try {
      absolute = new URL(trimmed, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(absolute) || seen.has(absolute)) return;
    seen.add(absolute);
    out.push({ kind, url: absolute, raw });
  };

  for (const tag of clean.match(/<img[^>]*>/gi) ?? []) {
    push("image", attr(tag, "src"), tag);
  }
  for (const tag of clean.match(/<a[^>]*>/gi) ?? []) {
    push("link", attr(tag, "href"), tag);
  }
  return out;
}

/** Everything that can be decided from the HTML alone, in report order. */
export function checkStatic(html: string): {
  findings: Finding[];
  pending: PendingCheck[];
} {
  const forms = checkForms(html);
  return {
    findings: [
      ...forms.findings,
      ...checkViewport(html),
      ...checkTitle(html),
      ...checkMetaDescription(html),
    ],
    pending: forms.pending,
  };
}

/** Turn a failed network check into a finding a shop owner can act on. */
export function findingForDeadUrl(
  check: PendingCheck,
  reason: string,
): Finding {
  if (check.kind === "form_endpoint") {
    return {
      code: "form_dead_endpoint",
      severity: "broken",
      title: "Your form sends to an address that no longer exists",
      detail:
        "The form on your page hands its messages to an outside service, and " +
        "that service is not answering. Every enquiry submitted since it went " +
        "down has been lost, and the visitor got no warning.",
      evidence: `${check.url} — ${reason}`,
    };
  }
  if (check.kind === "image") {
    return {
      code: "broken_image",
      severity: "risky",
      title: "A photo on your page is missing",
      detail:
        "One of your images never finished uploading, so visitors see a blank " +
        "box or a broken icon where a picture of your work should be.",
      evidence: `${check.url} — ${reason}`,
    };
  }
  return {
    code: "broken_link",
    severity: "risky",
    title: "A link on your page goes nowhere",
    detail:
      "Someone clicking this link lands on an error page instead of the page " +
      "you meant to send them to.",
    evidence: `${check.url} — ${reason}`,
  };
}

/** Ordering for the report: what costs money first. */
export const SEVERITY_RANK: Record<Severity, number> = {
  broken: 0,
  risky: 1,
  polish: 2,
};
