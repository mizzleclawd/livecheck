# Livecheck — Week 1 (Aug 25 → Sep 1)

**Deadline: Sep 22, 12:00 PM PT.** Four weeks. Winners Sep 25.
**Principle: prove the riskiest thing first, before building anything pretty.**

---

## 🛑 BLOCKER — must clear before submission is even possible

**All three GitHub PATs are DEAD (HTTP 401):** `DMDTECH_GITHUB_PAT`, `kascade_github_token`,
`WHITEROSE_GITHUB_PAT`. Verified 2026-08-25.

**A public GitHub repo is a hard requirement.** No private repos allowed, no exceptions.
Right now we cannot push. Dee needs to mint a fresh PAT with `repo` scope. Classic PATs cannot
be created via API — this is a browser task, ~5 minutes, and it's on the critical path.

Also outstanding: **Stripe live key is expired.** Not needed for the hackathon, but needed the
moment Livecheck charges anyone.

---

## Day 1–2: kill the riskiest assumption

**The question that decides everything: can Firecrawl actually detect a broken contact form?**

Everything else is achievable. This one is not obvious — a form with no `action`, or one
pointing at a dead endpoint, may or may not be visible from a crawl.

- Build three deliberately broken test sites (AI-generated, deployed): one with a dead form,
  one with no SSL, one with a collapsed mobile viewport.
- Point raw Firecrawl at them. **Can it see the failures?**
- **If yes** → commit, proceed to Day 3.
- **If no** → the fix path changes shape immediately. Better to know on Day 2 than Day 20.

Do not write frontend code until this is answered.

## Day 3–4: Convex spine
- `npm create convex`, schema for `sites`, `scans`, `findings`, `certificates`.
- Scan as a **scheduled function**, not a request handler — this is what gives us real live
  progress, and Convex depth is explicitly scored.
- Real-time query driving a scan-progress view. **The judges need to SEE it working live**;
  "a thin frontend on a hosted page does not count."

## Day 5: AgentMail — the differentiator
- Provision an inbox per site. Prove an inbound message lands and appears in the Convex UI live.
- This is the thing that turns a report into a fix, and most entrants will use AgentMail
  as a notification sender. Inbound is the interesting direction.

## Day 6: OpenAI translation layer
- Findings → plain English. Ruthlessly non-technical.
- Bad: "meta description absent." Good: "Google has nothing to show under your name in search
  results."

## Day 7: ship something ugly but live
- Deploy to `convex.site`. **A live URL beats a prettier local build.**
- First real scan end to end, on a real site.
- Update `hackathon.md`. Judges read the log — it is a primary artifact, not a formality.
- Post the build on X/LinkedIn tagging @convex @OpenAI @firecrawl @agentmail. **Social proof is
  a scored criterion**, and starting week one beats one post at the end.

---

## What week 1 does NOT include
Auth. Payments. Pretty design. The certificate page. Any "expand into data pipelines and
automations" ambition. All of it is week 2+ and none of it is what fails a submission.

## Scoring guardrails — re-read before every decision
- **"Everyday apps, not developer tools."** If a screen would only make sense to an engineer,
  it is wrong. The user is a shop owner who is scared their site is broken.
- **"Copycats score low."** This idea came from a public idea-of-the-day list that thousands
  received the same morning. Assume direct competitors in this hackathon. **Our separation is
  the certificate as portable public proof, plus real security depth behind the checks.**
- **Sponsors must "generate, crawl, or send, not just sit in the README."**
- **Under 3 minutes of video. "Talk less, click through."**
