# Diana — PA to Dandan

**Independent Deep Learning course companion** for students taught by Dr Dandan Zhang at Imperial College London.

- **GitHub:** https://github.com/dianzdd123/deep-learning-TA
- **Planned student site:** https://dianzdd123.github.io/deep-learning-TA/
- **Owner:** Dandan Zhang
- **Brand:** Diana — PA to Dandan

The application in this repository is independent of the MSEI Lab website, has no dependency on its GitHub repository, and must not use its custom domain. AI chat requires a valid student activation code.

## What students can do

- Browse nine curated Deep Learning teaching topics, with links to relevant tutorials and learning materials.
- Ask a guided teaching question and receive topic-matched explanations with source references.
- Choose **Understand**, **Debug code**, or **Check reasoning**.
- Get help designing reproducible experiments and diagnosing problems without receiving complete assessed solutions.

**The initial static interface is not a live generative AI chatbot.** It can use a live AI service only when a separate secured backend has been deployed and configured. The interface displays which mode is active.

## Publishing with GitHub Pages

1. Open **Settings → Pages** in this GitHub repository.
2. Choose **Build and deployment → Source → Deploy from a branch**.
3. Select **main** and **/(root)**, then save.
4. Open https://dianzdd123.github.io/deep-learning-TA/ once GitHub finishes publishing.

All assets use relative URLs; no custom domain is needed. The static Pages website cannot securely store an API key.

## Update course materials

The curated topics are in [data/knowledge.json](data/knowledge.json). Use GitHub's **Edit** button, adjust topics and/or source links, and commit to `main`. New guidance is visible as soon as GitHub Pages deploys it.

The planned full-handbook workflow is:

1. Review the full handbook and any course announcements, and confirm materials are approved for students.
2. Upload approved full handbook/tutorials under `materials/` (PDF, Markdown, plain text or Jupyter notebooks).
3. Update `materials/manifest.json` with the file path and its authority (full handbook > simplified handbook > lecture/tutorial/FAQ).
4. Run `python scripts/build_materials.py` to update `data/materials-index.json` for reference-based retrieval. The site can then use the generated index for document search; an enabled AI worker can use relevant excerpts to answer.
5. Review answers and citation destinations after publishing. Do not upload drafts, private student data, credentials or unreleased assessment information.

**Policy precedence:** Canvas announcements and the approved full handbook take precedence. The 2026/27 simplified final-project handbook supplied to Diana is labelled for release **10 November 2026**; no assessment details from it are published here before that date. The full handbook has not yet been supplied to this repository.

Existing course tutorials currently link to a **private** GitHub course repository and may need student permissions. Approved public extracts can be added here in due course.

## Student activation-code access (new)

**Diana AI chat is now designed to require a student activation code.**
Public topic cards and permitted teaching resources are still visible to anyone
with the GitHub Pages URL; **a static GitHub Pages site cannot make published
handbooks or files private**. The AI backend checks authorisation on every question.

### Student experience

1. The student opens the Diana site and sees **Activate your Diana access**.
2. The instructor sends them a unique code of the form
   `DIANA-XXXX-XXXX-XXXX-XXXX` through an approved private channel.
3. They enter it, complete Turnstile, and click **Activate Diana**.
4. Cloudflare validates the code and issues a signed browser session (up to
   **24 hours**, or shorter if the code expires first). The signed token is
   stored in this browser tab's session storage, *not the raw activation code*.
5. Every AI question includes the session token. The backend verifies the
   signature **and checks the code's current enabled/expiry status again**,
   rejecting revoked or expired students before invoking OpenAI.
6. Students can click **Deactivate** to remove their local session.

A code is a bearer credential: students **could share it**. This setup
controls who can use the AI API and gives you per-code revocation, but it
does not cryptographically establish a student's university identity.
For stronger identity restrictions, use institutional SSO instead of codes.

### Cloudflare configuration

Create **two** Workers KV namespaces:
- `RATE_LIMIT` for activation-attempt and question limits;
- `ACCESS_CODES` for SHA-256 keys mapped to enabled/expiry metadata.

Edit [backend/wrangler.toml](backend/wrangler.toml) to fill both namespace IDs.
Cloudflare Worker requires **three private secrets**:

```bash
npx wrangler deploy --config backend/wrangler.toml
npx wrangler secret put OPENAI_API_KEY --config backend/wrangler.toml
npx wrangler secret put TURNSTILE_SECRET --config backend/wrangler.toml
npx wrangler secret put SESSION_SECRET --config backend/wrangler.toml
```

