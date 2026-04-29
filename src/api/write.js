import https from 'node:https';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

function buildFilename(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');
  return `${slug}-${Date.now()}.mdx`;
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
      message: `Add article: ${title}`,
      content: encodedContent,
      ...(sha ? { sha } : {})
    })
  });

  if (!commitRes.ok) {
    const reason = commitRes.data?.message || commitRes.data?.error || 'Unknown GitHub API error';
    throw new Error(`GitHub API error ${commitRes.status}: ${reason}`);
  }

  // Trigger GitHub Actions workflow rebuild.
  const workflowRes = await githubFetch(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/gatsby.yml/dispatches`,
    token,
    { method: 'POST', body: JSON.stringify({ ref: 'master' }) }
  );

  const rebuildTriggered = workflowRes.status === 204 || workflowRes.status === 200;

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

export default async function handler(req, res) {
  if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
    throw new Error('Invalid Gatsby function response object.');
  }

  if ((req.method || '').toUpperCase() !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = parseRequestBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { title, content, tags, author, date, featuredImage, status } = body;

  const authCheck = validateAuth(req);
  if (!authCheck.valid) {
    return sendJson(res, authCheck.code, { error: authCheck.error, detail: authCheck.detail });
  }

  if (!title || !title.trim()) {
    return sendJson(res, 400, { error: 'Title is required' });
  }
  if (!content || !content.trim()) {
    return sendJson(res, 400, { error: 'Content is required' });
  }

  try {
    const shouldPublishViaGitHub = isProductionRuntime() || isNetlifyFunctionRuntime(req);
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
