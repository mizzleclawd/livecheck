import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { vScanStatus, vSeverity } from "./schema";

const MAX_RECENT = 20;

/** Reject anything that is not a public http(s) page before we spend a scrape on it. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ConvexError("Enter a website address to check.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ConvexError(`"${raw}" does not look like a website address.`);
  }
  if (!url.hostname.includes(".")) {
    throw new ConvexError(`"${raw}" does not look like a website address.`);
  }
  return url.toString();
}

/**
 * Starting a scan only writes the row and schedules the work. The action does
 * the slow part, so the client gets an id back immediately and subscribes to
 * the live feed instead of waiting on a request.
 */
export const startScan = mutation({
  args: { url: v.string() },
  returns: v.object({ scanId: v.id("scans") }),
  handler: async (ctx, args) => {
    const url = normalizeUrl(args.url);
    const scanId = await ctx.db.insert("scans", {
      url,
      status: "queued",
      stage: "Getting ready to look at your site",
      pageTitle: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    });
    await ctx.scheduler.runAfter(0, internal.scanRunner.runScan, { scanId, url });
    return { scanId };
  },
});

export const getScan = query({
  args: { scanId: v.id("scans") },
  returns: v.union(
    v.object({
      _id: v.id("scans"),
      _creationTime: v.number(),
      url: v.string(),
      status: vScanStatus,
      stage: v.string(),
      pageTitle: v.union(v.string(), v.null()),
      error: v.union(v.string(), v.null()),
      startedAt: v.number(),
      finishedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => await ctx.db.get(args.scanId),
});

/**
 * Findings stream in as the scan runs, so this query re-fires several times
 * during a single scan. That live fill-in is the demo.
 */
export const listFindings = query({
  args: { scanId: v.id("scans") },
  returns: v.array(
    v.object({
      _id: v.id("findings"),
      _creationTime: v.number(),
      scanId: v.id("scans"),
      code: v.string(),
      severity: vSeverity,
      title: v.string(),
      detail: v.string(),
      evidence: v.union(v.string(), v.null()),
      sortOrder: v.number(),
    }),
  ),
  handler: async (ctx, args) =>
    await ctx.db
      .query("findings")
      .withIndex("by_scan_and_sort_order", (q) => q.eq("scanId", args.scanId))
      .collect(),
});

export const listRecentScans = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("scans"),
      url: v.string(),
      status: vScanStatus,
      startedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_started_at")
      .order("desc")
      .take(MAX_RECENT);
    return scans.map((s) => ({
      _id: s._id,
      url: s.url,
      status: s.status,
      startedAt: s.startedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Internal writers, called only by the scan action.
// ---------------------------------------------------------------------------

export const setStage = internalMutation({
  args: {
    scanId: v.id("scans"),
    status: vScanStatus,
    stage: v.string(),
    pageTitle: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      stage: args.stage,
    };
    if (args.pageTitle !== undefined) patch.pageTitle = args.pageTitle;
    if (args.status === "done" || args.status === "failed") {
      patch.finishedAt = Date.now();
    }
    await ctx.db.patch(args.scanId, patch);
    return null;
  },
});

export const addFindings = internalMutation({
  args: {
    scanId: v.id("scans"),
    findings: v.array(
      v.object({
        code: v.string(),
        severity: vSeverity,
        title: v.string(),
        detail: v.string(),
        evidence: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("findings")
      .withIndex("by_scan_and_sort_order", (q) => q.eq("scanId", args.scanId))
      .collect();
    let sortOrder = existing.length;
    for (const f of args.findings) {
      await ctx.db.insert("findings", { ...f, scanId: args.scanId, sortOrder });
      sortOrder += 1;
    }
    return null;
  },
});

export const failScan = internalMutation({
  args: { scanId: v.id("scans"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      status: "failed",
      stage: "We could not finish checking this site",
      error: args.error,
      finishedAt: Date.now(),
    });
    return null;
  },
});