Generate a long random `SESSION_SECRET` locally; e.g. this command prints
a 64-character hex value that you enter into the private Wrangler prompt:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Do not publish** any of these secrets, raw activation codes or CSV lists
to GitHub, email groups, public chat, or the browser's `config.json`.

### Issue student activation codes

From your **local terminal** in the cloned `deep-learning-TA` repository,
after `npx wrangler login` and creating both KV namespaces:

```bash
node scripts/issue_codes.mjs --count 30 --expires 2027-01-31 --prefix DL27 --output diana-private-codes.csv
```

This generates **30 different high-entropy codes**, stores their **hashed
keys** and permitted status in Cloudflare ACCESS_CODES, and creates a
**private local** `diana-private-codes.csv` with the code for each student
and the corresponding `kv_key`. The CSV is ignored by Git and must be
stored securely. It contains `label`, `activation_code`, `kv_key`, and
`expiry_utc`. Associate the labels with student recipients only in an
appropriate private institutional record.

Send one code privately to each student. Do not distribute a single code
to the whole class if you need per-student revocation or usage control.
Codes initially permit up to **20 questions per hour** per code (the
Cloudflare KV counter is approximate because KV is eventually consistent).

**Do not distribute codes before verifying that the Cloudflare KV entries
have been provisioned successfully.** If provisioning fails part way through,
inspect the Cloudflare namespace and reconcile the locally saved list;
do not blindly distribute or regenerate codes.

### Revoke a student's code

Use the `kv_key` from your private CSV, without revealing the raw code:

```bash
node scripts/revoke_code.mjs --kv-key access:REPLACE_WITH_THE_64_CHARACTER_HASH
```

This updates the Cloudflare record to `enabled:false`. New activations
are refused and existing sessions fail on the next backend check, subject
to Cloudflare KV propagation delay. For emergency mass invalidation,
rotate `SESSION_SECRET` (invalidates existing signed sessions) and revoke
the affected code entries.

### Privacy, rate limits and student communications

- No university email or CID is collected by this basic activation form.
- A student code is not proof of student identity; treat it as private.
- Avoid collecting student work or personal data via public AI chat.
- Allow authorised students to ask while disabling all AI answers for
  visitors without an active validated session.
- The site remains visibly a public GitHub Pages website; file URLs
  already published there are **not** protected by activation codes.
- For high-volume usage, replace the approximate KV per-hour limiter with
  stronger edge rate limits and review operational costs.
- The activation code checker has not yet been tested against a deployed
  Cloudflare Worker; deploy and test before inviting students.

## Activating live generative AI

**Current state:** structured Diana response prompt and backend code are committed,
but no hosted Worker credentials, KV or Turnstile configuration has been confirmed.
The site defaults to non-generative curated explanations until activation.

### Step 1 — Create an OpenAI API key

At https://platform.openai.com/api-keys, create a project-specific key for
Diana. API usage is billed separately from ChatGPT. Configure an appropriate
spending limit/alerts on your OpenAI Platform project. Never copy the key into
this repository, a notebook, or the website's public `config.json`.

### Step 2 — Prepare Cloudflare

Sign in to https://dash.cloudflare.com/ and create a Cloudflare Workers
project. Create two KV namespaces for rate limiting and student access codes; copy **their namespace IDs**
(not a secret). Create a Cloudflare Turnstile widget allowing the hostname
`dianzdd123.github.io`, and save its **public site key** and **secret key**
separately. Turnstile verifies requests but is not a substitute for stronger
Cloudflare WAF rate limiting or budget limits.

### Step 3 — Deploy the Worker using Wrangler

Install Node.js if necessary and clone this repository to your computer:

```bash
git clone https://github.com/dianzdd123/deep-learning-TA.git
cd deep-learning-TA
```

Edit `backend/wrangler.toml`: replace
`REPLACE_WITH_YOUR_CLOUDFLARE_KV_NAMESPACE_ID` with the actual namespace ID.

```bash
npx wrangler login
npx wrangler deploy --config backend/wrangler.toml
npx wrangler secret put OPENAI_API_KEY --config backend/wrangler.toml
npx wrangler secret put TURNSTILE_SECRET --config backend/wrangler.toml
```

Deploy first to create the Worker, then paste the two secret values only into the private terminal prompts,
not into the command arguments or GitHub. Record the resulting Worker
HTTPS address (typically an address ending in `.workers.dev`).

You can choose the model in the `OPENAI_MODEL` variable in
`backend/wrangler.toml`; the example is `gpt-4.1-mini`.
The backend uses the OpenAI Responses API with a strict JSON schema,
sends `store:false`, and returns structured responses rather than
unstructured text.

