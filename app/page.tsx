"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEVERITY_COPY = {
  broken: { label: "Losing you customers", tone: "border-red-500/60 bg-red-500/5" },
  risky: { label: "Worth fixing soon", tone: "border-amber-500/60 bg-amber-500/5" },
  polish: { label: "Nice to have", tone: "border-sky-500/60 bg-sky-500/5" },
} as const;

export default function Home() {
  const [url, setUrl] = useState("");
  const [scanId, setScanId] = useState<Id<"scans"> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const startScan = useMutation(api.scans.startScan);
  const scan = useQuery(api.scans.getScan, scanId ? { scanId } : "skip");
  const findings = useQuery(api.scans.listFindings, scanId ? { scanId } : "skip");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const { scanId: id } = await startScan({ url });
      setScanId(id);
    } catch (error) {
      setFormError(
        error instanceof ConvexError
          ? (error.data as string)
          : "Something went wrong starting the check.",
      );
    }
  }

  const running =
    scan !== undefined &&
    scan !== null &&
    scan.status !== "done" &&
    scan.status !== "failed";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Livecheck</h1>
        <p className="text-muted-foreground text-lg">
          You paid for a website. Is it actually working? Put the address in and
          we will tell you what a customer runs into, in plain English.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourbusiness.com"
          aria-label="Website address"
          className="flex-1"
        />
        <Button type="submit" disabled={running}>
          {running ? "Checking…" : "Check my site"}
        </Button>
      </form>
      {formError && <p className="text-sm text-red-500">{formError}</p>}

      {scan && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            {running && (
              <span
                aria-hidden
                className="size-2 animate-pulse rounded-full bg-emerald-500"
              />
            )}
            <p className="text-sm font-medium">{scan.stage}</p>
          </div>

          {scan.status === "failed" && scan.error && (
            <p className="rounded-md border border-red-500/60 bg-red-500/5 p-4 text-sm">
              {scan.error}
            </p>
          )}

          {scan.status === "done" && findings?.length === 0 && (
            <p className="rounded-md border border-emerald-500/60 bg-emerald-500/5 p-4">
              <strong className="font-semibold">Nothing broken found.</strong>{" "}
              Your form goes somewhere real, the page works on a phone, and every
              link and image we followed loaded.
            </p>
          )}

          <ul className="flex flex-col gap-4">
            {findings?.map((finding) => {
              const copy = SEVERITY_COPY[finding.severity];
              return (
                <li
                  key={finding._id}
                  className={`rounded-lg border p-5 ${copy.tone}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    {copy.label}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{finding.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed">{finding.detail}</p>
                  {finding.evidence && (
                    <pre className="mt-3 overflow-x-auto rounded bg-black/5 p-3 text-xs dark:bg-white/5">
                      {finding.evidence}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
