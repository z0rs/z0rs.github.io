# z0rs.github.io

Personal security research blog and portfolio — built with Gatsby 5, MDX v2, TailwindCSS, and serverless API functions.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Build Instructions](#build-instructions)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Migration Notes: Gatsby 5 + gatsby-plugin-mdx v5](#migration-notes-gatsby-5--gatsby-plugin-mdx-v5)
- [Troubleshooting](#troubleshooting)

---

## Architecture

The site is a **Gatsby 5 static site** with the following data pipeline:

```
content/
  articles/   <- MDX files  --+
  ctfs/       <- MDX files  --+--> gatsby-source-filesystem
  pages/      <- MDX + JSON --+         |
                                        v
                               gatsby-plugin-mdx (v5)
                               gatsby-transformer-json
                               gatsby-transformer-sharp
                                        |
                                        v
                                  GraphQL Data Layer
                                        |
                                        v
                             gatsby-node.js createPages()
                             +-- src/templates/article.js
                             +-- src/templates/ctf.js
                             +-- src/templates/page.js
                                        |
                                        v
                               Static HTML + JS bundles
                                  -> public/
```

### Content System

MDX files live in `content/` and are sourced via `gatsby-source-filesystem`. Each file's frontmatter defines its `type` (`article`, `ctf`, `page`), which determines which template renders it.

**gatsby-plugin-mdx v5** compiles MDX to React components. Templates receive the compiled MDX as `children` via the `?__contentFilePath=` mechanism — there is no `MDXRenderer` or `body` field (both were removed in v5).

Custom MDX components (links, code blocks, embeds, `LatestArticles`, `AllCtfs`, etc.) are injected globally via `MDXProvider` in `src/components/mdx-parser.js`. MDX content files must **not** contain direct `import` statements — components must be registered in the provider instead.

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

TailwindCSS v3 with `@tailwindcss/typography` provides all styling. PostCSS + Autoprefixer handle transforms. Custom colours are defined in `tailwind.config.js`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Gatsby 5, React 18 |
| Content | MDX v2 (`gatsby-plugin-mdx` v5, `@mdx-js/react` v2, `@mdx-js/mdx` v2) |
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
+-- content/
|   +-- articles/       # Security article MDX files
|   +-- ctfs/           # CTF write-up MDX files (organised by year/month)
|   +-- pages/          # Top-level page MDX files (index, about, etc.)
+-- src/
|   +-- api/            # Gatsby serverless functions
|   +-- components/     # React components
|   +-- context/        # React context (app state)
|   +-- hooks/          # Custom React hooks
|   +-- pages/          # Static Gatsby pages (404, analytics, test)
|   +-- styles/         # Global CSS
|   +-- templates/      # Page templates (article, ctf, page)
|   +-- utils/          # Utility functions
+-- static/             # Static assets (fonts, images, favicon)
+-- gatsby-browser.js   # Browser-side Gatsby APIs
+-- gatsby-config.js    # Gatsby configuration + plugins
+-- gatsby-node.js      # Node.js build-time APIs (createPages, schema)
+-- gatsby-ssr.js       # SSR-side Gatsby APIs
+-- tailwind.config.js  # TailwindCSS configuration
+-- postcss.config.js   # PostCSS configuration
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

The site is served from `/z0rs.github.io`. This is configured via `pathPrefix` in `gatsby-config.js` and is only applied when `PREFIX_PATHS=true` is set, so local dev and Netlify deploy-previews work without it.

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

## Migration Notes: Gatsby 5 + gatsby-plugin-mdx v5

This section documents every breaking change resolved during the Gatsby 4 -> Gatsby 5 / gatsby-plugin-mdx v3 -> v5 migration.

### 1. Dependency upgrades

```json
"gatsby-plugin-mdx": "^5.0.0",
"@mdx-js/mdx": "^2.3.0",
"@mdx-js/react": "^2.3.0"
```

`gatsby-config.js` change: rehype plugins must be nested under `mdxOptions` (was `options`).

### 2. MDXRenderer removed — use children

`gatsby-plugin-mdx` v5 removed `MDXRenderer` and the `body` GraphQL field. Templates now receive compiled MDX as React `children` via the `?__contentFilePath=` mechanism.

`gatsby-node.js` `createPage` call:
```js
const template = path.join(__dirname, `./src/templates/${type}.js`);
component: `${template}?__contentFilePath=${contentFilePath}`,
```

Templates accept `children`:
```js
// Before (v3):
const Page = ({ data: { mdx: { body } } }) => <MdxParser>{body}</MdxParser>
// After (v5):
const Page = ({ data, children }) => <MdxParser>{children}</MdxParser>
```

### 3. No direct imports inside MDX content files

MDX v2 imports inside `.mdx` files are silently dropped by webpack when using `?__contentFilePath=`. Any component used in MDX must be registered in `MDXProvider` in `src/components/mdx-parser.js`. Remove all `import` statements from `.mdx` files.

### 4. MDX v2 is a strict JSX parser

MDX v2 treats `.mdx` files as JSX. Constructs valid in MDX v1 that now cause build errors:

| Construct | Fix |
|---|---|
| HTML comments `<!-- ... -->` | Remove entirely |
| Bare `<` in prose (e.g. `<192.168.1.1:80>`) | Wrap in backticks |
| CTF flags `{flag_value}` outside code fences | Wrap in backticks |
| Special chars in filename (`&`, `%`, `#`, `?`) | Rename file; sanitise slug in `gatsby-node.js` |

Slug sanitisation in `gatsby-node.js`:
```js
const rawPath = createFilePath({ node, getNode });
const sanitised = rawPath
  .replace(/&/g, '-and-')
  .replace(/[%#?]/g, '-')
  .replace(/-{2,}/g, '-');
```

### 5. useStaticQuery must not appear in Gatsby Head API exports

Calling `useStaticQuery` inside a `Head` export from an MDX-backed template causes a crash on large articles. Gatsby's worker-based static query registration fails for large `?__contentFilePath=` webpack chunks, leaving the query hash unregistered. At SSR time, `useStaticQuery` throws `The result of this StaticQuery could not be fetched`.

**Fix:** `seo.js` no longer calls `useStaticQuery`. All callers pass `siteMetadata` as a prop sourced from the page-level GraphQL query:

```js
// In each template's GraphQL query:
site {
  siteMetadata { name siteUrl defaultImage keywords }
}

// In the Head export:
export const Head = ({ data: { site: { siteMetadata }, mdx: { ... } } }) => (
  <Seo ... siteMetadata={siteMetadata} />
);
```

### 6. TLS errors from remote featuredImages

Some articles reference images at `inseclab.uit.edu.vn`, which has an incomplete TLS chain. Each `createRemoteFileNode` call is wrapped in try/catch so the build continues gracefully. Affected articles render without a featured image. All image-consuming components guard against `null` thumbnails with optional chaining.

### 7. null featuredImage crashes

Components that destructure `featuredImage.childImageSharp.thumbnail` directly throw if the image was not fetched. All list and card components use safe destructuring:
```js
const thumbnail = featuredImage?.childImageSharp?.thumbnail ?? null;
{thumbnail && <GatsbyImage image={thumbnail} alt={...} />}
```

---

## Troubleshooting

### `gatsby-plugin-mdx` version mismatch

**Symptom:** `warning Plugin gatsby-plugin-mdx is not compatible with your gatsby version 5.0.0`

**Fix:**
```bash
yarn add gatsby-plugin-mdx@^5 @mdx-js/react@^2 @mdx-js/mdx@^2
```

---

### `unstable_shouldOnCreateNode` error

**Symptom:**
```
error Your plugins must export known APIs from their gatsby-node.js.
- The plugin gatsby-plugin-mdx@3.x.x is using the API "unstable_shouldOnCreateNode"
```

**Cause:** `gatsby-plugin-mdx@3` used an API renamed in Gatsby 5. **Fix:** Upgrade to `gatsby-plugin-mdx@5`.

---

### `MDXRenderer` not found / `body` field missing

**Cause:** Both were removed in `gatsby-plugin-mdx@5`. See [Migration Notes §2](#2-mdxrenderer-removed--use-children).

---

### `The result of this StaticQuery could not be fetched`

**Symptom:**
```
WebpackError: The result of this StaticQuery could not be fetched.
  - seo.js:NN
```

**Cause:** `useStaticQuery` inside a `Head` export on a large MDX-backed page. See [Migration Notes §5](#5-usestaticquery-must-not-appear-in-gatsby-head-api-exports).

---

### MDX parse error: identifier `is not defined` on CTF flags

**Symptom:** `ReferenceError: flag_value is not defined`

**Cause:** MDX v2 treats `{...}` in prose as JSX expressions. **Fix:** Wrap in backticks: `` `CTF{flag_value}` ``

---

### Blank page / MDX content not rendering

**Possible causes:**

1. Missing `?__contentFilePath=` in `createPage()` — see [Migration Notes §2](#2-mdxrenderer-removed--use-children)
2. Direct `import` statements in `.mdx` files — see [Migration Notes §3](#3-no-direct-imports-inside-mdx-content-files)
3. Null `featuredImage` crashing the React tree — see [Migration Notes §7](#7-null-featuredimage-crashes)

---

### `NODE_TLS_REJECT_UNAUTHORIZED=0` in CI

**Risk:** Disables TLS verification for all outbound HTTPS during the build — a security vulnerability. **Fix:** Remove the variable from the workflow and wrap individual `createRemoteFileNode` calls in try/catch instead.

---

### Out of memory during build

```bash
NODE_OPTIONS='--max-old-space-size=4096' gatsby build
```

---

### Stale Gatsby cache

```bash
gatsby clean && gatsby build
```

---

### Browserslist outdated warning

```bash
npx update-browserslist-db@latest
```
