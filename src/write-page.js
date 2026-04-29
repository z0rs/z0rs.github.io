import React, { useState } from 'react';
import { Link, navigate, graphql } from 'gatsby';
import Seo from './components/seo';
import AsideElement from './components/aside-element';

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
  'w-full bg-surface border border-outline rounded-xl px-4 py-3 text-base text-text placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors';

const LABEL_CLASSES = 'block text-base font-semibold text-secondary mb-3';

const ERROR_CLASSES = 'text-salmon text-sm mt-1';

const PANEL_CARD_CLASSES = 'rounded-xl border border-outline bg-surface px-6 py-7 sm:px-8 sm:py-8';

function normalizeArticleSlugInput(value) {
  if (!value || typeof value !== 'string') return '';

  let slug = value.trim();
  if (!slug) return '';

  if (/^https?:\/\//i.test(slug)) {
    try {
      slug = new URL(slug).pathname;
    } catch {
      return '';
    }
  }

  slug = slug.split('?')[0].split('#')[0];
  slug = slug.replace(/^\/+|\/+$/g, '');
  slug = slug.replace(/^articles\//i, '');
  slug = slug.replace(/\.mdx$/i, '');

  return slug;
}

export default function WritePage({ data }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [deleteStatus, setDeleteStatus] = useState({ type: 'idle', message: '' });
  const [deleteSlug, setDeleteSlug] = useState('');
  const [tokenError, setTokenError] = useState('');
  const recentArticles = data?.allMdx?.nodes || [];

  const isDisabled = RUNTIME === 'github';
  const isLocal = RUNTIME === 'local';

  if (isDisabled) {
    return (
      <div className="not-prose mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-bold text-text">Write Panel</h1>
        <div className="bg-surface border border-outline rounded-xl p-6 text-center">
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

  const handleDeleteSubmit = async () => {
    const normalizedSlug = normalizeArticleSlugInput(deleteSlug);
    if (!normalizedSlug) {
      setDeleteStatus({
        type: 'error',
        message: 'Provide a valid article slug (e.g. post-title-slug).'
      });
      return;
    }

    if (!window.confirm(`Delete article "${normalizedSlug}"? This action cannot be undone.`)) {
      return;
    }

    setDeleteStatus({ type: 'loading', message: 'Deleting...' });
    setTokenError('');

    try {
      const res = await fetch('/api/write', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${form.token}`
        },
        body: JSON.stringify({ slug: normalizedSlug })
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
          setDeleteStatus({ type: 'error', message: errorMessage || 'Unauthorized' });
          setTokenError(data.detail || '');
        } else {
          setDeleteStatus({
            type: 'error',
            message: errorMessage || `Request failed with status ${res.status}`
          });
        }
        return;
      }

      setDeleteStatus({ type: 'success', message: data.message });
      setDeleteSlug('');
    } catch (err) {
      setDeleteStatus({ type: 'error', message: `Network error: ${err.message}` });
    }
  };

  const previewSlug = form.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');

  return (
    <div className="not-prose mx-auto w-full max-w-4xl space-y-12 sm:space-y-14">
      <h1 className="m-0 text-3xl font-bold text-text sm:text-4xl">Write Panel</h1>

      <form onSubmit={handleSubmit} className={PANEL_CARD_CLASSES}>
        <div className="mx-auto w-full max-w-3xl space-y-8 sm:space-y-9">
          <div className="space-y-4">
            <label className={LABEL_CLASSES} htmlFor="token">
              {isLocal ? 'Dev Token' : 'Write Secret Token'}
            </label>
            <p className="text-sm text-muted leading-relaxed">
              {isLocal ? (
                <>
                  In local dev, any non-empty bearer token is accepted. Example:{' '}
                  <code className="bg-background px-1.5 py-0.5 rounded">my-dev-token</code>
                </>
              ) : (
                <>
                  Production deployment uses <code>WRITE_SECRET</code>. Set it in Netlify env, then paste the token
                  here.
                </>
              )}
            </p>
            <input
              id="token"
              type="text"
              value={form.token}
              onChange={handleTokenChange}
              onBlur={handleTokenBlur}
              placeholder={isLocal ? 'Bearer token (any non-empty string works locally)' : 'WRITE_SECRET token...'}
              className={`${FIELD_CLASSES} font-mono text-sm ${tokenError ? 'border-salmon' : ''}`}
            />
            {tokenError && <p className={ERROR_CLASSES}>{tokenError}</p>}
          </div>

          <div className="space-y-4 sm:space-y-3">
            <div className="sm:grid sm:grid-cols-[120px_1fr] sm:items-center sm:gap-x-5">
              <span className="block text-base font-semibold text-secondary mb-3 sm:mb-0">Status</span>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-10 gap-y-4 rounded-xl border border-outline bg-background/30 px-4 py-4 sm:px-5">
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
                    <span className={`text-base ${form.status === s ? 'text-text' : 'text-muted'}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {form.status === 'draft' && (
              <small className="block text-sm text-primary sm:pl-[140px]">
                Draft mode: will be skipped by gatsby-node.js in build output.
              </small>
            )}
          </div>

          <div className="space-y-3">
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
              <small className="text-sm text-muted block">
                Preview slug: <code className="bg-background px-1 rounded">/articles/{previewSlug}/</code>
              </small>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
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
            <div className="space-y-3">
              <label className={LABEL_CLASSES} htmlFor="date">
                Date
              </label>
              <input id="date" type="date" value={form.date} onChange={set('date')} className={FIELD_CLASSES} />
            </div>
          </div>

          <div className="space-y-3">
            <label className={LABEL_CLASSES} htmlFor="tags">
              Tags <span className="font-normal text-muted text-sm">(comma-separated)</span>
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
              <div className="flex flex-wrap gap-2">
                {form.tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="text-sm bg-background border border-outline rounded-full px-2.5 py-1 text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className={LABEL_CLASSES} htmlFor="featuredImage">
              Featured Image URL <span className="font-normal text-muted text-sm">(optional)</span>
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
              <div className="rounded-xl overflow-hidden border border-outline w-full max-w-sm h-44 sm:h-52">
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

          <div className="space-y-3">
            <label className={LABEL_CLASSES} htmlFor="content">
              Content (MDX) <span className="text-salmon">*</span>
            </label>
            <textarea
              id="content"
              value={form.content}
              onChange={set('content')}
              required
              rows={18}
              placeholder={`Write your article in MDX format.\n\n## Heading\n\nRegular text and **bold** and *italic*.\n\n\`\`\`js\nconsole.log("code block");\n\`\`\``}
              className={`${FIELD_CLASSES} font-mono text-base leading-relaxed resize-y min-h-[18rem] sm:min-h-[22rem]`}
            />
            <p className="text-sm text-muted text-center">
              {form.content.length} characters &middot; Supports headings, links, tables, code blocks, and embeds.
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-start">
            <button
              type="submit"
              disabled={status.type === 'loading'}
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-primary/60 bg-primary px-7 py-3 text-base font-bold text-background transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.type === 'loading' ? 'Publishing...' : form.status === 'draft' ? 'Save Draft' : 'Publish Article'}
            </button>

            {status.type === 'success' && (
              <div className="min-w-0 text-sm text-teal">
                <div className="flex items-start gap-2">
                  <span>&#10003;</span>
                  <span className="break-words">{status.message}</span>
                </div>
                {status.url && (
                  <button
                    type="button"
                    onClick={() => navigate(status.url)}
                    className="mt-2 inline-flex text-secondary underline hover:no-underline"
                  >
                    View article
                  </button>
                )}
              </div>
            )}

            {status.type === 'error' && (
              <div className="min-w-0 text-sm text-salmon flex items-start gap-2">
                <span>&#10007;</span>
                <span className="break-words">{status.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-outline/80 pt-8 sm:pt-9">
            <h2 className="m-0 text-xl font-bold text-text">Delete Article</h2>
            <p className="text-sm text-muted leading-relaxed">
              Paste article slug or URL (for example <code>/articles/post-title-slug/</code>) to remove an article
              without opening GitHub.
            </p>
            <div className="space-y-3">
              <label className={LABEL_CLASSES} htmlFor="deleteSlug">
                Article Slug
              </label>
              <input
                id="deleteSlug"
                type="text"
                value={deleteSlug}
                onChange={(e) => {
                  setDeleteSlug(e.target.value);
                  if (deleteStatus.type !== 'idle') setDeleteStatus({ type: 'idle', message: '' });
                }}
                placeholder="post-title-slug"
                className={FIELD_CLASSES}
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteStatus.type === 'loading'}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-salmon/70 bg-salmon px-7 py-3 text-base font-bold text-background transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteStatus.type === 'loading' ? 'Deleting...' : 'Delete Article'}
              </button>

              {deleteStatus.type === 'success' && (
                <div className="min-w-0 text-sm text-teal flex items-start gap-2">
                  <span>&#10003;</span>
                  <span className="break-words">{deleteStatus.message}</span>
                </div>
              )}

              {deleteStatus.type === 'error' && (
                <div className="min-w-0 text-sm text-salmon flex items-start gap-2">
                  <span>&#10007;</span>
                  <span className="break-words">{deleteStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      <AsideElement>
        <div className="px-6">
          <h5 className="mb-3 text-lg leading-6 font-semibold uppercase text-secondary">Recent Articles</h5>
          <p className="mb-4 text-sm text-muted">Click an article to autofill slug for deletion.</p>
          <ul className="m-0 p-0 list-none space-y-4">
            {recentArticles.map((node, index) => {
              const articlePath = node?.fields?.slug || '';
              const articleSlug = normalizeArticleSlugInput(articlePath);
              const articleTitle = node?.frontmatter?.title || articleSlug;
              const articleStatus = node?.frontmatter?.status === 'draft' ? 'Draft' : 'Published';

              return (
                <li key={`${articlePath}-${index}`} className="m-0 p-0">
                  <button
                    type="button"
                    onClick={() => setDeleteSlug(articleSlug)}
                    className="block w-full text-left text-sm font-semibold text-secondary hover:text-primary transition-colors"
                  >
                    {articleTitle}
                  </button>
                  <code className="block mt-1 text-xs text-muted break-all">{articleSlug}</code>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <small className="uppercase tracking-wide text-[10px] text-muted">{articleStatus}</small>
                    <Link to={articlePath} className="text-xs text-secondary hover:text-primary transition-colors">
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </AsideElement>
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
    allMdx(
      filter: { frontmatter: { type: { eq: "article" } } }
      sort: { frontmatter: { date: DESC } }
      limit: 5
    ) {
      nodes {
        fields {
          slug
        }
        frontmatter {
          title
          status
        }
      }
    }
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
