import https from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const GITHUB_OWNER = 'z0rs';
const GITHUB_REPO = 'z0rs.github.io';
const IMAGE_UPLOAD_BASE = 'static/images/uploads';
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

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

function sanitizeName(input) {
  if (!input || typeof input !== 'string') return 'image';

  const withoutExt = input.replace(/\.[a-z0-9]+$/i, '');
  const normalized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');

  return normalized || 'image';
}

function parseImagePayload(body) {
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl.trim() : '';
  if (!dataUrl) {
    return { valid: false, code: 400, error: 'Image payload is required', detail: 'Provide dataUrl in request body.' };
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { valid: false, code: 400, error: 'Invalid image payload', detail: 'dataUrl must be base64 data URI.' };
  }

  const mimeType = String(match[1] || '').toLowerCase();
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    return {
      valid: false,
      code: 400,
      error: 'Unsupported image type',
      detail: `Supported types: ${Object.keys(MIME_TO_EXT).join(', ')}`
    };
  }

  const base64 = String(match[2] || '').replace(/\s+/g, '');
  let binary;
  try {
    binary = Buffer.from(base64, 'base64');
  } catch {
    return { valid: false, code: 400, error: 'Invalid image payload', detail: 'Could not decode base64 image.' };
  }

  if (!binary || binary.length === 0) {
    return { valid: false, code: 400, error: 'Invalid image payload', detail: 'Decoded image is empty.' };
  }
  if (binary.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      code: 413,
      error: 'Image too large',
      detail: `Max image size is ${Math.floor(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.`
    };
  }

  return {
    valid: true,
    ext,
    binary,
    baseName: sanitizeName(body?.filename || body?.alt || 'image')
  };
}

function buildUploadTarget(baseName, ext) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const unique = Date.now().toString(36);
  const filename = `${baseName}-${unique}.${ext}`;
  const repoPath = `${IMAGE_UPLOAD_BASE}/${year}/${month}/${filename}`;
  const publicUrl = `/images/uploads/${year}/${month}/${filename}`;

  return { year, month, filename, repoPath, publicUrl };
}

function buildMarkdownSnippet(alt, publicUrl) {
  const safeAlt = typeof alt === 'string' && alt.trim() ? alt.trim() : 'image';
  return `![${safeAlt}](${publicUrl})`;
}

function githubFetch(apiPath, token, options = {}) {
  return new Promise((resolve, reject) => {
    const rawBody =
      options.body == null ? '' : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);

    const requestOptions = {
      hostname: 'api.github.com',
      path: apiPath,
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json; charset=utf-8',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'z0rs-write-panel-image-upload',
        ...(rawBody ? { 'Content-Length': Buffer.byteLength(rawBody) } : {}),
        ...(options.headers || {})
      }
    };

    const req = https.request(requestOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        let data = {};
        if (responseBody) {
          try {
            data = JSON.parse(responseBody);
          } catch {
            data = { message: responseBody };
          }
        }

        const status = res.statusCode || 500;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          data
        });
      });
    });

    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}

async function uploadToGitHub({ token, repoPath, binary, filename }) {
  const encoded = binary.toString('base64');
  const uploadRes = await githubFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${repoPath}`, token, {
    method: 'PUT',
    body: {
      message: `Upload image: ${filename}`,
      content: encoded
    }
  });

  if (!uploadRes.ok) {
    const reason = uploadRes.data?.message || uploadRes.data?.error || 'Unknown GitHub API error';
    throw new Error(`GitHub API error ${uploadRes.status}: ${reason}`);
  }
}

function uploadToFilesystem({ repoPath, binary }) {
  const outputPath = join(process.cwd(), repoPath);
  const outputDir = dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, binary);
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

  const authCheck = validateAuth(req);
  if (!authCheck.valid) {
    return sendJson(res, authCheck.code, { error: authCheck.error, detail: authCheck.detail });
  }

  const parsedPayload = parseImagePayload(body);
  if (!parsedPayload.valid) {
    return sendJson(res, parsedPayload.code, { error: parsedPayload.error, detail: parsedPayload.detail });
  }

  const target = buildUploadTarget(parsedPayload.baseName, parsedPayload.ext);
  const markdownSnippet = buildMarkdownSnippet(body?.alt, target.publicUrl);

  try {
    const shouldPublishViaGitHub = isProductionRuntime() || isNetlifyFunctionRuntime(req);
    if (shouldPublishViaGitHub) {
      const githubToken = getRuntimeEnv('GITHUB_TOKEN');
      if (!githubToken) {
        return sendJson(res, 500, {
          error: 'GitHub token not configured',
          detail: 'Set GITHUB_TOKEN in Netlify environment variables to enable image upload.'
        });
      }

      await uploadToGitHub({
        token: githubToken,
        repoPath: target.repoPath,
        binary: parsedPayload.binary,
        filename: target.filename
      });

      return sendJson(res, 200, {
        success: true,
        filename: target.filename,
        imageUrl: target.publicUrl,
        markdownSnippet,
        message: `Image "${target.filename}" committed to GitHub.`
      });
    }

    uploadToFilesystem({
      repoPath: target.repoPath,
      binary: parsedPayload.binary
    });

    return sendJson(res, 200, {
      success: true,
      filename: target.filename,
      imageUrl: target.publicUrl,
      markdownSnippet,
      message: `Image "${target.filename}" saved locally.`
    });
  } catch (err) {
    return sendJson(res, 500, { error: 'Failed to upload image', detail: err.message });
  }
}
