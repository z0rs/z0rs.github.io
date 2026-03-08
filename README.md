# z0rs.github.io

Personal security research blog and portfolio — built with Gatsby 5, MDX v2, TailwindCSS, and serverless API functions.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Build Instructions](#build-instructions)
- [Creating Content](#creating-content)
  - [Writing an Article](#writing-an-article)
  - [Writing a CTF Write-up](#writing-a-ctf-write-up)
  - [MDX Features](#mdx-features)
  - [Content Rules (MDX v2)](#content-rules-mdx-v2)
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

MDX files live in `content/` and are sourced via `gatsby-source-filesystem`. Each file's frontmatter `type` field (`article`, `ctf`, `page`) determines which template renders it.

**gatsby-plugin-mdx v5** compiles MDX to React components. Templates receive the compiled MDX as `children` via the `?__contentFilePath=` mechanism — there is no `MDXRenderer` or `body` field (both were removed in v5).

Custom components (`LatestArticles`, `AllCtfs`, code blocks, etc.) are injected globally via `MDXProvider` in `src/components/mdx-parser.js`. MDX content files must **not** contain direct `import` statements.

### Serverless API

| Endpoint | Purpose |
|---|---|
| `/api/fauna-add-reaction` | Write a reaction to FaunaDB |
| `/api/fauna-latest-reaction` | Fetch the most recent reaction |
| `/api/fauna-reaction-by-slug` | Fetch reactions for a page |
| `/api/newsletter` | Newsletter signup (ConvertKit) |
| `/api/ua-analytics` | Proxy to Google Analytics Data API |

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
|   |   +-- 2024/
|   |       +-- 04/
|   |           +-- MyChallenge.mdx
|   +-- pages/          # Top-level page MDX files (index, about, etc.)
+-- src/
|   +-- api/            # Gatsby serverless functions
|   +-- components/     # React components
|   +-- hooks/          # Custom React hooks
|   +-- pages/          # Static Gatsby pages (404, analytics, test)
|   +-- templates/      # Page templates (article, ctf, page)
|   +-- utils/          # Utility functions
+-- static/             # Static assets (fonts, images, favicon)
+-- gatsby-config.js    # Gatsby configuration + plugins
+-- gatsby-node.js      # createPages, slug sanitisation, remote images
+-- tailwind.config.js  # TailwindCSS configuration
```

---

## Build Instructions

### Prerequisites

- Node.js >= 18 (see `.nvmrc`)
- Yarn

```bash
yarn install      # Install dependencies
yarn develop      # Dev server at http://localhost:8000
yarn build        # Production build -> public/
yarn serve        # Serve production build locally
yarn clean        # Clear Gatsby cache
```

GraphiQL (interactive query explorer) is available at `http://localhost:8000/___graphql` during development.

---

## Creating Content

### Writing an Article

1. Create a new `.mdx` file in `content/articles/`:

```
content/articles/My-New-Article.mdx
```

2. Add the required frontmatter at the top:

```yaml
---
type: article
title: My New Article Title
tags: [Web Security, OWASP, XSS]
date: 2024-06-15
author: Eno
featuredImage: https://example.com/path/to/cover-image.jpg
---
```

3. Write your content in MDX below the frontmatter block.

The article will be published at:
```
/articles/My-New-Article/
```

#### Article frontmatter fields

| Field | Required | Description |
|---|---|---|
| `type` | Yes | Must be `article` |
| `title` | Yes | Display title — shown in the page heading and SEO tags |
| `tags` | Yes | Array of topic tags, e.g. `[Web Security, SQLi]` |
| `date` | Yes | Publication date in `YYYY-MM-DD` format |
| `author` | Yes | Author name |
| `featuredImage` | No | URL to a cover image (HTTPS). Fetched at build time. If the URL is unreachable the article renders without an image |
| `dateModified` | No | Last-modified date in `YYYY-MM-DD` format — shown instead of `date` when set |
| `embeddedImages` | No | Array of image URLs to pre-process with `gatsby-plugin-image` for use inline in the MDX body |
| `status` | No | Set to `draft` to exclude from build output |

---

### Writing a CTF Write-up

1. Create a `.mdx` file inside a `year/month` subdirectory under `content/ctfs/`:

```
content/ctfs/2024/04/CTFName-ChallengeName.mdx
```

2. Add the required frontmatter:

```yaml
---
type: ctf
title: CTFName 2024 - Challenge Name (category)
tags: [pwn, buffer overflow, CTFName]
date: 2024-04-20
author: Eno
featuredImage: https://example.com/ctf-logo.png
---
```

3. Write your write-up in MDX below the frontmatter.

The write-up will be published at:
```
/ctfs/CTFName-ChallengeName/
```

#### CTF frontmatter fields

| Field | Required | Description |
|---|---|---|
| `type` | Yes | Must be `ctf` |
| `title` | Yes | Display title — convention: `CTFName Year - Challenge (category)` |
| `tags` | Yes | Array of tags, e.g. `[pwn, rop, CTFName 2024]` |
| `date` | Yes | Date of the CTF or write-up in `YYYY-MM-DD` |
| `author` | Yes | Author name |
| `featuredImage` | No | Cover image URL (HTTPS) |
| `status` | No | Set to `draft` to exclude from build |

---

### MDX Features

Your content files are MDX — a superset of Markdown that supports JSX. The following features are available.

#### Standard Markdown

All standard Markdown syntax works: headings, bold, italic, blockquotes, ordered and unordered lists, horizontal rules, and fenced code blocks with syntax highlighting.

````md
## Section Heading

This is a paragraph with **bold** and _italic_ text.

> This is a blockquote.

```python
def exploit():
    payload = b"A" * 264 + p64(0xdeadbeef)
    return payload
```
````

#### Tables

Markdown tables are fully supported and styled automatically:

```md
| Finding | Severity |
|---|---|
| SQL Injection | High |
| XSS | Medium |
```

#### Inline components

The following components are available in all MDX files without any import:

| Component | Usage | Description |
|---|---|---|
| `<LatestArticles />` | `<LatestArticles />` | Renders a grid of the most recent articles |
| `<LatestCtfs />` | `<LatestCtfs />` | Renders a grid of the most recent CTF write-ups |
| `<AllArticles />` | `<AllArticles />` | Renders the full article archive |
| `<AllCtfs />` | `<AllCtfs />` | Renders the full CTF archive |

These are provided globally via `MDXProvider` — do not `import` them.

#### Links

Standard Markdown links work for external URLs. Internal links use the same syntax:

```md
[Read more about XSS](/articles/Cross-Site-Scripting/)
[Download the binary](/Files/challenge.zip)
```

---

### Content Rules (MDX v2)

MDX v2 parses your content as JSX. A few constructs that work in plain Markdown will break the build:

**Do not use HTML comments**
```md
<!-- This will break the build -->
```
Remove them entirely or convert to a regular paragraph note.

**Wrap bare angle brackets in backticks**

If you write an IP address, port, or any `<word>` that looks like an HTML tag, wrap it in backticks:
```md
<!-- WRONG -->
Connect to <192.168.1.1:4444>

<!-- CORRECT -->
Connect to `<192.168.1.1:4444>`
```

**Wrap CTF flags in backticks**

Curly braces `{}` outside of code fences are interpreted as JSX expressions:
```md
<!-- WRONG -->
The flag is CTF{s0m3_s3cr3t_flag}

<!-- CORRECT -->
The flag is `CTF{s0m3_s3cr3t_flag}`
```

**No special characters in filenames**

The following characters in an `.mdx` filename will cause URL/build issues and must be avoided:

| Character | Replace with |
|---|---|
| `&` | `-and-` or `-` |
| `%` | `-` |
| `#` | `-` |
| `?` | `-` |

Good: `SQL-Injection-and-XSS.mdx`
Bad: `SQL-Injection-&-XSS.mdx`

**No import statements in MDX files**

Do not add `import` statements inside your `.mdx` content files. They are silently dropped at build time. Use the globally-available components listed above instead.

---

## Deployment

The site deploys automatically to **GitHub Pages** on every push to `master`.

### CI/CD Pipeline (`.github/workflows/gatsby.yml`)

1. Checkout source
2. Setup Node 18
3. Restore Gatsby build cache (keyed on `yarn.lock`)
4. `yarn install`
5. `gatsby build` with `PREFIX_PATHS=true` and `--max-old-space-size=4096`
6. Upload `public/` as a Pages artifact
7. Deploy to GitHub Pages

### Path prefix

The site is served from `/z0rs.github.io`. The `pathPrefix` in `gatsby-config.js` is only applied when `PREFIX_PATHS=true` is set, so local dev and Netlify deploy-previews work without it.

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

Documents every breaking change resolved during the Gatsby 4 -> Gatsby 5 / gatsby-plugin-mdx v3 -> v5 migration.

### 1. Dependency upgrades

```json
"gatsby-plugin-mdx": "^5.0.0",
"@mdx-js/mdx": "^2.3.0",
"@mdx-js/react": "^2.3.0"
```

`gatsby-config.js`: rehype plugins must be nested under `mdxOptions` (was `options`).

### 2. MDXRenderer removed — use children

`gatsby-plugin-mdx` v5 removed `MDXRenderer` and the `body` GraphQL field. Templates now receive compiled MDX as React `children` via `?__contentFilePath=`.

`gatsby-node.js` `createPage` call:
```js
const template = path.join(__dirname, `./src/templates/${type}.js`);
component: `${template}?__contentFilePath=${contentFilePath}`,
```

Templates:
```js
// Before (v3): const Page = ({ data: { mdx: { body } } }) => <MdxParser>{body}</MdxParser>
// After  (v5): const Page = ({ data, children }) => <MdxParser>{children}</MdxParser>
```

### 3. No direct imports inside MDX content files

MDX v2 imports inside `.mdx` files are silently dropped by webpack when using `?__contentFilePath=`. Register all components in `MDXProvider` in `src/components/mdx-parser.js` instead.

### 4. MDX v2 is a strict JSX parser

See [Content Rules](#content-rules-mdx-v2) above for the full list of forbidden constructs.

Slug sanitisation applied in `gatsby-node.js`:
```js
const rawPath = createFilePath({ node, getNode });
const sanitised = rawPath
  .replace(/&/g, '-and-')
  .replace(/[%#?]/g, '-')
  .replace(/-{2,}/g, '-');
```

### 5. useStaticQuery must not appear in Gatsby Head API exports

Calling `useStaticQuery` inside a `Head` export from an MDX-backed template crashes on large articles. Gatsby's worker-based static query registration fails for large `?__contentFilePath=` webpack chunks, leaving the hash unregistered. At SSR time, `useStaticQuery` throws `The result of this StaticQuery could not be fetched`.

**Fix:** `seo.js` no longer calls `useStaticQuery`. All callers pass `siteMetadata` from the page-level GraphQL query:

```js
// In each template's GraphQL query:
site { siteMetadata { name siteUrl defaultImage keywords } }

// In the Head export:
export const Head = ({ data: { site: { siteMetadata }, mdx: { ... } } }) => (
  <Seo ... siteMetadata={siteMetadata} />
);
```

### 6. TLS errors from remote featuredImages

Some articles reference images at hosts with incomplete TLS chains. Each `createRemoteFileNode` call is wrapped in try/catch so the build continues gracefully. All image-consuming components guard against `null` thumbnails with optional chaining.

### 7. null featuredImage crashes

```js
const thumbnail = featuredImage?.childImageSharp?.thumbnail ?? null;
{thumbnail && <GatsbyImage image={thumbnail} alt={...} />}
```

---

## Troubleshooting

### Build fails: `The result of this StaticQuery could not be fetched`

`useStaticQuery` was called inside a `Head` export on a large MDX page. See [Migration Notes §5](#5-usestaticquery-must-not-appear-in-gatsby-head-api-exports).

---

### Build fails: `ReferenceError: identifier is not defined`

A CTF flag or `{expression}` appears in MDX prose outside a code fence. See [Content Rules](#content-rules-mdx-v2) — wrap it in backticks.

---

### Page renders but content area is blank

1. Missing `?__contentFilePath=` in `createPage()` — see [Migration Notes §2](#2-mdxrenderer-removed--use-children)
2. Direct `import` in `.mdx` file — see [Migration Notes §3](#3-no-direct-imports-inside-mdx-content-files)
3. Null `featuredImage` crashing React tree — see [Migration Notes §7](#7-null-featuredimage-crashes)

---

### Build fails: MDX parse error on `<something>`

A bare `<tag>` appears in prose. MDX v2 treats it as JSX. Wrap in backticks. See [Content Rules](#content-rules-mdx-v2).

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
