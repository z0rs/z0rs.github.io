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

const LABEL_CLASSES = 'block text-sm font-semibold text-secondary mb-2';

const ERROR_CLASSES = 'text-salmon text-sm mt-1';

const PANEL_CARD_CLASSES = 'px-0 sm:px-0';
const FORM_STACK_CLASSES = 'mx-auto w-full max-w-3xl space-y-8 sm:space-y-10';
const SECTION_CARD_CLASSES = 'space-y-5 sm:space-y-6';
const SECTION_TITLE_CLASSES = 'text-sm font-semibold text-secondary';
const MUTED_TEXT_CLASSES = 'text-sm leading-relaxed text-muted';
const PRIMARY_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-primary/60 bg-primary px-7 py-3 text-base font-bold text-background transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-outline px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:text-primary';
const DELETE_BUTTON_CLASSES =
  'inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-salmon/70 bg-salmon px-7 py-3 text-base font-bold text-background transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50';
const TAB_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-lg border border-outline px-4 py-2 text-sm font-semibold transition-colors';
const TOOLBAR_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-md border border-outline px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:text-primary';

const WRITE_TABS = [
  { id: 'new', label: 'New Article' },
  { id: 'edit', label: 'Edit Article' },
  { id: 'delete', label: 'Delete' }
];

const EDITOR_VIEWS = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' }
];

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

function renderInlinePreview(text, keyPrefix) {
  if (!text) return null;

  const nodes = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(([^)\s]+)\))/g;
  let lastIndex = 0;
  let match;
  let tokenIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const [token] = match;
    const start = match.index;
    const end = start + token.length;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${tokenIndex}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-i-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c-${tokenIndex}`} className="rounded bg-background px-1 py-0.5 text-xs">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        nodes.push(
          <a
            key={`${keyPrefix}-a-${tokenIndex}`}
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noreferrer' : undefined}
            className="underline underline-offset-2"
          >
            {label}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    lastIndex = end;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isPreviewBoundary(line) {
  return (
    /^\s*```/.test(line) ||
    /^\s*#{1,6}\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line)
  );
}

