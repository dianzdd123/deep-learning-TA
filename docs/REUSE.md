# Reusing deep-learning-TA

Diana: independent Deep Learning course companion.

**Current scope:** Static topic guidance works independently; live AI requires a configured backend and valid activation code.


## Run the static interface locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` in a browser. Use HTTP serving rather than opening `index.html` as a file, so JSON fetches work. Local static preview does not activate the AI service. Backend CORS configuration must explicitly permit the development origin if live local testing is intended.

## Source map

| Path | Responsibility |
|---|---|
| `index.html`, `app.js`, `styles.css` | Browser interface and offline study guidance |
| `config.json` | Public service URL, display settings and feature flags |
| `data/knowledge.json` | Curated explanations and links |
| `materials/manifest.json` | Approved material inventory |
| `scripts/build_materials.py` | Build `data/materials-index.json` with source references |
| `backend/access.js` | Activation-code and signed-session checks |
| `backend/prompt.js`, `backend/worker.js` | Teaching prompt, retrieval and optional AI service |
| `scripts/issue_codes.mjs`, `scripts/revoke_code.mjs` | Instructor access administration |

## Checks

Use a current Node.js LTS release (Node 22 or newer) for the built-in test runner and web APIs:

```bash
npm test
npm run check
python scripts/check_repository.py
```

These checks do not issue codes, contact an AI service or deploy a Worker. Material indexing additionally needs `pypdf` and `python-pptx` for those file types. Check the generated index and its source destinations before publishing.

## Adapting for another course

Change the course identity, curated knowledge, approved material manifest and source hierarchy together. Set the new public backend URL and deployment origin; keep signing keys, API keys, private activation-code exports and student data outside this public repository. Follow the full README's backend deployment and access-code instructions, then test activation, expiry, revocation, unsupported questions and citation links.

A static public site makes its published files publicly retrievable. Activation codes protect backend use; they do not protect public PDFs or create verified university identities. Canvas and approved course documents remain authoritative for assessment decisions. Diana stays separate from the lab website and its domain.

## Limits

Unit tests validate the implemented access logic in isolation. Live billing, bot protection, provider responses, deployment bindings and browser behaviour require deployment-specific checks. Keep future teaching material and assessed solutions out of the public material index.

## Attribution and reuse permissions

No repository-wide licence file is included in this checkout. Confirm reuse and redistribution permissions with the relevant rights holders; this maintenance update does not add a licence or relicense upstream code, data or assets.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the local workflow and what to include with a proposed change.
