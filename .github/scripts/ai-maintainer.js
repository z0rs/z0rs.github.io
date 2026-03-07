/**
 * AI Repository Maintainer
 *
 * Scans the repository, sends it to Claude for analysis,
 * generates a patch, applies it, commits, pushes to a new branch,
 * and opens a Pull Request automatically.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY  - Anthropic API key
 *   GITHUB_TOKEN       - GitHub token with repo + PR permissions
 *   GITHUB_REPOSITORY  - e.g. "z0rs/z0rs.github.io" (set automatically by Actions)
 *   FAILED_WORKFLOW    - name of the workflow that triggered this run (optional)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const FAILED_WORKFLOW = process.env.FAILED_WORKFLOW || 'unknown';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

// Directories that should never be read or modified
const IGNORE_PATHS = new Set([
  '.git', 'node_modules', '.cache', 'public', '.npm', 'ai.patch'
]);

// Only text-based source files (keeps context window manageable)
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.yml', '.yaml',
  '.md', '.mdx', '.txt',
  '.css', '.scss', '.less',
  '.html', '.htm', '.sh'
]);

// ---------------------------------------------------------------------------
// Repository reader
// ---------------------------------------------------------------------------

function readRepo(rootDir) {
  const files = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch (_) { return; }

    for (const entry of entries) {
      if (IGNORE_PATHS.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try { stat = fs.statSync(fullPath); } catch (_) { continue; }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(entry).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          files.push({ path: path.relative(rootDir, fullPath), content });
        } catch (_) {}
      }
    }
  }

  walk(rootDir);
  return files;
}

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------

function callAnthropic(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = (parsed.content || [])
            .filter((b) => b.type === 'text').map((b) => b.text).join('\n');
          resolve(text);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

function githubRequest(method, apiPath, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const [owner, repo] = GITHUB_REPOSITORY.split('/');

    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath.replace('{owner}', owner).replace('{repo}', repo),
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ai-maintainer-bot/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (_) { resolve({}); } });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Patch helpers
// ---------------------------------------------------------------------------

function extractPatch(text) {
  const fenced = text.match(/```diff\n([\s\S]*?)```/);
  if (fenced) return fenced[1];
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('--- ') || l.startsWith('diff --git'));
  if (start !== -1) return lines.slice(start).join('\n');
  return null;
}

function applyPatch(patchContent) {
  const patchFile = path.join(process.cwd(), 'ai.patch');
  fs.writeFileSync(patchFile, patchContent, 'utf8');
  try {
    execSync('git apply --check ai.patch', { stdio: 'pipe' });
    execSync('git apply ai.patch', { stdio: 'inherit' });
    console.log('  Patch applied successfully.');
    return true;
  } catch (err) {
    console.error('  git apply failed:', err.message);
    return false;
  } finally {
    try { fs.unlinkSync(patchFile); } catch (_) {}
  }
}

function applyDirectWrites(text) {
  const jsonMatch = text.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch) return false;
  let writes;
  try { writes = JSON.parse(jsonMatch[1]); } catch (_) { return false; }
  let applied = false;
  for (const [filePath, content] of Object.entries(writes)) {
    const abs = path.resolve(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    console.log(`  Written: ${filePath}`);
    applied = true;
  }
  return applied;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

function getDefaultBranch() {
  try {
    return run('git symbolic-ref refs/remotes/origin/HEAD').replace('refs/remotes/origin/', '');
  } catch (_) { return 'master'; }
}

function hasChanges() {
  return run('git status --porcelain').length > 0;
}

async function openPullRequest(branchName, baseBranch, title, body) {
  const result = await githubRequest('POST', '/repos/{owner}/{repo}/pulls', {
    title, body, head: branchName, base: baseBranch, draft: false
  });
  if (result.html_url) {
    console.log(`  Pull Request opened: ${result.html_url}`);
    return result.html_url;
  }
  // May already exist
  const [owner] = GITHUB_REPOSITORY.split('/');
  const existing = await githubRequest(
    'GET',
    `/repos/{owner}/{repo}/pulls?head=${owner}:${branchName}&state=open`
  );
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`  PR already open: ${existing[0].html_url}`);
    return existing[0].html_url;
  }
  console.warn('  Could not create PR:', JSON.stringify(result));
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  const rootDir = process.cwd();
  console.log(`\nReading repository at: ${rootDir}`);

  const files = readRepo(rootDir);
  console.log(`Found ${files.length} source files.`);

  const repoListing = files
    .map((f) => `=== FILE: ${f.path} ===\n${f.content}`)
    .join('\n\n');

  // ── Step 1: Audit ──────────────────────────────────────────────────────────
  const systemAudit = `You are a senior software engineer specialising in Gatsby 5, React 18, Node.js,
and GitHub Actions CI/CD. Audit the repository and produce a concise numbered list of every
problem found. Focus on: missing files, dependency conflicts, broken workflows, ESM/CJS
module issues, and build-breaking problems. Be specific.`;

  console.log('\nStep 1/3 — Running Claude audit...');
  const audit = await callAnthropic(
    systemAudit,
    `Audit this repository. Gatsby build is failing. Triggered by: ${FAILED_WORKFLOW}\n\n${repoListing}`
  );
  console.log('\n-- AUDIT REPORT --\n');
  console.log(audit);
  console.log('\n------------------\n');

  // ── Step 2: Generate fixes ─────────────────────────────────────────────────
  const systemRemediation = `You are a senior software engineer fixing a Gatsby 5 + React 18 + GitHub Actions repository.
Produce safe, minimal fixes. Use unified diff format in a \`\`\`diff block, or for new files
use a JSON object in a \`\`\`json block (keys = relative file paths, values = full file content).
Rules: no breaking changes; use CommonJS for gatsby-config.js and .github/scripts/*.js;
ensure npm install and gatsby build succeed; fix workflow triggers so ai-maintainer.yml fires
on gatsby.yml failure.`;

  console.log('Step 2/3 — Generating fixes...');
  const remediation = await callAnthropic(
    systemRemediation,
    `Fix based on this audit:\n\n${audit}\n\nRepository:\n${repoListing}`
  );
  console.log('\n-- REMEDIATION --\n');
  console.log(remediation.slice(0, 2000), '\n[truncated]');
  console.log('\n-----------------\n');

  // ── Step 3: Apply fixes ────────────────────────────────────────────────────
  let applied = false;
  const patch = extractPatch(remediation);

  if (patch) {
    console.log('Applying patch...');
    applied = applyPatch(patch);
  }

  if (!applied) {
    console.log('Attempting direct file writes...');
    applied = applyDirectWrites(remediation);
  }

  if (!applied) {
    console.log('No machine-applicable fix found. Writing audit report.');
    fs.writeFileSync(
      'AI_MAINTAINER_REPORT.md',
      `# AI Maintainer Report\n\n## Audit\n\n${audit}\n\n## Suggested Fixes\n\n${remediation}\n`,
      'utf8'
    );
    applied = true;
  }

  // ── Step 4: Commit and push ────────────────────────────────────────────────
  run('git config user.name "ai-maintainer[bot]"');
  run('git config user.email "ai-maintainer@users.noreply.github.com"');

  if (!hasChanges()) {
    console.log('No file changes detected. Repository is already healthy.');
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const timestamp = dateStr.replace(/-/g, '');
  const branchName = `ai-maintenance-${timestamp}`;
  const baseBranch = getDefaultBranch();

  console.log(`Creating branch: ${branchName}`);
  try { run(`git checkout -b ${branchName}`); } catch (_) { run(`git checkout ${branchName}`); }

  run('git add -A');
  run(`git commit -m "fix: AI Maintainer automatic repairs [${dateStr}]"`);
  run(`git push origin ${branchName} --force`);
  console.log(`Pushed branch: ${branchName}`);

  // ── Step 5: Open Pull Request ─────────────────────────────────────────────
  if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
    const prBody = `## AI Maintainer — Automatic Fixes

**Triggered by:** \`${FAILED_WORKFLOW}\`
**Model:** \`${MODEL}\`
**Date:** ${new Date().toUTCString()}

### Audit Summary

${audit.slice(0, 3000)}

### Changes Applied

${remediation.slice(0, 3000)}

---
*Generated automatically by [AI Maintainer](.github/scripts/ai-maintainer.js)*`;

    await openPullRequest(
      branchName,
      baseBranch,
      `fix: AI Maintainer automatic repairs (${dateStr})`,
      prBody
    );
  } else {
    console.log('GITHUB_TOKEN not set — skipping PR creation.');
  }

  console.log('\nAI Maintainer run complete.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
