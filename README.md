# z0rs.github.io

Personal security research blog and portfolio — built with Gatsby 5, MDX v2, TailwindCSS, and serverless API functions.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Build Instructions](#build-instructions)
- [Deployment](#deployment)
- [Write Panel](#write-panel)
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
                             +-- src/write-page.js (/write)
                                        |
                                        v
                               Static HTML + JS bundles
                                  -> public/
```

### Runtime Modes

The project uses `GATSBY_RUNTIME` to separate static-site mode and write-admin mode:

- `github` -> GitHub Pages build mode. `/write/` is skipped in `gatsby-node.js`.
- `local` -> local development mode. Write API reads/writes local filesystem.
- `netlify` -> Netlify runtime mode. Write API uses GitHub REST API and triggers `gatsby.yml`.

### Content System

MDX files live in `content/` and are sourced via `gatsby-source-filesystem`. Each file's frontmatter defines its `type` (`article`, `ctf`, `page`), which determines which template renders it.

**gatsby-plugin-mdx v5** compiles MDX to React components. Templates receive the compiled MDX as `children` via the `?__contentFilePath=` mechanism — there is no `MDXRenderer` or `body` field (both were removed in v5).

Custom MDX components (links, code blocks, embeds, `LatestArticles`, `AllCtfs`, etc.) are injected globally via `MDXProvider` in `src/components/mdx-parser.js`. MDX content files must **not** contain direct `import` statements — components must be registered in the provider instead.

### Serverless API

Gatsby Functions in `src/api/` are deployed as serverless endpoints:

| Endpoint                      | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `/api/fauna-add-reaction`     | Write a reaction to FaunaDB        |
| `/api/fauna-latest-reaction`  | Fetch the most recent reaction     |
| `/api/fauna-reaction-by-slug` | Fetch reactions for a page         |
| `/api/newsletter`             | Newsletter signup (ConvertKit)     |
| `/api/ua-analytics`           | Proxy to Google Analytics Data API |
| `GET /api/write`              | Load an existing article by slug   |
| `POST /api/write`             | Create / update article MDX        |
| `DELETE /api/write`           | Delete article MDX by slug         |
| `POST /api/write-image`       | Upload image and return MDX snippet |

### Styling

TailwindCSS v3 with `@tailwindcss/typography` provides all styling. PostCSS + Autoprefixer handle transforms. Custom colours are defined in `tailwind.config.js`.

---

## Tech Stack

| Layer        | Technology                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| Framework    | Gatsby 5, React 18                                                          |
| Content      | MDX v2 (`gatsby-plugin-mdx` v5, `@mdx-js/react` v2, `@mdx-js/mdx` v2)       |
| Styling      | TailwindCSS 3, PostCSS, Autoprefixer                                        |
| 3D / Viz     | Three.js, `@react-three/fiber`, `@react-three/drei`, `d3-geo`, `dotted-map` |
| Backend      | Gatsby Functions, FaunaDB, Google Analytics Data API, GitHub Content API    |
| Images       | `gatsby-plugin-image`, `gatsby-plugin-sharp`                                |
| Deployment   | GitHub Pages (public site) + Netlify (write panel runtime)                  |
| Code Quality | Prettier, Husky, commitlint                                                 |

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
|   |   +-- write.js         # Article CRUD API (GET/POST/DELETE)
|   |   +-- write-image.js   # Image upload API
|   +-- components/     # React components
|   +-- context/        # React context (app state)
|   +-- hooks/          # Custom React hooks
|   +-- pages/          # Static Gatsby pages (404, analytics, test)
|   +-- styles/         # Global CSS
|   +-- templates/      # Page templates (article, ctf, page)
|   +-- utils/          # Utility functions
|   +-- write-page.js   # /write admin panel
+-- static/             # Static assets (fonts, images, favicon)
+-- gatsby-browser.js   # Browser-side Gatsby APIs
+-- gatsby-config.mjs   # Gatsby configuration + plugins
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
GATSBY_RUNTIME=local yarn develop
# Site available at http://localhost:8000
# GraphiQL at http://localhost:8000/___graphql
# Write Panel at http://localhost:8000/write/
```

### Production build

```bash
GATSBY_RUNTIME=github yarn build
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

The repo currently uses two runtime targets:

- **GitHub Pages** -> public site at `https://z0rs.github.io/`
- **Netlify** -> write-admin runtime (`/write` + Gatsby Functions)

### GitHub Pages pipeline (`.github/workflows/gatsby.yml`)

1. Checkout source
2. Detect package manager (yarn)
3. Setup Node 18
4. Configure GitHub Pages
5. `yarn install --frozen-lockfile`
6. Clear stale `.cache` and `public`
7. Build with `GATSBY_RUNTIME=github` and `NODE_OPTIONS=--max-old-space-size=4096`
8. Upload `public/` as a Pages artifact
9. Deploy to GitHub Pages

The site is served from the root domain `https://z0rs.github.io/` (no `pathPrefix`).

---

## Write Panel

`/write/` is an admin-style page generated from `src/write-page.js`.

Capabilities:

- Create article
- Update article (load via Recent Articles -> Edit)
- Delete article (Danger Zone)
- Upload image to `/static/images/uploads/YYYY/MM/`

Runtime behavior:

- **Local (`GATSBY_RUNTIME=local`)**:
  - APIs read/write local filesystem.
  - You still need manual git commit/push for production changes.
- **Netlify (`GATSBY_RUNTIME=netlify`)**:
  - APIs use GitHub REST API via `GITHUB_TOKEN`.
  - Article/image updates are committed directly to GitHub.
  - Site rebuild is triggered by dispatching workflow `gatsby.yml`.
- **GitHub Pages (`GATSBY_RUNTIME=github`)**:
  - `/write/` is not created at build time.

Auth model:

- Local: any non-empty bearer token is accepted.
- Production runtime: requires `Authorization: Bearer <WRITE_SECRET>`.

## Environment Variables

Copy `.env` and fill in the values. The file is loaded by `dotenv` in `gatsby-config.mjs`.

| Variable                   | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| `GATSBY_RUNTIME`           | Runtime mode: `local`, `netlify`, or `github`                              |
| `WRITE_SECRET`             | Bearer token required by `/api/write` and `/api/write-image` in production |
| `GITHUB_TOKEN`             | Token used by write APIs to commit files and trigger rebuilds               |
| `GATSBY_API_URL`           | Base URL for API calls                                                      |
| `GATSBY_TWITTER_USERNAME`  | Twitter/X username for webmentions                                          |
| `GATSBY_GA_MEASUREMENT_ID` | Google Analytics measurement ID                                             |
| `CK_FORM_ID`               | ConvertKit form ID (newsletter)                                             |
| `CK_API_KEY`               | ConvertKit API key                                                          |
| `FAUNA_KEY`                | FaunaDB secret key                                                          |
| `URL` / `SITE_URL`         | Canonical site URL (used in `siteMetadata.siteUrl`)                        |

GitHub Actions secrets required for CI: `GATSBY_GA_MEASUREMENT_ID`, `FAUNA_KEY`, `CK_API_KEY`, `CK_FORM_ID` (and optionally `URL`/`SITE_URL` if overriding the default production domain).

For Netlify write runtime, set at minimum:

- `GATSBY_RUNTIME=netlify`
- `WRITE_SECRET=<strong-random-value>`
- `GITHUB_TOKEN=<PAT with contents:write and workflows:write>`

---

## Migration Notes: Gatsby 5 + gatsby-plugin-mdx v5

This section documents every breaking change resolved during the Gatsby 4 -> Gatsby 5 / gatsby-plugin-mdx v3 -> v5 migration.

### 1. Dependency upgrades

```json
"gatsby-plugin-mdx": "^5.0.0",
"@mdx-js/mdx": "^2.3.0",
"@mdx-js/react": "^2.3.0"
```

`gatsby-config.mjs` change: rehype plugins must be nested under `mdxOptions` (was `options`).

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

| Construct                                      | Fix                                            |
| ---------------------------------------------- | ---------------------------------------------- |
| HTML comments `<!-- ... -->`                   | Remove entirely                                |
| Bare `<` in prose (e.g. `<192.168.1.1:80>`)    | Wrap in backticks                              |
| CTF flags `{flag_value}` outside code fences   | Wrap in backticks                              |
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

### `/api/write` or `/api/write-image` returns 500 in Netlify

Common causes:

1. `WRITE_SECRET` is missing or wrong.
2. `GITHUB_TOKEN` is missing.
3. `GATSBY_RUNTIME` is not set to `netlify`.

Check Netlify environment variables and redeploy.

---

### GitHub API 422 on delete: `"sha" weren't supplied`

The delete flow requires an existing file SHA from GitHub Contents API.

Typical causes:

1. Slug is invalid or does not map to an existing file in `content/articles`.
2. API request path is wrong (`articles/<slug>/` instead of raw slug).

Use the article slug only, for example `my-post-title`.

---

### `ERR_REQUIRE_ESM` for `remark-gfm` while loading Gatsby config

**Symptom:**
`require() of ES Module remark-gfm ... from gatsby-config.js not supported`

**Fix:** use ESM config (`gatsby-config.mjs`) with `import remarkGfm from 'remark-gfm'`.

---

### GraphQL error: `Cannot query field "allMdx"` or `childImageSharp`

This usually means schema sources/plugins are not aligned with current config.

Checklist:

1. Ensure `gatsby-source-filesystem` paths include `content/articles`, `content/ctfs`, and `content/pages`.
2. Ensure image plugins are installed and enabled: `gatsby-plugin-image`, `gatsby-plugin-sharp`, `gatsby-transformer-sharp`.
3. Run `gatsby clean` and rebuild after config/plugin changes.

---

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