function renderSafeMdxPreview(content) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const language = line.replace(/^\s*```/, '').trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="overflow-x-auto rounded-lg border border-outline bg-background/60 px-3 py-3 text-xs"
        >
          <code>
            {language ? `// ${language}\n` : ''}
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length);
      const text = headingMatch[2].trim();
      const sizeClass = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : level === 3 ? 'text-lg' : 'text-base';
      blocks.push(
        <div key={`h-${i}`} className={`font-bold text-text ${sizeClass}`}>
          {renderInlinePreview(text, `h-${i}`)}
        </div>
      );
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${i}`} className="border-l-2 border-outline pl-3 text-sm text-muted">
          {quoteLines.map((quoteLine, idx) => (
            <p key={`q-${i}-${idx}`}>{renderInlinePreview(quoteLine, `q-${i}-${idx}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="ml-5 list-disc space-y-1 text-sm">
          {items.map((item, idx) => (
            <li key={`ul-${i}-${idx}`}>{renderInlinePreview(item, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="ml-5 list-decimal space-y-1 text-sm">
          {items.map((item, idx) => (
            <li key={`ol-${i}-${idx}`}>{renderInlinePreview(item, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isPreviewBoundary(lines[i])) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    const paragraph = paragraphLines.join(' ').trim();
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-secondary">
        {renderInlinePreview(paragraph, `p-${i}`)}
      </p>
    );
  }

  if (blocks.length === 0) {
    return <p className="text-sm text-muted">Nothing to preview yet.</p>;
  }

  return <div className="space-y-3">{blocks}</div>;
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
  const [activeTab, setActiveTab] = useState('new');
  const [editorView, setEditorView] = useState('write');
  const [isAuthExpanded, setIsAuthExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, slug: '' });
  const recentArticles = data?.allMdx?.nodes || [];

  const isDisabled = RUNTIME === 'github';
  const isLocal = RUNTIME === 'local';
  const isConnected = form.token.trim().length > 0 && !tokenError;

  if (isDisabled) {
    return (
      <div className="not-prose mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-bold text-text">Write Panel</h1>
        <div className="rounded-xl p-6 text-center">
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

  const handleTabChange = (nextTab) => {
    if (nextTab === 'new') {
      handleResetEditor('new');
      return;
    }
    setActiveTab(nextTab);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'delete') return;

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

  const handleResetEditor = (nextTab = 'new') => {
    setActiveTab(nextTab);
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

  const updateContentSelection = (transform) => {
    const textarea = contentRef.current;
    if (!textarea || typeof transform !== 'function') {
      return;
    }

    const start = textarea.selectionStart ?? form.content.length;
    const end = textarea.selectionEnd ?? form.content.length;
    const selected = form.content.slice(start, end);
    const result = transform(selected, start, end);

    if (!result || typeof result.text !== 'string') return;

    const nextContent = `${form.content.slice(0, start)}${result.text}${form.content.slice(end)}`;
    const nextSelectionStart =
      typeof result.selectionStart === 'number' ? start + result.selectionStart : start + result.text.length;
    const nextSelectionEnd =
      typeof result.selectionEnd === 'number' ? start + result.selectionEnd : start + result.text.length;

    setForm((prev) => ({ ...prev, content: nextContent }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  const insertMarkdownIntoContent = (snippet) => {
    if (!snippet) return;

    const textarea = contentRef.current;
    if (!textarea) {
      setForm((prev) => ({ ...prev, content: prev.content ? `${prev.content}\n\n${snippet}` : snippet }));
      return;
    }

    updateContentSelection(() => ({ text: snippet }));
  };

  const applyToolbarWrap = (prefix, suffix = prefix, fallbackText = 'text') => {
    updateContentSelection((selected) => {
      const content = selected || fallbackText;
      const text = `${prefix}${content}${suffix}`;
      const selectionStart = prefix.length;
      const selectionEnd = prefix.length + content.length;
      return { text, selectionStart, selectionEnd };
    });
  };

  const handleToolbarInsert = (type) => {
    if (type === 'h2') {
      updateContentSelection((selected) => {
        const raw = selected || 'Heading';
        const text = `## ${raw}`;
        return { text, selectionStart: 3, selectionEnd: text.length };
      });
      return;
    }

    if (type === 'bold') {
      applyToolbarWrap('**', '**', 'bold text');
      return;
    }

    if (type === 'italic') {
      applyToolbarWrap('*', '*', 'italic text');
      return;
    }

    if (type === 'link') {
      updateContentSelection((selected) => {
        const label = selected || 'link text';
        const url = 'https://example.com';
        const text = `[${label}](${url})`;
        const urlStart = text.indexOf(url);
        return { text, selectionStart: urlStart, selectionEnd: urlStart + url.length };
      });
      return;
    }

    if (type === 'code') {
      applyToolbarWrap('`', '`', 'code');
      return;
    }

    if (type === 'image') {
      updateContentSelection((selected) => {
        const alt = selected || 'image alt';
        const url = '/images/uploads/';
        const text = `![${alt}](${url})`;
        const urlStart = text.indexOf(url);
        return { text, selectionStart: urlStart, selectionEnd: text.length - 1 };
      });
    }
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
      setActiveTab('edit');
      setEditorView('write');
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

  const openDeleteConfirm = (rawSlug) => {
    const normalizedSlug = normalizeArticleSlugInput(rawSlug);
    if (!normalizedSlug) {
      setDeleteStatus({
        type: 'error',
        message: 'Provide a valid article slug (e.g. post-title-slug).'
      });
      return;
    }

    setDeleteConfirm({ open: true, slug: normalizedSlug });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, slug: '' });
  };

  const handleDeleteConfirmed = async () => {
    const normalizedSlug = normalizeArticleSlugInput(deleteConfirm.slug);
    if (!normalizedSlug) {
      closeDeleteConfirm();
      setDeleteStatus({
        type: 'error',
        message: 'Provide a valid article slug (e.g. post-title-slug).'
      });
      return;
    }

    closeDeleteConfirm();
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

  const toolbarActions = [
    { id: 'h2', label: 'H2' },
    { id: 'bold', label: 'Bold' },
    { id: 'italic', label: 'Italic' },
    { id: 'link', label: 'Link' },
    { id: 'code', label: 'Code' },
    { id: 'image', label: 'Image' }
  ];

  const publishButtonLabel =
    status.type === 'loading'
      ? editingSlug
        ? 'Updating...'
        : 'Publishing...'
      : editingSlug
      ? form.status === 'draft'
        ? 'Update Draft'
        : 'Update Article'
      : form.status === 'draft'
      ? 'Save Draft'
      : 'Publish Article';

  const renderRecentArticles = (isInline = false) => (
    <div className={isInline ? 'space-y-3 rounded-xl border border-outline/60 px-4 py-4' : ''}>
      <h5 className="m-0 text-sm font-semibold uppercase tracking-wide text-secondary">Recent Articles</h5>
      <p className="mt-1 text-xs text-muted">Use Edit to load article form instantly.</p>
      <ul className="m-0 mt-4 list-none space-y-5 p-0">
        {recentArticles.map((node, index) => {
          const articlePath = node?.fields?.slug || '';
          const articleSlug = normalizeArticleSlugInput(articlePath);
          const articleTitle = node?.frontmatter?.title || articleSlug;
          const articleStatus = node?.frontmatter?.status === 'draft' ? 'Draft' : 'Published';

          return (
            <li key={`${articlePath}-${index}`} className="space-y-1">
              <p className="m-0 text-sm font-semibold text-secondary break-words">{articleTitle}</p>
              <code className="block break-all text-[11px] text-muted">{articleSlug}</code>
              <div className="mt-2 flex items-center justify-between gap-3">
                <small className="rounded-full border border-outline px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {articleStatus}
                </small>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleLoadForEdit(articleSlug)}
                    className="text-secondary transition-colors hover:text-primary"
                    title="Edit article"
                  >
                    Edit
                  </button>
                  <Link
                    to={articlePath}
                    className="text-secondary transition-colors hover:text-primary"
                    title="Open article"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => openDeleteConfirm(articleSlug)}
                    className="text-salmon transition-colors hover:text-primary"
                    title="Delete article"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const previewSlug = form.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');

  return (
    <div className="not-prose mx-auto w-full max-w-4xl space-y-8 sm:space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-muted">Admin</p>
          <h1 className="m-0 text-3xl font-bold text-text sm:text-4xl">Write Panel</h1>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
            isConnected ? 'border-teal/50 text-teal' : 'border-outline text-muted'
          }`}
        >
          {isConnected ? 'Connected' : 'Not Connected'}
        </span>
      </header>

      <div className="flex flex-wrap gap-3">
        {WRITE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`${TAB_BUTTON_CLASSES} ${
              activeTab === tab.id
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(editingSlug || editStatus.type !== 'idle') && activeTab === 'edit' ? (
        <div className="space-y-2">
          {editingSlug ? (
            <div className="text-sm text-secondary">
              <span className="font-semibold text-text">Editing:</span> <code>{editingSlug}</code>
              <button
                type="button"
                onClick={() => handleResetEditor('new')}
                className="ml-3 inline-flex text-primary underline underline-offset-2 hover:no-underline"
              >
                Reset form
              </button>
            </div>
          ) : null}
          {editStatus.type !== 'idle' ? (
            <div className={`text-sm ${editStatus.type === 'error' ? 'text-salmon' : 'text-teal'}`}>
              {editStatus.message}
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className={PANEL_CARD_CLASSES}>
        <div className={FORM_STACK_CLASSES}>
          <section className="space-y-4 rounded-xl border border-outline/70 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => setIsAuthExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className={SECTION_TITLE_CLASSES}>Authentication Settings</span>
              <span className="text-xs text-muted">{isAuthExpanded ? 'Hide' : 'Show'}</span>
            </button>

            {isAuthExpanded ? (
              <div className="space-y-3">
                <p className={MUTED_TEXT_CLASSES}>
                  Enter your admin token to publish or edit articles.
                  {isLocal ? (
                    <>
                      {' '}
                      Local accepts any non-empty value. Example:{' '}
                      <code className="rounded bg-background px-1.5 py-0.5">my-dev-token</code>
                    </>
                  ) : null}
                </p>
                <label className={LABEL_CLASSES} htmlFor="token">
                  Admin Token
                </label>
                <input
                  id="token"
                  type="text"
                  value={form.token}
                  onChange={handleTokenChange}
                  onBlur={handleTokenBlur}
                  placeholder={isLocal ? 'Bearer token...' : 'WRITE_SECRET token...'}
                  className={`${FIELD_CLASSES} font-mono text-sm ${tokenError ? 'border-salmon' : ''}`}
                />
                {tokenError ? <p className={ERROR_CLASSES}>{tokenError}</p> : null}
              </div>
            ) : null}
          </section>

          {(activeTab === 'new' || activeTab === 'edit') && (
            <>
              <section className={SECTION_CARD_CLASSES}>
                <h2 className={SECTION_TITLE_CLASSES}>Article Info</h2>

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
                  {previewSlug ? (
                    <small className="block text-sm text-muted">
                      Preview slug: <code className="rounded bg-background px-1">/articles/{previewSlug}/</code>
                    </small>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <span className={LABEL_CLASSES}>Status</span>
                  <div className="inline-flex rounded-lg border border-outline p-1">
                    {['published', 'draft'].map((s) => (
                      <label
                        key={s}
                        htmlFor={`status-${s}`}
                        className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                          form.status === s ? 'bg-primary/15 text-primary' : 'text-secondary hover:text-primary'
                        }`}
                      >
                        <input
                          id={`status-${s}`}
                          type="radio"
                          name="status"
                          value={s}
                          checked={form.status === s}
                          onChange={set('status')}
                          className="sr-only"
                        />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <label className={LABEL_CLASSES} htmlFor="date">
                      Date
                    </label>
                    <input id="date" type="date" value={form.date} onChange={set('date')} className={FIELD_CLASSES} />
                  </div>
                </div>

                <div className="space-y-2">
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
                </div>
              </section>

              <section className={SECTION_CARD_CLASSES}>
                <h2 className={SECTION_TITLE_CLASSES}>Media</h2>

                <div className="space-y-2">
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
                  {form.featuredImage ? (
                    <div className="mt-2 h-44 w-full max-w-md overflow-hidden rounded-xl border border-outline sm:h-52">
                      <img
                        src={form.featuredImage}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className={MUTED_TEXT_CLASSES}>
                    Upload image to <code>/static/images/uploads/...</code> and reuse URL in content.
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
                    placeholder="Alt text (optional)"
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
                    {uploadStatus.type !== 'idle' ? (
                      <span
                        className={`text-sm ${
                          uploadStatus.type === 'error'
                            ? 'text-salmon'
                            : uploadStatus.type === 'success'
                            ? 'text-teal'
                            : 'text-secondary'
                        }`}
                      >
                        {uploadStatus.message}
                      </span>
                    ) : null}
                  </div>
                  {uploadedAsset?.imageUrl ? (
                    <div className="space-y-3">
                      <code className="block break-all rounded bg-background px-2 py-1 text-xs text-muted">
                        {uploadedAsset.imageUrl}
                      </code>
                      <div className="flex flex-col gap-2 sm:flex-row">
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
                </div>
              </section>

              <section className={SECTION_CARD_CLASSES}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className={SECTION_TITLE_CLASSES}>Content</h2>
                  <div className="inline-flex rounded-lg border border-outline p-1">
                    {EDITOR_VIEWS.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => setEditorView(view.id)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                          editorView === view.id ? 'bg-primary/15 text-primary' : 'text-secondary hover:text-primary'
                        }`}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {toolbarActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleToolbarInsert(action.id)}
                      disabled={editorView !== 'write'}
                      className={`${TOOLBAR_BUTTON_CLASSES} ${
                        editorView !== 'write' ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {editorView === 'write' ? (
                  <div className="space-y-2">
                    <textarea
                      ref={contentRef}
                      id="content"
                      value={form.content}
                      onChange={set('content')}
                      required
                      rows={18}
                      placeholder={`Write your article in MDX format.\n\n## Heading\n\nRegular text and **bold** and *italic*.\n\n\`\`\`js\nconsole.log("code block");\n\`\`\``}
                      className={`${FIELD_CLASSES} min-h-[18rem] resize-y font-mono text-sm leading-relaxed sm:min-h-[22rem]`}
                    />
                    <p className="text-right text-xs text-muted">{form.content.length} characters</p>
                  </div>
                ) : (
                  <div className="min-h-[18rem] rounded-xl border border-outline bg-surface/40 px-4 py-4 sm:min-h-[22rem]">
                    {renderSafeMdxPreview(form.content)}
                  </div>
                )}
              </section>

              <section className={SECTION_CARD_CLASSES}>
                <h2 className={SECTION_TITLE_CLASSES}>Publishing</h2>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <button type="submit" disabled={status.type === 'loading'} className={PRIMARY_BUTTON_CLASSES}>
                    {publishButtonLabel}
                  </button>

                  {status.type === 'success' ? (
                    <div className="flex items-start gap-2 text-sm text-teal">
                      <span className="mt-0.5 shrink-0">&#10003;</span>
                      <div>
                        <span className="break-words">{status.message}</span>
                        {status.url ? (
                          <button
                            type="button"
                            onClick={() => navigate(status.url)}
                            className="mt-1 block text-secondary underline underline-offset-2 hover:no-underline"
                          >
                            View article
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {status.type === 'error' ? (
                    <div className="flex items-start gap-2 text-sm text-salmon">
                      <span className="mt-0.5 shrink-0">&#10007;</span>
                      <span className="break-words">{status.message}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}

          {activeTab === 'delete' && (
            <section className="space-y-4 rounded-xl border border-salmon/40 px-4 py-4 sm:px-5">
              <h2 className="m-0 text-base font-semibold text-salmon">Danger Zone</h2>
              <p className={MUTED_TEXT_CLASSES}>Enter an article slug to delete it permanently.</p>
              <div className="space-y-2">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={() => openDeleteConfirm(deleteSlug)}
                  disabled={deleteStatus.type === 'loading'}
                  className={DELETE_BUTTON_CLASSES}
                >
                  {deleteStatus.type === 'loading' ? 'Deleting...' : 'Delete Article'}
                </button>

                {deleteStatus.type === 'success' ? (
                  <div className="flex items-start gap-2 text-sm text-teal">
                    <span className="mt-0.5 shrink-0">&#10003;</span>
                    <span className="break-words">{deleteStatus.message}</span>
                  </div>
                ) : null}

                {deleteStatus.type === 'error' ? (
                  <div className="flex items-start gap-2 text-sm text-salmon">
                    <span className="mt-0.5 shrink-0">&#10007;</span>
                    <span className="break-words">{deleteStatus.message}</span>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </form>

      {activeTab === 'edit' ? (
        <>
          <div className="xl:hidden">{renderRecentArticles(true)}</div>
          <AsideElement>{renderRecentArticles()}</AsideElement>
        </>
      ) : null}

      {deleteConfirm.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-outline bg-surface p-5 space-y-4">
            <h3 className="m-0 text-lg font-semibold text-text">Confirm Deletion</h3>
            <p className="text-sm text-secondary">
              Delete article <code>{deleteConfirm.slug}</code>? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeDeleteConfirm} className={SECONDARY_BUTTON_CLASSES}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteConfirmed} className={DELETE_BUTTON_CLASSES}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