### Step 4 — Switch on the student website

Edit `config.json` via GitHub (the site configuration is public,
so put **only** these non-secret values there):

```json
{
  "assistant_name": "Diana",
  "subtitle": "PA to Dandan",
  "course": "Deep Learning",
  "institution": "Imperial College London",
  "model_service_url": "https://YOUR-WORKER-URL.workers.dev",
  "turnstile_site_key": "YOUR-PUBLIC-TURNSTILE-SITE-KEY",
  "allow_live_ai": true
}
```

Commit, wait for GitHub Pages to publish, then open
https://dianzdd123.github.io/deep-learning-TA/ in a fresh private window.
Confirm the Turnstile verification appears and succeeds; a reply should be
displayed under **My brief answer**, with optional **In your handbook**,
**In your lecture slides**, **In the practical tutorials**, and
**External learning resources** headings.

### Step 5 — Publish approved teaching documents for precise citations

Edit `materials/manifest.json` after uploading approved documents
under `materials/`. Example once approved for student release:

```json
{
  "version": "2026-11-approved",
  "documents": [
    {
      "id": "full-handbook",
      "title": "Deep Learning Full Handbook 2026/27",
      "path": "materials/full-handbook.pdf",
      "kind": "handbook",
      "authority": "full-handbook"
    },
    {
      "id": "lecture-01",
      "title": "Lecture 1: Deep Learning Foundations",
      "path": "materials/lecture-01.pptx",
      "kind": "slides",
      "authority": "lecture"
    }
  ]
}
```

After you commit the files, GitHub Actions runs
`python scripts/build_materials.py` and commits
`data/materials-index.json`. The index records exact **PDF page
numbers** and exact **PowerPoint slide numbers** (not guessed numbers).
For manual regeneration:

```bash
python -m pip install pypdf python-pptx
python scripts/build_materials.py
git add materials/ data/materials-index.json
git commit -m "Publish approved Deep Learning materials"
git push
```

The live Worker fetches the public index (90-second edge cache) and
retrieves excerpts relevant to a student question. It only permits
citation IDs actually present in the indexed material, and the frontend
renders those links alongside the answer. Adding lecture slides as PDF
alone is not enough to establish *slide* numbers; use PPTX for slide indexing.

**No hallucinated citations:** the bot will state that a handbook page or
slide number is unavailable when not indexed. The simplified handbook is
labelled for release 10 November 2026, so it has deliberately not been
published as public source material before that date. Check the full
handbook and Canvas before publicising assessment rules.

### Customise Diana's teaching prompt

Edit [backend/prompt.js](backend/prompt.js). It defines the assistant's
personality, source hierarchy, teaching approach, and the required JSON
answer fields. Deploy the Worker again after changing it:

```bash
npx wrangler deploy --config backend/wrangler.toml
```

The default response is:

- “Hi, I'm Diana. Here's my answer.”
- **My brief answer:** a direct response.
- **Let's understand why:** short optional explanation.
- **In your handbook:** verified page/section, when indexed.
- **In your lecture slides:** verified slide number, when indexed.
- **In the practical tutorials:** a link to an approved tutorial.
- **External learning resources:** explicitly labelled additional reading.
- **Try this next:** a single constructive learning question.

### Operations, privacy and tests

- Require HTTPS, verify Turnstile on the backend and monitor costs.
- KV throttling uses an IP-derived hourly key; it is approximate because KV
  writes are eventually consistent. Add actual Cloudflare rate limiting.
- Students should not submit personal or confidential information or full
  assessed submissions; review applicable Imperial data/AI guidance.
- Test unsupported questions and stale handbook claims. Keep a human escalation
  route for official coursework decisions.
- Test from the deployed GitHub Pages domain: the Worker only permits
  `https://dianzdd123.github.io` as the browser origin.
- Check GitHub Pages actually publishes the generated index after the bot's
  commit. If Pages does not automatically publish bot commits, initiate a
  deployment or make a subsequent human commit to `main`.

## Repository structure

```text
index.html                 Standalone responsive student website
app.js, styles.css         Browser interface and offline study-guide mode
icon.svg                   Diana visual identity
config.json                Public, non-secret settings
data/knowledge.json        Curated topic explanations and source links
data/materials-index.json  Automatically generated excerpts for retrieval
materials/manifest.json    Approved public document list
materials/                 Approved course material uploads
scripts/build_materials.py Material-to-index generation
backend/worker.js          Optional secure AI backend; not part of Pages
```

Diana complements the module team. She is not a person, does not award marks, and cannot replace official course policies, assessment advice, or support channels.
