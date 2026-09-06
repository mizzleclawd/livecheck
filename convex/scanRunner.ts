import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  checkStatic,
  collectAssets,
  findingForDeadUrl,
  findTitle,
  SEVERITY_RANK,
  type Finding,
  type PendingCheck,
} from "./detectors";

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

/** Cap the network checks so one link-heavy page cannot run for minutes. */
const MAX_ASSET_CHECKS = 12;
const ASSET_TIMEOUT_MS = 8000;

/**
 * Scrape the page, run the static detectors, then verify the URLs the page
 * points at. Findings are written in batches as they are produced so the UI
 * fills in live rather than appearing all at once at the end.
 */
export const runScan = internalAction({
  args: { scanId: v.id("scans"), url: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(internal.scans.setStage, {
        scanId: args.scanId,
        status: "fetching",
        stage: "Opening your site the way a visitor would",
      });

      const html = await scrape(args.url);

      await ctx.runMutation(internal.scans.setStage, {
        scanId: args.scanId,
        status: "checking",
        stage: "Reading the page",
        pageTitle: findTitle(html),
      });

      const { findings: staticFindings, pending } = checkStatic(html);
      if (staticFindings.length > 0) {
        await ctx.runMutation(internal.scans.addFindings, {
          scanId: args.scanId,
          findings: sortFindings(staticFindings),
        });
      }

      const assets = [...pending, ...collectAssets(html, args.url)].slice(
        0,
        MAX_ASSET_CHECKS,
      );

      if (assets.length > 0) {
        await ctx.runMutation(internal.scans.setStage, {
          scanId: args.scanId,
          status: "checking",
          stage: `Following ${assets.length} link${assets.length === 1 ? "" : "s"} to see where they go`,
        });

        const dead = await checkAssets(assets);
        if (dead.length > 0) {
          await ctx.runMutation(internal.scans.addFindings, {
            scanId: args.scanId,
            findings: sortFindings(dead),
          });
        }
      }

      await ctx.runMutation(internal.scans.setStage, {
        scanId: args.scanId,
        status: "done",
        stage: "Finished",
      });
    } catch (error) {
      await ctx.runMutation(internal.scans.failScan, {
        scanId: args.scanId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});

/**
 * rawHtml, deliberately. Firecrawl's markdown output strips form markup and
 * meta tags, which are the two things every check here depends on.
 */
async function scrape(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set on this deployment. Set it with `npx convex env set FIRECRAWL_API_KEY <key>`.",
    );
  }

  const response = await fetch(FIRECRAWL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    // Diagnostics must describe the page as it is now. Firecrawl otherwise
    // returns a cached scrape for up to two days, which can report a defect
    // after the site owner has fixed it.
    body: JSON.stringify({
      url,
      formats: ["rawHtml"],
      onlyMainContent: false,
      maxAge: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `We could not load ${url}. The site returned ${response.status}.`,
    );
  }

  const body = (await response.json()) as {
    success?: boolean;
    data?: { rawHtml?: string };
    error?: string;
  };

  const html = body.data?.rawHtml;
  if (!body.success || !html) {
    throw new Error(body.error ?? `We could not read any content at ${url}.`);
  }
  return html;
}

/**
 * A HEAD request is enough to tell a live URL from a dead one and avoids
 * downloading images. Some hosts reject HEAD, so a 405 falls back to GET.
 */
async function checkAssets(assets: PendingCheck[]): Promise<Finding[]> {
  const results = await Promise.all(
    assets.map(async (asset) => {
      const reason = await probe(asset.url, asset.kind);
      return reason ? findingForDeadUrl(asset, reason) : null;
    }),
  );
  return results.filter((f): f is Finding => f !== null);
}

/**
 * Returns a human reason string when the URL is dead, or null when it is fine.
 *
 * The rule differs by what we are probing, and getting this wrong is the most
 * damaging mistake this product can make. A form handler that only accepts POST
 * answers a HEAD or GET with 400, 403, 405 or 422 while being perfectly alive —
 * Formspree does exactly this. Calling that endpoint dead would tell a shop
 * owner their working contact form is broken, which is worse than saying
 * nothing. So for a form endpoint only an unreachable host, a timeout, a
 * definitively-gone 404/410, or a server error counts as dead. Images and links
 * are fetched by real browsers with GET, so for those any 4xx really is broken.
 */
async function probe(
  url: string,
  kind: PendingCheck["kind"],
): Promise<string | null> {
  const attempt = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response = await attempt("HEAD");
    if (response.status === 405 || response.status === 501) {
      response = await attempt("GET");
    }
    if (kind === "form_endpoint") {
      const definitelyGone = response.status === 404 || response.status === 410;
      const serverBroken = response.status >= 500;
      if (definitelyGone || serverBroken) {
        return `returned ${response.status}`;
      }
      // Anything else (400/401/403/405/422/429) is a live POST-only handler.
      return null;
    }

    if (response.status >= 400) {
      return `returned ${response.status}`;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "did not respond in time";
    }
    // DNS failure, refused connection, bad certificate.
    return "could not be reached at all";
  }
}

/** Money-losing problems first, so the top of the report is the thing to fix today. */
function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}
