import React, { useRef, useState } from 'react';
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

const PANEL_CARD_CLASSES = 'rounded-2xl border border-outline bg-surface px-5 py-6 sm:px-8 sm:py-8';
const FORM_STACK_CLASSES = 'mx-auto w-full max-w-3xl space-y-6 sm:space-y-7';
const SECTION_CARD_CLASSES =
  'rounded-2xl border border-outline/80 bg-background/25 px-4 py-5 sm:px-6 sm:py-6 space-y-4';
const SECTION_TITLE_CLASSES = 'text-sm font-semibold text-secondary';
const MUTED_TEXT_CLASSES = 'text-sm leading-relaxed text-muted';
const PRIMARY_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-primary/60 bg-primary px-7 py-3 text-base font-bold text-background transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-outline px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:text-primary';
const DELETE_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-salmon/70 bg-salmon px-7 py-3 text-base font-bold text-background transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50';

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
  const contentRef = useRef(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [editStatus, setEditStatus] = useState({ type: 'idle', message: '' });
  const [editingSlug, setEditingSlug] = useState('');
  const [deleteStatus, setDeleteStatus] = useState({ type: 'idle', message: '' });
  const [deleteSlug, setDeleteSlug] = useState('');
  const [uploadDraft, setUploadDraft] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ type: 'idle', message: '' });
  const [uploadedAsset, setUploadedAsset] = useState(null);
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
    setStatus({ type: 'loading', message: editingSlug ? 'Updating...' : 'Publishing...' });
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
      status: form.status,
      sourceSlug: editingSlug || null
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

      if (!editingSlug) {
        setForm({ ...DEFAULT_FORM, token: form.token });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Network error: ${err.message}` });
    }
  };

  const handleResetEditor = () => {
    setEditingSlug('');
    setEditStatus({ type: 'idle', message: '' });
    setStatus({ type: 'idle', message: '' });
    setForm((prev) => ({ ...DEFAULT_FORM, token: prev.token }));
  };

  const handleImageSelection = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadStatus({
        type: 'error',
        message: 'Unsupported image type. Use JPG, PNG, WEBP, or GIF.'
      });
      return;
    }

    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadStatus({
        type: 'error',
        message: 'Image is too large. Max size is 4MB.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setUploadStatus({ type: 'error', message: 'Failed to read selected image.' });
        return;
      }

      setUploadDraft({
        filename: file.name,
        dataUrl
      });
      setUploadPreview(dataUrl);
      setUploadedAsset(null);
      setUploadStatus({ type: 'idle', message: '' });
    };
    reader.onerror = () => setUploadStatus({ type: 'error', message: 'Failed to read selected image.' });
    reader.readAsDataURL(file);
  };

  const insertMarkdownIntoContent = (snippet) => {
    if (!snippet) return;

    const textarea = contentRef.current;
    if (!textarea) {
      setForm((prev) => ({ ...prev, content: prev.content ? `${prev.content}\n\n${snippet}` : snippet }));
      return;
    }

    const start = textarea.selectionStart ?? form.content.length;
    const end = textarea.selectionEnd ?? form.content.length;
    const nextContent = `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`;

    setForm((prev) => ({ ...prev, content: nextContent }));
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + snippet.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleUploadImage = async () => {
    if (!uploadDraft?.dataUrl) {
      setUploadStatus({ type: 'error', message: 'Select an image first.' });
      return;
    }

    setUploadStatus({ type: 'loading', message: 'Uploading image...' });
    setTokenError('');

    try {
      const res = await fetch('/api/write-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${form.token}`
        },
        body: JSON.stringify({
          filename: uploadDraft.filename,
          dataUrl: uploadDraft.dataUrl,
          alt: uploadAlt || form.title || 'image'
        })
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
          setUploadStatus({ type: 'error', message: errorMessage || 'Unauthorized' });
          setTokenError(data.detail || '');
        } else {
          setUploadStatus({
            type: 'error',
            message: errorMessage || `Request failed with status ${res.status}`
          });
        }
        return;
      }

      setUploadedAsset({
        imageUrl: data.imageUrl,
        markdownSnippet: data.markdownSnippet,
        filename: data.filename
      });
      setUploadStatus({ type: 'success', message: data.message || 'Image uploaded successfully.' });
    } catch (err) {
      setUploadStatus({ type: 'error', message: `Network error: ${err.message}` });
    }
  };

  const handleLoadForEdit = async (rawSlug) => {
    const normalizedSlug = normalizeArticleSlugInput(rawSlug);
    if (!normalizedSlug) {
      setEditStatus({ type: 'error', message: 'Invalid slug selected for edit.' });
      return;
    }

    setEditStatus({ type: 'loading', message: `Loading "${normalizedSlug}"...` });
    setTokenError('');

    try {
      const res = await fetch(`/api/write?slug=${encodeURIComponent(normalizedSlug)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${form.token}`
        }
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
          setEditStatus({ type: 'error', message: errorMessage || 'Unauthorized' });
          setTokenError(data.detail || '');
        } else {
          setEditStatus({
            type: 'error',
            message: errorMessage || `Request failed with status ${res.status}`
          });
        }
        return;
      }

      const article = data.article || {};
      setEditingSlug(article.slug || normalizedSlug);
      setDeleteSlug(article.slug || normalizedSlug);
      setForm((prev) => ({
        token: prev.token,
        title: article.title || '',
        author: article.author || 'Eno',
        date: article.date || DEFAULT_FORM.date,
        tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
        featuredImage: article.featuredImage || '',
        content: article.content || '',
        status: article.status === 'draft' ? 'draft' : 'published'
      }));
      setStatus({ type: 'idle', message: '' });
      setEditStatus({
        type: 'success',
        message: `Loaded "${article.filename || `${normalizedSlug}.mdx`}" for editing.`
      });
    } catch (err) {
      setEditStatus({ type: 'error', message: `Network error: ${err.message}` });
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
    <div className="not-prose mx-auto w-full max-w-4xl space-y-8 sm:space-y-10">
      <header className="space-y-2">
        <h1 className="m-0 text-3xl font-bold text-text sm:text-4xl">Write Panel</h1>
      </header>

      {editingSlug && (
        <div className="rounded-xl border border-primary/50 bg-background/40 px-4 py-3.5 text-sm text-secondary">
          <span className="font-semibold text-text">Editing mode:</span> <code>{editingSlug}</code>
          <button
            type="button"
            onClick={handleResetEditor}
            className="ml-3 inline-flex text-primary underline underline-offset-2 hover:no-underline"
          >
            Reset form
          </button>
        </div>
      )}

      {editStatus.type !== 'idle' && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            editStatus.type === 'error'
              ? 'border-salmon/50 bg-salmon/10 text-salmon'
              : editStatus.type === 'success'
              ? 'border-teal/40 bg-teal/10 text-teal'
              : 'border-outline bg-background/30 text-secondary'
          }`}
        >
          {editStatus.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className={PANEL_CARD_CLASSES}>
        <div className={FORM_STACK_CLASSES}>
          <section className={SECTION_CARD_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>{isLocal ? 'Dev Token' : 'Write Secret Token'}</h2>
            <p className={MUTED_TEXT_CLASSES}>
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

            <div className="space-y-3 pt-1">
              <label className={LABEL_CLASSES} htmlFor="status-published">
                Status
              </label>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-outline bg-background/35 p-4 sm:px-5">
                {['published', 'draft'].map((s) => (
                  <label
                    key={s}
                    htmlFor={`status-${s}`}
                    className={`inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      form.status === s
                        ? 'border-primary/70 bg-primary/10 text-primary'
                        : 'border-outline bg-surface text-secondary hover:text-primary'
                    }`}
                  >
                    <input
                      id={`status-${s}`}
                      type="radio"
                      name="status"
                      value={s}
                      checked={form.status === s}
                      onChange={set('status')}
                      className="accent-primary"
                    />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
              {form.status === 'draft' && (
                <small className="block text-sm text-primary">
                  Draft mode: will be skipped by gatsby-node.js in build output.
                </small>
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASSES}>
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                        className="rounded-full border border-outline bg-background px-2.5 py-1 text-sm text-secondary"
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
                <div className="h-44 w-full max-w-md overflow-hidden rounded-xl border border-outline sm:h-52">
                  <img
                    src={form.featuredImage}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Upload Image</h2>
            <p className={MUTED_TEXT_CLASSES}>
              Upload image to repo path <code>/static/images/uploads/...</code>, then reuse URL for featured image or
              insert into MDX.
            </p>

            <input
              id="imageUpload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelection}
              className={`${FIELD_CLASSES} file:mr-3 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-sm file:text-primary`}
            />

            <input
              id="imageAlt"
              type="text"
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="Alt text for markdown (optional)"
              className={FIELD_CLASSES}
            />

            {uploadPreview ? (
              <div className="h-44 w-full max-w-md overflow-hidden rounded-xl border border-outline sm:h-52">
                <img src={uploadPreview} alt="Upload preview" className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={uploadStatus.type === 'loading'}
                className={PRIMARY_BUTTON_CLASSES}
              >
                {uploadStatus.type === 'loading' ? 'Uploading...' : 'Upload Image'}
              </button>

              {uploadStatus.type !== 'idle' && (
                <div
                  className={`min-w-0 text-sm ${
                    uploadStatus.type === 'error'
                      ? 'text-salmon'
                      : uploadStatus.type === 'success'
                      ? 'text-teal'
                      : 'text-secondary'
                  }`}
                >
                  {uploadStatus.message}
                </div>
              )}
            </div>

            {uploadedAsset?.imageUrl ? (
              <div className="space-y-3 rounded-xl border border-outline bg-surface/40 px-4 py-3.5">
                <code className="block break-all text-xs text-muted">{uploadedAsset.imageUrl}</code>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, featuredImage: uploadedAsset.imageUrl }))}
                    className={SECONDARY_BUTTON_CLASSES}
                  >
                    Use as Featured Image
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownIntoContent(`${uploadedAsset.markdownSnippet}\n`)}
                    className={SECONDARY_BUTTON_CLASSES}
                  >
                    Insert into Content
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={SECTION_CARD_CLASSES}>
            <div className="space-y-3">
              <label className={LABEL_CLASSES} htmlFor="content">
                Content (MDX) <span className="text-salmon">*</span>
              </label>
              <textarea
                ref={contentRef}
                id="content"
                value={form.content}
                onChange={set('content')}
                required
                rows={18}
                placeholder={`Write your article in MDX format.\n\n## Heading\n\nRegular text and **bold** and *italic*.\n\n\`\`\`js\nconsole.log("code block");\n\`\`\``}
                className={`${FIELD_CLASSES} min-h-[18rem] resize-y font-mono text-base leading-relaxed sm:min-h-[22rem]`}
              />
              <p className="text-center text-sm text-muted">
                {form.content.length} characters &middot; Supports headings, links, tables, code blocks, and embeds.
              </p>
            </div>
          </section>

          <section className={`${SECTION_CARD_CLASSES} pt-5`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <button type="submit" disabled={status.type === 'loading'} className={PRIMARY_BUTTON_CLASSES}>
                {status.type === 'loading'
                  ? editingSlug
                    ? 'Updating...'
                    : 'Publishing...'
                  : editingSlug
                  ? form.status === 'draft'
                    ? 'Update Draft'
                    : 'Update Article'
                  : form.status === 'draft'
                  ? 'Save Draft'
                  : 'Publish Article'}
              </button>

              {status.type === 'success' && (
                <div className="min-w-0 rounded-lg border border-teal/40 bg-teal/10 px-4 py-3 text-sm text-teal">
                  <div className="flex items-start gap-2">
                    <span>&#10003;</span>
                    <span className="break-words">{status.message}</span>
                  </div>
                  {status.url && (
                    <button
                      type="button"
                      onClick={() => navigate(status.url)}
                      className="mt-2 inline-flex text-secondary underline underline-offset-2 hover:no-underline"
                    >
                      View article
                    </button>
                  )}
                </div>
              )}

              {status.type === 'error' && (
                <div className="min-w-0 rounded-lg border border-salmon/50 bg-salmon/10 px-4 py-3 text-sm text-salmon">
                  <div className="flex items-start gap-2">
                    <span>&#10007;</span>
                    <span className="break-words">{status.message}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASSES}>
            <h2 className="m-0 text-xl font-bold text-text">Delete Article</h2>
            <p className={MUTED_TEXT_CLASSES}>
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
                className={DELETE_BUTTON_CLASSES}
              >
                {deleteStatus.type === 'loading' ? 'Deleting...' : 'Delete Article'}
              </button>

              {deleteStatus.type === 'success' && (
                <div className="min-w-0 rounded-lg border border-teal/40 bg-teal/10 px-4 py-3 text-sm text-teal">
                  <div className="flex items-start gap-2">
                    <span>&#10003;</span>
                    <span className="break-words">{deleteStatus.message}</span>
                  </div>
                </div>
              )}

              {deleteStatus.type === 'error' && (
                <div className="min-w-0 rounded-lg border border-salmon/50 bg-salmon/10 px-4 py-3 text-sm text-salmon">
                  <div className="flex items-start gap-2">
                    <span>&#10007;</span>
                    <span className="break-words">{deleteStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </form>

      <AsideElement>
        <div className="space-y-4 rounded-2xl border border-outline bg-surface/60 px-5 py-6">
          <h5 className="m-0 text-lg font-semibold uppercase leading-6 text-secondary">Recent Articles</h5>
          <p className="text-sm text-muted">Load an article for edit or autofill slug for deletion.</p>
          <ul className="m-0 list-none space-y-4 p-0">
            {recentArticles.map((node, index) => {
              const articlePath = node?.fields?.slug || '';
              const articleSlug = normalizeArticleSlugInput(articlePath);
              const articleTitle = node?.frontmatter?.title || articleSlug;
              const articleStatus = node?.frontmatter?.status === 'draft' ? 'Draft' : 'Published';

              return (
                <li
                  key={`${articlePath}-${index}`}
                  className="m-0 rounded-xl border border-outline/70 bg-background/25 p-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadForEdit(articleSlug)}
                    className="block w-full text-left text-sm font-semibold text-secondary transition-colors hover:text-primary"
                  >
                    {articleTitle}
                  </button>
                  <code className="mt-1 block break-all text-xs text-muted">{articleSlug}</code>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <small className="text-[10px] uppercase tracking-wide text-muted">{articleStatus}</small>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDeleteSlug(articleSlug)}
                        className="text-xs text-secondary transition-colors hover:text-primary"
                      >
                        Use for delete
                      </button>
                      <Link to={articlePath} className="text-xs text-secondary transition-colors hover:text-primary">
                        Open
                      </Link>
                    </div>
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
    allMdx(filter: { frontmatter: { type: { eq: "article" } } }, sort: { frontmatter: { date: DESC } }, limit: 5) {
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
