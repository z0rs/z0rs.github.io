import https from 'node:https';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB_OWNER = 'z0rs';
const GITHUB_REPO = 'z0rs.github.io';
const CONTENT_PATH = 'content/articles';

function getRuntimeEnv(key) {
  const env = globalThis && globalThis.process && globalThis.process.env ? globalThis.process.env : null;
  if (!env) return undefined;
  const value = env[key];
  return typeof value === 'string' ? value : undefined;
}

function isProductionRuntime() {
  return getRuntimeEnv('NODE_ENV') === 'production';
}

function isNetlifyFunctionRuntime(req) {
  if (req?.netlifyFunctionParams?.event) return true;

  const runtime = getRuntimeEnv('GATSBY_RUNTIME');
  if (runtime === 'netlify') return true;

  try {
    return typeof process.cwd === 'function' && process.cwd().startsWith('/var/task');
  } catch {
    return false;
  }
}

function getHeader(req, name) {
  const headers = req?.headers;
  if (!headers) return '';

  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? '';
  if (Array.isArray(value)) return value[0] || '';
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function parseBodyValue(rawBody, isBase64Encoded = false) {
  if (rawBody == null) return {};
  if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) return rawBody;

  let text = '';
  if (Buffer.isBuffer(rawBody)) {
    text = rawBody.toString('utf8');
  } else if (typeof rawBody === 'string') {
    text = isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf8') : rawBody;
  } else {
    return {};
  }

  if (!text.trim()) return {};
  return JSON.parse(text);
}

function parseRequestBody(req) {
  const parsed = parseBodyValue(req?.body);
  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
    return parsed;
  }

  const event = req?.netlifyFunctionParams?.event;
  if (event && typeof event.body === 'string') {
    return parseBodyValue(event.body, Boolean(event.isBase64Encoded));
  }

  return parsed;
}

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

// Bearer token validation:
//   Local dev (NODE_ENV !== 'production'): accept any non-empty Authorization header.
//   Production (Netlify): require Authorization: Bearer <WRITE_SECRET>.
function validateAuth(req) {
  const auth = getHeader(req, 'authorization');
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();

  if (!isProductionRuntime()) {
    if (bearer) return { valid: true };
    return {
      valid: false,
      code: 401,
      error: 'Unauthorized',
      detail: 'Provide an Authorization: Bearer <token> header.'
    };
  }

  const secret = getRuntimeEnv('WRITE_SECRET');
  if (!secret) {
    return {
      valid: false,
      code: 500,
      error: 'Server misconfigured',
      detail: 'WRITE_SECRET is not set in Netlify environment variables.'
    };
  }
  if (bearer !== secret) {
    return {
      valid: false,
      code: 401,
      error: 'Unauthorized',
      detail: 'Invalid bearer token.'
    };
  }

  return { valid: true };
}

