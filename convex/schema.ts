import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** A scan moves through these in order. The UI renders the label directly. */
export const SCAN_STATUSES = [
  "queued",
  "fetching",
  "checking",
  "done",
  "failed",
] as const;

export const vScanStatus = v.union(
  ...SCAN_STATUSES.map((s) => v.literal(s)),
);

/**
 * Severity is written for a shop owner, not an engineer.
 * broken  — money is walking out the door right now
 * risky   — works today, will bite them
 * polish  — worth fixing, nobody is losing a customer over it
 */
export const SEVERITIES = ["broken", "risky", "polish"] as const;

export const vSeverity = v.union(...SEVERITIES.map((s) => v.literal(s)));

export default defineSchema({
  scans: defineTable({
    url: v.string(),
    status: vScanStatus,
    // Human-readable current step, e.g. "Opening your site". Drives the live feed.
    stage: v.string(),
    pageTitle: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
  }).index("by_started_at", ["startedAt"]),

  findings: defineTable({
    scanId: v.id("scans"),
    code: v.string(),
    severity: vSeverity,
    // Both of these are plain English. No jargon reaches this table.
    title: v.string(),
    detail: v.string(),
    // The exact snippet or URL we based the call on, so the finding is checkable.
    evidence: v.union(v.string(), v.null()),
    sortOrder: v.number(),
  }).index("by_scan_and_sort_order", ["scanId", "sortOrder"]),
});
