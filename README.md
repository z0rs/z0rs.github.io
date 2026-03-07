# z0rs.github.io

Personal security research blog and portfolio — built with Gatsby 5, MDX, TailwindCSS, and serverless API functions.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Build Instructions](#build-instructions)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Architecture

The site is a **Gatsby 5 static site** with the following data pipeline:

```
content/
  articles/   ← MDX files  ──┐
  ctfs/       ← MDX files  ──┼──► gatsby-source-filesystem
  pages/      ← MDX + JSON ──┘         │
                                        ▼
                               gatsby-plugin-mdx (v5)
                               gatsby-transformer-json
                               gatsby-transformer-sharp
                                        │
                                        ▼
                                  GraphQL Data Layer
                                        │
                                        ▼
                             gatsby-node.js createPages()
                             ├── src/templates/article.js
                             ├── src/templates/ctf.js
                             └── src/templates/page.js
                                        │
                                        ▼
                               Static HTML + JS bundles
                                  → public/
```

### Content System

MDX files live in `content/` and are sourced via `gatsby-source-filesystem`. Each file has frontmatter that defines its `type` (`article`, `ctf`, `page`), which determines which template is used for rendering.

**gatsby-plugin-mdx v5** compiles MDX to React components. Templates receive the compiled MDX as `children` (no `MDXRenderer` or `body` field — those were removed in v5).

Custom MDX components (links, code blocks, embeds) are injected via `MDXProvider` inside `src/components/mdx-parser.js`.

### Serverless API

Gatsby Functions in `src/api/` are deployed as serverless endpoints:

| Endpoint | Purpose |
|---|---|
| `/api/fauna-add-reaction` | Write a reaction to FaunaDB |
| `/api/fauna-latest-reaction` | Fetch the most recent reaction |
| `/api/fauna-reaction-by-slug` | Fetch reactions for a page |
| `/api/newsletter` | Newsletter signup (ConvertKit) |
| `/api/ua-analytics` | Proxy to Google Analytics Data API |

### Styling

TailwindCSS v3 with the `@tailwindcss/typography` plugin provides all styling. PostCSS + Autoprefixer handle transforms. Custom colours are defined in `tailwind.config.js`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Gatsby 5, React 18 |
| Content | MDX (`gatsby-plugin-mdx` v5, `@mdx-js/react` v2) |
| Styling | TailwindCSS 3, PostCSS, Autoprefixer |
| 3D / Viz | Three.js, `@react-three/fiber`, `@react-three/drei`, `d3-geo`, `dotted-map` |
| Backend | Gatsby Functions, FaunaDB, Google Analytics Data API |
| Images | `gatsby-plugin-image`, `gatsby-plugin-sharp` |
| Deployment | GitHub Pages via GitHub Actions |
| Code Quality | Prettier, Husky, commitlint |

---

## Project Structure

```
.
├── content/
│   ├── articles/       # Security article MDX files
│   ├── ctfs/           # CTF write-up MDX files (organised by year/month)
│   └── pages/          # Top-level page MDX files (index, about, etc.)
├── src/
│   ├── api/            # Gatsby serverless functions
│   ├── components/     # React components
│   ├── context/        # React context (app state)
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Static Gatsby pages (404, analytics, test)
│   ├── styles/         # Global CSS
│   ├── templates/      # Page templates (article, ctf, page)
│   └── utils/          # Utility functions
├── static/             # Static assets (fonts, images, favicon)
├── gatsby-browser.js   # Browser-side Gatsby APIs
├── gatsby-config.js    # Gatsby configuration + plugins
├── gatsby-node.js      # Node.js build-time APIs (createPages, schema)
├── gatsby-ssr.js       # SSR-side Gatsby APIs
├── tailwind.config.js  # TailwindCSS configuration
└── postcss.config.js   # PostCSS configuration
```

---

## Build Instructions

### Prerequisites

- Node.js >= 18 (see `.nvmrc`)
- Yarn

### Install dependencies

```bash
yarn install
```

### Development server

```bash
yarn develop
# Site available at http://localhost:8000
# GraphiQL at http://localhost:8000/___graphql
```

### Production build

```bash
yarn build
```

Output is written to `public/`.

### Serve production build locally

```bash
yarn serve
```

### Clean Gatsby cache

```bash
yarn clean
# or: gatsby clean
```

---

## Deployment

The site deploys automatically to **GitHub Pages** on every push to `master`.

### CI/CD Pipeline (`.github/workflows/gatsby.yml`)

1. Checkout source
2. Detect package manager (yarn)
3. Setup Node 18
4. Configure GitHub Pages
5. Restore Gatsby build cache (keyed on `yarn.lock`)
6. `yarn install`
7. `gatsby build` with `PREFIX_PATHS=true` and `--max-old-space-size=4096`
8. Upload `public/` as a Pages artifact
9. Deploy to GitHub Pages

### Path prefix

The site is served from `/z0rs.github.io`. This is configured via `pathPrefix` in `gatsby-config.js` and enabled at build time with `PREFIX_PATHS=true`.

---

## Environment Variables

Copy `.env` and fill in the values. The file is loaded by `dotenv` in `gatsby-config.js`.

| Variable | Description |
|---|---|
| `GATSBY_API_URL` | Base URL for API calls |
| `GATSBY_TWITTER_USERNAME` | Twitter/X username for webmentions |
| `GATSBY_GA_MEASUREMENT_ID` | Google Analytics measurement ID |
| `CK_FORM_ID` | ConvertKit form ID (newsletter) |
| `CK_API_KEY` | ConvertKit API key |
| `FAUNA_KEY` | FaunaDB secret key |
| `URL` | Canonical site URL (used in `siteMetadata.siteUrl`) |

GitHub Actions secrets required for CI: `GATSBY_GA_MEASUREMENT_ID`, `FAUNA_KEY`, `CK_API_KEY`, `CK_FORM_ID`, `URL`.

---

## Troubleshooting

### `gatsby-plugin-mdx` version mismatch

**Symptom:** `warning Plugin gatsby-plugin-mdx is not compatible with your gatsby version 5.0.0`

**Fix:** Ensure `gatsby-plugin-mdx@^5.0.0` is installed. The project requires `@mdx-js/react@^2` and `@mdx-js/mdx@^2` alongside it.

```bash
yarn add gatsby-plugin-mdx@^5 @mdx-js/react@^2 @mdx-js/mdx@^2
```

---

### `unstable_shouldOnCreateNode` error

**Symptom:**
```
error Your plugins must export known APIs from their gatsby-node.js.
- The plugin gatsby-plugin-mdx@3.x.x is using the API "unstable_shouldOnCreateNode" which is not a known API.
```

**Cause:** `gatsby-plugin-mdx@3` uses an API that was renamed in Gatsby 5.

**Fix:** Upgrade `gatsby-plugin-mdx` to v5 (see above).

---

### `MDXRenderer` not found / `body` field missing from GraphQL

**Symptom:** Build error mentioning `MDXRenderer` is not exported, or GraphQL query failing on `body` field.

**Cause:** `gatsby-plugin-mdx@5` removed both `MDXRenderer` and the `body` GraphQL field. MDX content is now rendered via `children` passed to the template component.

**Fix:** Templates should accept a `children` prop and pass it to `<MdxParser>` rather than querying and using `body`. The `mdx-parser.js` component wraps children in `MDXProvider` — no `MDXRenderer` is needed.

---

### `NODE_TLS_REJECT_UNAUTHORIZED=0` warning

**Symptom:**
```
Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections insecure by disabling certificate verification.
```

**Cause:** The old CI workflow set this variable, which disables TLS certificate validation for all outbound HTTPS connections made during the build. This is a **security risk** — it can expose credentials and API responses to man-in-the-middle attacks.

**Fix:** Remove `NODE_TLS_REJECT_UNAUTHORIZED` from the workflow entirely. If a build-time TLS issue appears, the correct fix is to install the correct CA certificate, not to disable verification globally.

---

### Out of memory during build

**Symptom:** `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`

**Fix:** The CI workflow already passes `--max-old-space-size=4096`. For local builds, run:

```bash
NODE_OPTIONS='--max-old-space-size=4096' gatsby build
```

---

### Stale Gatsby cache causing build failures

```bash
gatsby clean
gatsby build
```

---

### Browserslist outdated warning

**Symptom:** `Browserslist: caniuse-lite is outdated`

**Fix:**
```bash
npx update-browserslist-db@latest
```
