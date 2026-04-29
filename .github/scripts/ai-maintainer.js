'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Anthropic } = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Whitelist of text-based extensions that are safe and useful to read
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.css',
  '.scss',
  '.html',
  '.txt',
  '.sh',
  '.gitignore',
  '.prettierrc',
  '.nvmrc',
  '.env.example'
]);

// Directories to always skip
const SKIP_DIRS = new Set(['.git', 'node_modules', 'public', '.cache', 'dist', 'build', '.next', '.husky']);

// Individual files to always skip (secrets, lockfiles, generated)
const SKIP_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
]);

// Hard cap on total repo content sent to Claude (~22k tokens at 4 chars/token)
const MAX_REPO_CHARS = 90_000;

// Hard cap on a single file (~12k tokens)
const MAX_FILE_CHARS = 50_000;

/**
 * Walk the repository, collecting text files within budget constraints.
 * Skips binaries, secrets, lock files, and large/irrelevant directories.
 */
function readRepo() {
  const files = [];
  let totalChars = 0;
  let skippedCount = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const file of entries) {
      if (SKIP_DIRS.has(file)) continue;
      if (SKIP_FILES.has(file)) continue;

      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file);
      // Allow extensionless dotfiles (.gitignore, .nvmrc, etc.)
      const isDotfile = basename.startsWith('.') && !ext;

      if (!TEXT_EXTENSIONS.has(ext) && !isDotfile) {
        skippedCount++;
        continue;
      }

      if (stat.size > MAX_FILE_CHARS) {
        console.warn(`Skipping large file: ${fullPath} (${stat.size} bytes)`);
        skippedCount++;
        continue;
      }

      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        skippedCount++;
        continue;
      }

      if (totalChars + content.length > MAX_REPO_CHARS) {
        console.warn(`Token budget reached. Skipping: ${fullPath}`);
        skippedCount++;
        continue;
      }

      totalChars += content.length;
      files.push(`=== FILE: ${fullPath} ===\n${content}`);
    }
  }

  walk('.');
  console.log(
    `Repository snapshot: ${files.length} files, ${totalChars} chars. ` +
      `Skipped ${skippedCount} files (binaries/secrets/oversized).`
  );
  return files.join('\n\n');
}

/**
 * Call the Claude API with separate system and user prompts.
 */
async function runClaude(systemPrompt, userContent, maxTokens = 4096) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userContent }],
    system: systemPrompt
  });

  if (!msg.content || msg.content.length === 0) {
    throw new Error('Claude returned an empty response.');
  }

  return msg.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Extract the first unified diff from a fenced ```diff block.
 * Falls back to bare --- a/ header detection.
 */
function extractPatch(text) {
  // Prefer fenced diff block
  const fenced = text.match(/```diff\r?\n([\s\S]*?)```/);
  if (fenced && fenced[1].trim()) return fenced[1].trim();

  // Fallback: bare unified diff starting with --- a/
  const bare = text.match(/(---\s+a\/[\s\S]+)/);
  if (bare && bare[1].trim()) return bare[1].trim();

  return null;
}

/**
 * Dry-run then apply the patch. Exits with error if the patch is invalid.
 */
function applyPatch(patch) {
  const patchFile = path.join(process.cwd(), 'ai.patch');
  fs.writeFileSync(patchFile, patch, 'utf8');

  try {
    // Validate without applying first
    execSync('git apply --check ai.patch', { stdio: 'pipe' });
  } catch (err) {
    console.error('Patch validation failed (git apply --check):');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    console.log('The patch file has been saved to ai.patch for manual review.');
    process.exit(1);
  }

  try {
    execSync('git apply ai.patch', { stdio: 'inherit' });
    console.log('Patch applied successfully.');
  } catch (err) {
    console.error('Patch application failed:', err.message);
    process.exit(1);
  }
}

async function main() {
  // Guard: require API key before doing any work
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log('Reading repository (filtered snapshot)...');
  const repoSnapshot = readRepo();

  // ── Phase 1: Audit ──────────────────────────────────────────────────────
  const auditSystem = [
    'You are a senior software engineer performing a repository audit.',
    'Identify concrete, actionable issues: dependency conflicts, outdated packages,',
    'broken CI/CD configuration, security misconfigurations, and code quality problems.',
    'Be concise, specific, and prioritise by impact.'
  ].join(' ');

  const auditUser = `Audit this repository and list all issues:\n\n${repoSnapshot}`;

  console.log('Running Claude audit...');
  let auditReport;
  try {
    auditReport = await runClaude(auditSystem, auditUser, 4096);
  } catch (err) {
    console.error('Audit step failed:', err.message);
    process.exit(1);
  }

  console.log('\n── AUDIT REPORT ──────────────────────────────────');
  console.log(auditReport);
  console.log('──────────────────────────────────────────────────\n');

  // ── Phase 2: Remediation ────────────────────────────────────────────────
  const remediationSystem = [
    'You are a senior software engineer generating Git patches.',
    'Given an audit report, produce ONLY a unified diff patch that fixes the issues.',
    'Rules: output the patch in a single ```diff ... ``` fenced block;',
    'keep changes minimal and safe; do not modify unrelated files;',
    'do not break existing functionality; include only files that exist in the repo.'
  ].join(' ');

  const remediationUser = `Based on this audit report, generate a unified diff patch:\n\n${auditReport}`;

  console.log('Running Claude remediation...');
  let remediationResponse;
  try {
    remediationResponse = await runClaude(remediationSystem, remediationUser, 4096);
  } catch (err) {
    console.error('Remediation step failed:', err.message);
    process.exit(1);
  }

  const patch = extractPatch(remediationResponse);

  if (!patch) {
    console.log('No patch was produced. The audit may not have found actionable issues.');
    console.log('\nFull remediation output:');
    console.log(remediationResponse);
    process.exit(0);
  }

  console.log('\n── GENERATED PATCH ───────────────────────────────');
  console.log(patch);
  console.log('──────────────────────────────────────────────────\n');

  console.log('Applying patch...');
  applyPatch(patch);
}

main().catch((err) => {
  console.error('Fatal error in AI Maintainer:', err);
  process.exit(1);
});
