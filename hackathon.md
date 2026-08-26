# Livecheck — Convex All Gas Hackathon

**Your AI built the site. We get it actually live.**

Live URL: _(convex.site — pending)_
Demo video: _(pending, <3 min)_
Repo: _(public GitHub — pending)_
Started: 2026-08-25

---

## The problem

Someone with no technical background builds a website with AI. The code is clean, the copy
is decent, the layout looks professional. Then they try to actually launch it.

The contact form submits into nothing. The mobile view collapses. The domain won't connect
because DNS "reads like a foreign language." The SSL certificate fails and the browser throws
a scary warning at every visitor.

The site sits 80% done while the owner googles *"how to point a domain at my website."*
**The last mile kills the launch.**

## Who this is for

**A business owner, not a developer.** A barber, a contractor, a bookkeeper, a personal
trainer. Someone who built a site to get customers and is now stuck on infrastructure they
were never supposed to have to learn.

Every output is plain English. No dashboards full of Lighthouse scores. No jargon. You paste
your URL, we tell you what's broken in words you understand, and we fix what we can fix.

## What it does

1. **Paste your site URL.**
2. **Watch the scan run live.** Every page crawled in real time — you see it working.
3. **Get the plain-English verdict.** "Your contact form goes nowhere. Nobody who fills it out
   is reaching you." Not "form action attribute missing."
4. **We fix what we can.** Missing meta tags, alt text, and — the big one — **we give you a
   working inbox** so your contact form actually delivers.
5. **You get a Livecheck certificate.** A public, shareable page proving the site works:
   what was tested, what passed, when. Portable proof for a client, a marketplace, or a buyer.

## Stack — and what each piece actually does

| Piece | Real work it does |
|---|---|
| **Convex** | The whole backend. Scan jobs as scheduled functions, live scan progress via real-time queries, mutations for fix status, file storage for reports, static hosting for the frontend. |
| **Firecrawl** | **The engine.** Crawls every page of the site — what actually renders, which forms have no destination, missing meta/OG tags, mobile viewport, broken links. This is not a garnish; without the crawl there is no product. |
| **AgentMail** | **The fix, not just the finding.** The #1 failure on an AI-built site is a contact form submitting into the void. AgentMail provisions the site a real inbox, so the form starts delivering. We hand back a working address, not a bug report. |
| **OpenAI** | Translates technical failures into language a non-technical owner understands, generates the missing meta tags and alt text, and writes the certificate summary. |

## Why me

I'm a security architect — CISSP, ISSAP, CCSP, CISM — and SSL, DNS, headers and posture
checks are my actual craft, not a checklist I googled. I've built and shipped a
scan-report-certify product before, so I know which checks matter to a real owner and which
are noise that makes a report look impressive and helps nobody.

---

## Build log

### 2026-08-25 — Day 0
- Hackathon starts. Project started from zero today; no prior code carried in.
- Idea selected and pressure-tested against the judging criteria. Rejected an earlier concept
  (government-contract opportunity radar) because its data sources — SAM.gov and BidNet — are
  both authentication-gated. Verified that directly: SAM.gov's entity search returns **zero
  results** unauthenticated, confirmed with a control search for a company that unquestionably
  exists. Firecrawl would have hit the same wall. Killed it before sinking a week.
- Chose Livecheck because Firecrawl's role is load-bearing on public pages with no auth wall,
  which makes the riskiest dependency the *safest* one.
- **Positioning decision, made deliberately:** this is an everyday app for a business owner,
  not a developer tool. Same checks, completely different product. Plain English or nothing.

_(next entries appended as work lands)_

---

## 2026-08-26 — Firecrawl spike: CONFIRMED

**Question:** can Firecrawl actually see that a contact form is broken, or does extraction
flatten the page into prose and lose the evidence?

**Method.** Built a testbed of deliberately broken static pages and hosted it publicly so a
crawler could reach it: https://mizzleclawd.github.io/livecheck-testbed/
(source: https://github.com/mizzleclawd/livecheck-testbed). Seeded four defects on `index.html`
and kept a `working.html` **negative control** with the same shape built correctly.

Scraped both with `firecrawl scrape -f rawHtml` on the keyless free tier (no API key yet).

**Result — broken page:**

| Seeded defect | What Firecrawl returned | Detectable |
| --- | --- | --- |
| Contact form with no `action` | `<form id="contact" method="post">` | yes — attribute simply absent |
| Form posting to a dead host | `action="https://api.formhandler-doesnotexist.invalid/submit"` | yes — host resolvable/checkable |
| Missing mobile viewport | zero `viewport` matches | yes |
| Dead internal link | `href="https://mizzleclawd.github.io/pricing.html"` | yes — relative links resolved to absolute, so they can be HEAD-checked directly |

**Result — negative control:** form came back *with* its `action`, viewport present twice.
The detector does not fire on a correctly built page, which is the part that actually matters.

**Conclusion.** The `markdown` format is useless for this — it strips form markup. `rawHtml` keeps
every attribute we need. The core product assumption holds: Firecrawl gives us enough structure to
prove a form is broken, not just guess.

**Also learned:** the keyless free tier covers `scrape`, `search`, `interact`, and `parse`.
`crawl`, `map`, and `extract` need a real API key, so multi-page site audits are gated on
finishing account signup.
