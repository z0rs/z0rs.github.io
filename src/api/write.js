import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const GITHUB_OWNER = 'z0rs';
const GITHUB_REPO = 'z0rs.github.io';
const CONTENT_PATH = 'content/articles';

// Bearer token validation:
//   Local dev (NODE_ENV !== 'production'): accept any non-empty Authorization header.
//     This lets you test with any token string without hardcoding secrets locally.
//   Production (Netlify): require Authorization: Bearer <WRITE_SECRET>.
//     Set WRITE_SECRET in Netlify environment variables.
function validateAuth(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();

  if (process.env.NODE_ENV !== 'production') {
    if (bearer) return { valid: true };
    return {
      valid: false,
      code: 401,
      error: 'Unauthorized',
      detail: 'Provide an Authorization: Bearer <token> header.'
    };
  }

  const secret = process.env.WRITE_SECRET;
  if (!secret) {
    return {
      valid: false,
      code: 500,
      error: 'Server misconfigured',
      detail: 'WRITE_SECRET is not set in Netlify environment variables.'
    };
  }
  if (bearer !== secret) {
    return { valid: false, code: 401, error: 'Unauthorized', detail: 'Invalid bearer token.' };
  }
  return { valid: true };
}

// YAML-safe string: escapes double-quotes and backslashes.
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

// --- GitHub API helpers ---

async function githubApi(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
}

async function publishToGitHub({ title, content, tags, author, date, featuredImage, status }) {
  const filename = buildFilename(title);
  const githubPath = `${CONTENT_PATH}/${filename}`;
  const articleSlug = filename.replace('.mdx', '');
  const articleUrl = `/articles/${articleSlug}/`;
  const mdxContent = buildFrontmatter({ title, content, tags, author, date, featuredImage, status });
  const encodedContent = Buffer.from(mdxContent).toString('base64');

  // Get current SHA if file already exists (update vs create)
  let sha = null;
  const existingRes = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`);
  if (existingRes.status === 200) {
    const data = await existingRes.json();
    sha = data.sha;
  }

  // Commit the MDX file to the repo
  const commitRes = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add article: ${title}`,
      content: encodedContent,
      ...(sha ? { sha } : {})
    })
  });

  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({}));
    throw new Error(`GitHub API error ${commitRes.status}: ${err.message || commitRes.statusText}`);
  }

  // Trigger GitHub Actions workflow rebuild — POST is required, not PUT
  const workflowRes = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/gatsby.yml/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'master' })
  });

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
              : ' Note: rebuild trigger failed — check GitHub token permissions.'
          }`
  };
}

// --- Filesystem write (local development) ---

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
        ? `Draft saved as "${filename}". Changes are local only — commit and push to trigger a rebuild.`
        : `Article saved as "${filename}". Commit and push to trigger a rebuild.`
  };
}

// Gatsby Functions in development mode receive Express req/res middleware arguments.
// The Netlify adapter converts the return value to a response in production.
export default async function handler(req, res) {
  // --- Development mode: Express middleware ---
  if (res && typeof res.json === 'function') {
    let body;
    try {
      body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { title, content, tags, author, date, featuredImage, status } = body;
    const authCheck = validateAuth(req);
    if (!authCheck.valid) return res.status(authCheck.code).json({ error: authCheck.error, detail: authCheck.detail });
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

    try {
      const result = writeToFilesystem({ title, content, tags, author, date, featuredImage, status });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to write file', detail: err.message });
    }
  }

  // --- Production mode (Netlify): GitHub API ---
  let body;
  try {
    body = JSON.parse(req.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const { title, content, tags, author, date, featuredImage, status } = body;
  const authCheck = validateAuth(req);
  if (!authCheck.valid) {
    return {
      statusCode: authCheck.code,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: authCheck.error, detail: authCheck.detail })
    };
  }
  if (!title || !title.trim()) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Title is required' })
    };
  }
  if (!content || !content.trim()) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Content is required' })
    };
  }

  if (!process.env.GITHUB_TOKEN) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'GitHub token not configured',
        detail: 'Set GITHUB_TOKEN in Netlify environment variables to enable publishing.'
      })
    };
  }

  try {
    const result = await publishToGitHub({ title, content, tags, author, date, featuredImage, status });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...result })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to publish', detail: err.message })
    };
  }
}
