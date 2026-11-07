# Diana — PA to Dandan

**Independent Deep Learning course companion** for students taught by Dr Dandan Zhang at Imperial College London.

- **GitHub:** https://github.com/dianzdd123/deep-learning-TA
- **Planned student site:** https://dianzdd123.github.io/deep-learning-TA/
- **Owner:** Dandan Zhang
- **Brand:** Diana — PA to Dandan

The application in this repository is independent of the MSEI Lab website, has no dependency on its GitHub repository, and must not use its custom domain.

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

## Enabling live AI securely

The optional [Cloudflare Worker example](backend/worker.js) is not deployed.

Deploy that worker separately and configure the secrets `OPENAI_API_KEY`, `TURNSTILE_SECRET`, and a KV binding `RATE_LIMIT`. Add Cloudflare WAF rate limits and any institutional privacy review required before enabling access. Create a Turnstile public site key for `dianzdd123.github.io`, then set the worker HTTPS endpoint and public Turnstile site key in [config.json](config.json), and set `allow_live_ai` to `true`. Never commit API tokens or Turnstile secrets to GitHub.

The worker looks up curated source excerpts and approved uploaded materials; source links are references to verify, **not proof that AI-generated claims are correct**. Configure OpenAI usage limits and monitor costs.

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
