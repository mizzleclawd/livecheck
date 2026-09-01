# Livecheck

You paid someone, or something, to build you a website. Is it actually
working? Livecheck opens your site the way a customer would, and tells you what
they run into, in plain English.

Not "meta description absent." More like: **"Google has nothing to show under
your name."**

Built for the **Convex All Gas Hackathon**. See [`hackathon.md`](./hackathon.md)
for the build log.

## What it checks

| Check | What the owner is told |
| --- | --- |
| Form with no `action` | Your contact form throws messages away |
| Form posting to a dead endpoint | Your form sends to an address that no longer exists |
| No viewport meta | Your site is unreadable on a phone |
| Placeholder `<title>` | Your browser tab still says the placeholder |
| No meta description | Google has nothing to show under your name |
| Image returning 404 | A photo on your page is missing |
| Link returning 404 | A link on your page goes nowhere |

Findings are ordered by what costs money first: **broken** (losing customers
now), **risky** (will bite you), then **polish**.

## How it works

1. `startScan` writes the row and schedules the work, so the browser gets an id
   back immediately instead of waiting on a request.
2. `scanRunner.runScan` scrapes the page through **Firecrawl** using `rawHtml`.
   Not `markdown`. Markdown strips form markup and meta tags, which are exactly
   the things every check depends on.
3. Static detectors run against the HTML, then every URL the page points at is
   probed over the network.
4. Findings are written **in batches as they are produced**, so the Convex
   reactive query fills the report in live while the scan is still running.

The detectors in `convex/detectors.ts` are pure functions: HTML in, findings out,
no network and no Convex imports. That means they can be reasoned about and
tested without a deployment.

## The false positive that matters

A form handler that only accepts POST answers a HEAD or GET with `400`, `403`,
`405` or `422` while being perfectly alive. Formspree does exactly this. An
early version called that endpoint dead, which would have told a shop owner
their **working** contact form was broken, which is worse than saying nothing
at all.

So form endpoints are only reported dead on an unreachable host, a timeout, a
definitive `404`/`410`, or a `5xx`. Images and links are fetched by real
browsers with GET, so for those any `4xx` really is broken.

This was caught by running the scanner against a known-good control page. There
is a testbed of deliberately broken pages at
[mizzleclawd.github.io/livecheck-testbed](https://mizzleclawd.github.io/livecheck-testbed/),
including `working.html` as the negative control.

## Running it

```bash
npm install
npx convex dev                                    # backend + codegen
npx convex env set FIRECRAWL_API_KEY <your-key>   # required by the scan action
npm run dev                                       # http://localhost:3000
```
