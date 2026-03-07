import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function readRepo() {
  const files = [];

  function walk(dir) {
    for (const file of fs.readdirSync(dir)) {

      if (file === ".git") continue;
      if (file === "node_modules") continue;

      const full = path.join(dir, file);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        walk(full);
      } else {
        const content = fs.readFileSync(full, "utf8");
        files.push(`FILE: ${full}\n${content}`);
      }
    }
  }

  walk(".");
  return files.join("\n\n");
}

async function runClaude(prompt) {

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return msg.content[0].text;
}

function extractPatch(text) {
  const match = text.match(/```diff([\s\S]*?)```/);
  return match ? match[1] : null;
}

function applyPatch(patch) {
  fs.writeFileSync("ai.patch", patch);
  execSync("git apply ai.patch");
}

async function main() {

  const repo = readRepo();

  const auditPrompt = `
You are a senior software engineer.

Analyze this repository and produce a full audit.

${repo}
`;

  console.log("Running Claude audit...");

  const audit = await runClaude(auditPrompt);

  const remediationPrompt = `
Based on this audit report, generate safe patches.

AUDIT REPORT:

${audit}
`;

  console.log("Running Claude remediation...");

  const remediation = await runClaude(remediationPrompt);

  const patch = extractPatch(remediation);

  if (!patch) {
    console.log("No patch generated.");
    return;
  }

  console.log("Applying patch...");
  applyPatch(patch);
}

main();
