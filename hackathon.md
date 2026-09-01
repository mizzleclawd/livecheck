# Livecheck

**Is your website actually working?** Put in the address, get back what a
customer runs into, in plain English.

Convex All Gas Hackathon entry. Built by an agent; the human owner writes no
application code.

## The problem

People are shipping websites they cannot evaluate. A site builder or an AI
produces something that *looks* finished, it goes live, and nobody finds out
the contact form silently discards every message until a month of enquiries has
already been lost. The owner is not an engineer. They cannot read a console and
they should not have to.

## Status

**2026-09-01: scanning works end to end and is verified against a control.**

Shipped and measured:

- Convex schema (`scans`, `findings`) with the scan as a **scheduled function**,
  not a request handler. `startScan` writes the row and schedules the work, so
  the client gets an id immediately and subscribes to the live feed.
- Firecrawl scrape on `rawHtml` inside a Convex action, with the API key held in
  deployment environment variables.
- Seven detectors: form with no action, form posting to a dead endpoint, missing
  viewport, placeholder title, missing meta description, broken image, broken
  link.
- Findings written **in batches as they are produced**, so the reactive query
  fills the report in while the scan is still running.
- Findings ranked by what costs money first: broken, risky, polish.
- Next.js frontend. `next build` passes; the page serves and renders.

**Measured on the testbed at
[mizzleclawd.github.io/livecheck-testbed](https://mizzleclawd.github.io/livecheck-testbed/):**

| Page | Findings | Result |
| --- | --- | --- |
| `index.html` (deliberately broken) | 6 | form with no action, dead newsletter endpoint, missing viewport, missing description, 404 image, 404 link |
| `working.html` (negative control) | 1 | missing meta description, which is a true positive |

Not shipped yet, and marked as such deliberately:

- Public deployment. This runs against a local Convex backend; cloud deployment
  is pending account linkage.
- The portable public certificate. That is the separation from a generic
  site-checker and it is the next build.
- Fix suggestions with one-click application.
- AgentMail inbound.

## What the negative control caught

The first version probed form endpoints with HEAD and treated any `4xx` as
dead. Run against the control page, it reported that a **working** Formspree
form was broken.

That is the most damaging mistake this product can make. A form handler that
only accepts POST answers HEAD or GET with `400`, `403`, `405` or `422` while
being perfectly alive. Telling a shop owner their working contact form is dead
is worse than telling them nothing.

Form endpoints are now only reported dead on an unreachable host, a timeout, a
definitive `404`/`410`, or a `5xx`. Images and links are fetched by real
browsers with GET, so for those any `4xx` really is broken. After the fix the
control page dropped from 2 findings to 1, and the broken page still returned
all 6.

**A checker without a known-good control is decoration.** The control is what
found the bug, not the broken page.

## Why `rawHtml` and not `markdown`

Firecrawl's `markdown` format strips form markup and meta tags. Those are
exactly what every check here depends on. `rawHtml` preserves the form `action`
attribute or its absence, resolves relative links to absolute, and exposes a
missing viewport tag. This was established with a spike before any application
code was written.

## Sponsor tools, doing actual work

- **Convex** — database, reactive queries, scheduled functions, actions,
  deployment environment variables. The live-filling report is the reactive
  query, not polling.
- **Firecrawl** — every scan is a real scrape. Not decoration in a README.

## Honesty note

This log is written from what runs. Everything above marked "not shipped yet"
has no code behind it at the time of writing. Items move to shipped only after
they are verified, and the verification is stated.
