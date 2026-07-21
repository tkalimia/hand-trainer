#!/usr/bin/env node
/**
 * Validate a question bank before publishing to Dropbox.
 * Usage: node scripts/validate-questions.mjs path/to/questions.json
 * Zero dependencies — hand-rolled checks against the documented schema.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2] || "public/bank/questions.json";
const errors = [];
const warnings = [];

let bank;
try {
  bank = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (e) {
  console.error(`✖ Cannot read/parse ${file}: ${e.message}`);
  process.exit(1);
}

const TYPES = new Set(["mcq", "multi", "read"]);
const DIFF = new Set(["easy", "medium", "hard"]);

if (typeof bank.version !== "number") errors.push("Top-level `version` must be a number.");
if (!Array.isArray(bank.topics)) errors.push("`topics` must be an array.");
if (!Array.isArray(bank.questions)) errors.push("`questions` must be an array.");

const topicIds = new Set();
for (const [i, t] of (bank.topics || []).entries()) {
  if (!t.id) errors.push(`topics[${i}] missing id`);
  else if (topicIds.has(t.id)) errors.push(`Duplicate topic id "${t.id}"`);
  else topicIds.add(t.id);
  if (!t.name) errors.push(`topics[${i}] ("${t.id}") missing name`);
}

const qIds = new Set();
for (const [i, q] of (bank.questions || []).entries()) {
  const at = `questions[${i}]${q.id ? ` ("${q.id}")` : ""}`;
  if (!q.id) errors.push(`${at} missing id`);
  else if (qIds.has(q.id)) errors.push(`Duplicate question id "${q.id}"`);
  else qIds.add(q.id);

  if (!q.stem || !q.stem.trim()) errors.push(`${at} missing stem`);
  if (!TYPES.has(q.type)) errors.push(`${at} invalid type "${q.type}"`);
  if (q.difficulty && !DIFF.has(q.difficulty)) warnings.push(`${at} unknown difficulty "${q.difficulty}"`);
  if (q.topic && !topicIds.has(q.topic)) errors.push(`${at} references unknown topic "${q.topic}"`);

  if (q.type === "mcq" || q.type === "multi") {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${at} ${q.type} needs at least 2 options`);
    } else {
      const correct = q.options.filter((o) => o.correct).length;
      if (correct === 0) errors.push(`${at} has no correct option`);
      if (q.type === "mcq" && correct > 1) errors.push(`${at} mcq has ${correct} correct options (use type "multi")`);
      q.options.forEach((o, j) => {
        if (typeof o.text !== "string" || !o.text.trim()) errors.push(`${at} option[${j}] missing text`);
        if (typeof o.correct !== "boolean") errors.push(`${at} option[${j}] correct must be boolean`);
      });
    }
  }
  for (const [j, img] of (q.images || []).entries()) {
    if (!img.src) errors.push(`${at} images[${j}] missing src`);
  }
}

console.log(`\n  ${bank.title || "Question bank"} — v${bank.version}`);
console.log(`  ${(bank.topics || []).length} topics · ${(bank.questions || []).length} questions\n`);

for (const w of warnings) console.log(`  ⚠︎  ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  ✖  ${e}`);
  console.log(`\n  ${errors.length} error(s). Fix before publishing.\n`);
  process.exit(1);
}
console.log(`  ✓  Valid.${warnings.length ? ` (${warnings.length} warning(s))` : ""}\n`);
