import React, { useState, Fragment } from 'react';
import { Link, navigate, graphql } from 'gatsby';
import Seo from './components/seo';

// Runtime detection via GATSBY_RUNTIME env var set at build time:
//   "local"    — yarn develop (form enabled, filesystem write)
//   "netlify"  — Netlify deploy with Gatsby Functions (form enabled, GitHub API write)
//   "github"   — GitHub Pages (form disabled, returns 404 to prevent broken static HTML)
//
// On GitHub Pages there is no server runtime, so the form cannot work.
// On Netlify the Gatsby Function handles GitHub API calls to persist content to the repo.
// Set GATSBY_RUNTIME in Netlify environment variables to "netlify".
const RUNTIME = process.env.GATSBY_RUNTIME || 'local';

const DEFAULT_FORM = {
  token: '',
  title: '',
  author: 'Eno',
  date: new Date().toISOString().split('T')[0],
  tags: '',
  featuredImage: '',
  content: '',
  status: 'published'
};

const FIELD_CLASSES =
  'w-full bg-surface border border-outline rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors';

const LABEL_CLASSES = 'block text-sm font-semibold text-secondary mb-1';

const ERROR_CLASSES = 'text-salmon text-sm mt-1';

export default function WritePage() {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [tokenError, setTokenError] = useState('');

  const isDisabled = RUNTIME === 'github';
  const isLocal = RUNTIME === 'local';
  const isNetlify = RUNTIME === 'netlify';

  if (isDisabled) {
    return (
      <div className="prose">
        <h1>Write Panel</h1>
        <div className="bg-surface border border-outline rounded p-6 text-center">
          <p className="text-muted mb-4">The Write Panel requires a server-side runtime to handle file writes.</p>
          <p className="text-sm text-muted mb-2">
            On GitHub Pages, this page is served as static HTML and cannot write files.
          </p>
          <p className="text-sm text-secondary mb-4">
            For write-panel access, deploy to <strong>Netlify</strong> (which runs Gatsby Functions) or use{' '}
            <strong>local development</strong>: <code className="bg-surface px-2 py-1 rounded">yarn develop</code>
          </p>
          <Link to="/" className="inline-block mt-4 text-secondary hover:text-primary transition-colors">
            &larr; Back to home
          </Link>
        </div>
      </div>
    );
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleTokenChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, token: val }));
  };

  const handleTokenBlur = () => {
    // No pre-flight validation — the API will return 401 if the token is invalid.
    // In local dev, any non-empty bearer is accepted. In production, WRITE_SECRET is required.
    setTokenError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Publishing...' });
    setTokenError('');

    const tags = form.tags
      ? form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const payload = {
      title: form.title,
      content: form.content,
      tags,
      author: form.author || 'Eno',
      date: form.date,
      featuredImage: form.featuredImage || null,
      status: form.status
    };

    try {
      const res = await fetch('/api/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${form.token}`
        },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { error: rawText };
        }
      }

      if (!res.ok) {
        const errorMessage = data.detail ? `${data.error || 'Request failed'}: ${data.detail}` : data.error;
        if (res.status === 401) {
          setStatus({ type: 'error', message: errorMessage || 'Unauthorized' });
          setTokenError(data.detail || '');
        } else {
          setStatus({
            type: 'error',
            message: errorMessage || `Request failed with status ${res.status}`
          });
        }
        return;
      }

      setStatus({
        type: 'success',
        message: data.message,
        url: data.articleUrl,
        isDraft: data.isDraft
      });
      setForm({ ...DEFAULT_FORM, token: form.token });
    } catch (err) {
      setStatus({ type: 'error', message: `Network error: ${err.message}` });
    }
  };

  const previewSlug = form.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');

  return (
    <div className="prose">
      <div className="flex items-center gap-3 mb-8 not-prose">
        <small className="leading-6 font-semibold text-yellow bg-surface border border-yellow/30 rounded px-2 py-0.5">
          {isLocal ? 'LOCAL DEV' : 'NETLIFY'}
        </small>
        <p className="text-muted text-sm m-0">
          {isLocal
            ? 'Writing to local filesystem. Changes are lost unless committed to git manually.'
            : 'Publishing via GitHub API. Content is committed to the repo and triggers a site rebuild.'}
        </p>
      </div>

      <h1 className="not-prose">Write Panel</h1>

      {isLocal ? (
        <div className="mb-8 not-prose">
          <p className="text-xs text-muted mb-1">
            In local dev, any non-empty bearer token is accepted. Use a placeholder like{' '}
            <code className="bg-surface px-1 rounded">my-dev-token</code>.
          </p>
          <input
            type="text"
            value={form.token}
            onChange={handleTokenChange}
            placeholder="Bearer token (any non-empty string works locally)"
            className={`${FIELD_CLASSES} font-mono text-xs w-auto inline-block`}
          />
        </div>
      ) : (
        <div className="mb-8 not-prose bg-surface border border-yellow/30 rounded p-4">
          <p className="text-xs text-yellow font-semibold mb-2">Production deployment — Netlify required</p>
          <p className="text-xs text-muted mb-1">
            Set <code>WRITE_SECRET</code> as an environment variable in your Netlify dashboard and enter it below. The
            token is sent as <code>Authorization: Bearer &lt;token&gt;</code>.
          </p>
          <input
            type="text"
            value={form.token}
            onChange={handleTokenChange}
            onBlur={handleTokenBlur}
            placeholder="WRITE_SECRET token..."
            className={`${FIELD_CLASSES} font-mono text-xs ${tokenError ? 'border-salmon' : ''}`}
          />
          {tokenError && <p className={ERROR_CLASSES}>{tokenError}</p>}
        </div>
      )}

      {/* Write Form */}
      <form onSubmit={handleSubmit} className="not-prose space-y-6">
        {/* Status Toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-secondary">Status:</span>
          {['published', 'draft'].map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s}
                checked={form.status === s}
                onChange={set('status')}
                className="accent-primary"
              />
              <span className={`text-sm ${form.status === s ? 'text-text' : 'text-muted'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </label>
          ))}
          {form.status === 'draft' && (
            <small className="text-xs text-yellow ml-2">
              Draft — will be skipped by gatsby-node.js and not appear in build output
            </small>
          )}
        </div>

        {/* Title */}
        <div>
          <label className={LABEL_CLASSES} htmlFor="title">
            Title <span className="text-salmon">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={set('title')}
            required
            placeholder="e.g. Understanding JWT Security"
            className={FIELD_CLASSES}
          />
          {previewSlug && (
            <small className="text-xs text-muted mt-1 block">
              Preview slug: <code className="bg-surface px-1 rounded">/articles/{previewSlug}/</code>
            </small>
          )}
        </div>

        {/* Author + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASSES} htmlFor="author">
              Author
            </label>
            <input
              id="author"
              type="text"
              value={form.author}
              onChange={set('author')}
              placeholder="Eno"
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label className={LABEL_CLASSES} htmlFor="date">
              Date
            </label>
            <input id="date" type="date" value={form.date} onChange={set('date')} className={FIELD_CLASSES} />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={LABEL_CLASSES} htmlFor="tags">
            Tags <span className="font-normal text-muted text-xs">(comma-separated)</span>
          </label>
          <input
            id="tags"
            type="text"
            value={form.tags}
            onChange={set('tags')}
            placeholder="Security, Web, CTF"
            className={FIELD_CLASSES}
          />
          {form.tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-surface border border-outline rounded-full px-2 py-0.5 text-secondary"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Featured Image */}
        <div>
          <label className={LABEL_CLASSES} htmlFor="featuredImage">
            Featured Image URL <span className="font-normal text-muted text-xs">(optional)</span>
          </label>
          <input
            id="featuredImage"
            type="url"
            value={form.featuredImage}
            onChange={set('featuredImage')}
            placeholder="https://..."
            className={FIELD_CLASSES}
          />
          {form.featuredImage && (
            <div className="mt-2 rounded overflow-hidden border border-outline w-32 h-20">
              <img
                src={form.featuredImage}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div>
          <label className={LABEL_CLASSES} htmlFor="content">
            Content (MDX) <span className="text-salmon">*</span>
          </label>
          <textarea
            id="content"
            value={form.content}
            onChange={set('content')}
            required
            rows={20}
            placeholder={`Write your article in MDX format.\n\n## Heading\n\nRegular text and **bold** and *italic*.\n\n\`\`\`js\nconsole.log("code block");\n\`\`\``}
            className={`${FIELD_CLASSES} font-mono text-sm leading-relaxed resize-y min-h-[20rem]`}
          />
          <p className="text-xs text-muted mt-1">
            {form.content.length} characters &middot; Supports MDX (headings, bold, italic, code blocks, links, etc.)
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={status.type === 'loading'}
            className="bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold px-6 py-2 rounded transition-colors"
          >
            {status.type === 'loading' ? 'Publishing...' : form.status === 'draft' ? 'Save Draft' : 'Publish Article'}
          </button>

          {status.type === 'success' && (
            <span className="text-teal text-sm flex items-center gap-2">
              <span>&#10003;</span>
              <span>{status.message}</span>
              {status.url && (
                <button
                  type="button"
                  onClick={() => navigate(status.url)}
                  className="underline hover:no-underline text-secondary"
                >
                  View article
                </button>
              )}
            </span>
          )}

          {status.type === 'error' && (
            <span className="text-salmon text-sm flex items-center gap-2">
              <span>&#10007;</span>
              {status.message}
            </span>
          )}
        </div>
      </form>

      {/* MDX Reference */}
      <section className="not-prose mt-12 bg-surface border border-outline rounded-lg p-6">
        <h2 className="text-lg font-bold text-secondary mt-0 mb-4">MDX Quick Reference</h2>
        <pre className="bg-background border border-outline rounded p-4 text-xs text-muted overflow-x-auto">{`## Heading 2

### Heading 3

**bold text** and *italic text*

[link text](https://example.com)

\`inline code\`

\`\`\`python
# code block with syntax highlighting
def hello():
    print("Hello, world!")
\`\`\`

> Blockquote text

- Bullet list item
1. Numbered list item

| Column 1 | Column 2 |
|----------|----------|
| Cell     | Cell     |

![alt text](https://example.com/image.jpg)`}</pre>
      </section>
    </div>
  );
}

// Prevent this page from being statically generated as HTML.
// GitHub Pages serves pre-built HTML with no server runtime — the form would
// render but fail silently without Gatsby Functions present. Returning 404
// (on hosts that support it) keeps crawlers and non-JS users away.
export const loader = () => {
  return new Response(null, { status: 404 });
};

export const Head = ({
  data: {
    site: { siteMetadata }
  }
}) => (
  <Seo
    title="Write Panel"
    description="Write and publish articles from the browser — local development only"
    slug="/write/"
    noindex
    siteMetadata={siteMetadata}
  />
);

export const query = graphql`
  query {
    site {
      siteMetadata {
        name
        siteUrl
        defaultImage
        keywords
      }
    }
  }
`;