// YAML-safe string: escapes double quotes and backslashes.
function yamlString(str) {
  if (typeof str !== 'string') return '""';
  if (/^[a-zA-Z0-9_\s.,;+\-=()/@#%&$!?|~^-]+$/.test(str)) return str;
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildSlug(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');
  return slug || 'untitled-article';
}

function buildFilename(title) {
  return `${buildSlug(title)}.mdx`;
}

function normalizeArticleSlug(rawSlug) {
  if (typeof rawSlug !== 'string') return '';

  let slug = rawSlug.trim();
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

  if (!slug) return '';
  if (slug.includes('..') || slug.includes('\\') || slug.includes('/')) return '';

  return slug;
}

function buildFrontmatter({ title, content, tags, author, date, featuredImage, status }) {
  return [
    '---',
    'type: article',
    `title: ${yamlString(title.trim())}`,
    tags && tags.length ? `tags: [${tags.map((t) => yamlString(t.trim())).join(', ')}]` : 'tags: []',
    author ? `author: ${yamlString(author.trim())}` : 'author: Eno',
    date ? `date: ${date}` : `date: ${new Date().toISOString().split('T')[0]}`,
    featuredImage ? `featuredImage: ${yamlString(featuredImage)}` : '',
    status === 'draft' ? 'status: draft' : '',
    '---',
    '',
    content.trim(),
    ''
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function githubFetch(apiPath, token, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'api.github.com',
      path: apiPath,
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'z0rs-write-panel',
        ...(options.headers || {})
      }
    };

    const req = https.request(requestOptions, (res) => {
      let rawBody = '';
      res.on('data', (chunk) => (rawBody += chunk));
      res.on('end', () => {
        let data = {};
        if (rawBody) {
          try {
            data = JSON.parse(rawBody);
          } catch {
            data = { message: rawBody };
          }
        }

        const status = res.statusCode || 500;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          data,
          json: async () => data
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function triggerRebuildWorkflow(token) {
  const workflowRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/gatsby.yml/dispatches`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: 'master' })
  });

  return workflowRes.status === 204 || workflowRes.status === 200;
}

async function publishToGitHub({ title, content, tags, author, date, featuredImage, status, token }) {
  const filename = buildFilename(title);
  const githubPath = `${CONTENT_PATH}/${filename}`;
  const articleSlug = filename.replace('.mdx', '');
  const articleUrl = `/articles/${articleSlug}/`;
  const mdxContent = buildFrontmatter({ title, content, tags, author, date, featuredImage, status });
  const encodedContent = Buffer.from(mdxContent).toString('base64');

  // Get current SHA if file already exists (update vs create).
  let sha = null;
  const existingRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, token);
  if (existingRes.status === 200) {
    sha = existingRes.data?.sha || null;
  }

  // Commit the MDX file to the repo.
  const commitRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message: `${sha ? 'Update' : 'Add'} article: ${title}`,
      content: encodedContent,
      ...(sha ? { sha } : {})
    })
  });

  if (!commitRes.ok) {
    const reason = commitRes.data?.message || commitRes.data?.error || 'Unknown GitHub API error';
    throw new Error(`GitHub API error ${commitRes.status}: ${reason}`);
  }

  const rebuildTriggered = await triggerRebuildWorkflow(token);

  return {
    filename,
    articleUrl,
    isDraft: status === 'draft',
    rebuildTriggered,
    message:
      status === 'draft'
        ? `Draft committed as "${filename}" on GitHub.`
        : `Article committed as "${filename}" on GitHub.${
            rebuildTriggered
              ? ' Site rebuild triggered.'
              : ' Note: rebuild trigger failed - check GitHub token permissions.'
          }`
  };
}

async function deleteFromGitHub({ slug, token }) {
  const normalizedSlug = normalizeArticleSlug(slug);
  if (!normalizedSlug) {
    return { notFound: false, invalidSlug: true };
  }

  const filename = `${normalizedSlug}.mdx`;
  const githubPath = `${CONTENT_PATH}/${filename}`;
  const articleUrl = `/articles/${normalizedSlug}/`;

  const existingRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, token);
  if (existingRes.status === 404) {
    return { notFound: true, filename, articleUrl };
  }
  if (!existingRes.ok) {
    const reason = existingRes.data?.message || 'Failed to resolve article file';
    throw new Error(`GitHub API error ${existingRes.status}: ${reason}`);
  }

  const sha = existingRes.data?.sha;
  if (!sha) {
    throw new Error(`GitHub API error: SHA not found for "${filename}"`);
  }

  const deleteRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, token, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `Delete article: ${normalizedSlug}`,
      sha
    })
  });

  if (!deleteRes.ok) {
    const reason = deleteRes.data?.message || deleteRes.data?.error || 'Unknown GitHub API error';
    throw new Error(`GitHub API error ${deleteRes.status}: ${reason}`);
  }

  const rebuildTriggered = await triggerRebuildWorkflow(token);
  return {
    notFound: false,
    filename,
    articleUrl,
    rebuildTriggered,
    message: `Article "${filename}" deleted from GitHub.${rebuildTriggered ? ' Site rebuild triggered.' : ''}`
  };
}

function writeToFilesystem({ title, content, tags, author, date, featuredImage, status }) {
  const filename = buildFilename(title);
  const filepath = join(process.cwd(), CONTENT_PATH, filename);
  const mdxContent = buildFrontmatter({ title, content, tags, author, date, featuredImage, status });

  if (!existsSync(join(process.cwd(), CONTENT_PATH))) {
    mkdirSync(join(process.cwd(), CONTENT_PATH), { recursive: true });
  }
  writeFileSync(filepath, mdxContent, 'utf8');

  const articleSlug = filename.replace('.mdx', '');
  return {
    filename,
    articleUrl: `/articles/${articleSlug}/`,
    isDraft: status === 'draft',
    rebuildTriggered: false,
    message:
      status === 'draft'
        ? `Draft saved as "${filename}". Changes are local only - commit and push to trigger a rebuild.`
        : `Article saved as "${filename}". Commit and push to trigger a rebuild.`
  };
}

function deleteFromFilesystem({ slug }) {
  const normalizedSlug = normalizeArticleSlug(slug);
  if (!normalizedSlug) {
    return { notFound: false, invalidSlug: true };
  }

  const filename = `${normalizedSlug}.mdx`;
  const filepath = join(process.cwd(), CONTENT_PATH, filename);

  if (!existsSync(filepath)) {
    return { notFound: true, filename, articleUrl: `/articles/${normalizedSlug}/` };
  }

  unlinkSync(filepath);
  return {
    notFound: false,
    filename,
    articleUrl: `/articles/${normalizedSlug}/`,
    rebuildTriggered: false,
    message: `Article "${filename}" deleted locally. Commit and push to apply in production.`
  };
}

export default async function handler(req, res) {
  if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
    throw new Error('Invalid Gatsby function response object.');
  }

  const method = (req.method || '').toUpperCase();
  if (!['POST', 'DELETE'].includes(method)) {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = parseRequestBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const authCheck = validateAuth(req);
  if (!authCheck.valid) {
    return sendJson(res, authCheck.code, { error: authCheck.error, detail: authCheck.detail });
  }

  const shouldPublishViaGitHub = isProductionRuntime() || isNetlifyFunctionRuntime(req);

  if (method === 'DELETE') {
    try {
      if (!shouldPublishViaGitHub) {
        const localDelete = deleteFromFilesystem({ slug: body?.slug });
        if (localDelete.invalidSlug) {
          return sendJson(res, 400, {
            error: 'Invalid slug',
            detail: 'Provide a valid article slug, e.g. "web-application-penetration-test-report-braze".'
          });
        }
        if (localDelete.notFound) {
          return sendJson(res, 404, { error: 'Article not found', detail: `No file found for "${localDelete.filename}".` });
        }
        return sendJson(res, 200, { success: true, ...localDelete });
      }

      const githubToken = getRuntimeEnv('GITHUB_TOKEN');
      if (!githubToken) {
        return sendJson(res, 500, {
          error: 'GitHub token not configured',
          detail: 'Set GITHUB_TOKEN in Netlify environment variables to enable deletion.'
        });
      }

      const remoteDelete = await deleteFromGitHub({ slug: body?.slug, token: githubToken });
      if (remoteDelete.invalidSlug) {
        return sendJson(res, 400, {
          error: 'Invalid slug',
          detail: 'Provide a valid article slug, e.g. "web-application-penetration-test-report-braze".'
        });
      }
      if (remoteDelete.notFound) {
        return sendJson(res, 404, { error: 'Article not found', detail: `No file found for "${remoteDelete.filename}".` });
      }

      return sendJson(res, 200, { success: true, ...remoteDelete });
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to delete article', detail: err.message });
    }
  }

  const { title, content, tags, author, date, featuredImage, status } = body;

  if (!title || !title.trim()) {
    return sendJson(res, 400, { error: 'Title is required' });
  }
  if (!content || !content.trim()) {
    return sendJson(res, 400, { error: 'Content is required' });
  }

  try {
    if (!shouldPublishViaGitHub) {
      const result = writeToFilesystem({ title, content, tags, author, date, featuredImage, status });
      return sendJson(res, 200, { success: true, ...result });
    }

    const githubToken = getRuntimeEnv('GITHUB_TOKEN');
    if (!githubToken) {
      return sendJson(res, 500, {
        error: 'GitHub token not configured',
        detail: 'Set GITHUB_TOKEN in Netlify environment variables to enable publishing.'
      });
    }

    const result = await publishToGitHub({
      title,
      content,
      tags,
      author,
      date,
      featuredImage,
      status,
      token: githubToken
    });
    return sendJson(res, 200, { success: true, ...result });
  } catch (err) {
    return sendJson(res, 500, { error: 'Failed to publish', detail: err.message });
  }
}
