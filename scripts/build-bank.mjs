#!/usr/bin/env node
/**
 * Assemble the question bank from per-topic source files.
 *
 *   bank-src/topics.json      → the topic catalog (order, names, colours)
 *   bank-src/<topic-id>.json  → an array of questions for that topic
 *
 * Produces  public/bank/questions.json  (what the app loads), validated.
 *
 * You do NOT need to write a "topic" or an "id" for each question:
 *   · topic  comes from the file name
 *   · id     is auto-generated from the stem (stable across reordering)
 *
 * Run:  npm run bank
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "bank-src");
const outFile = resolve(root, "public/bank/questions.json");

const errors = [];
const warnings = [];
const die = (m) => {
  console.error(`\n  ✖ ${m}\n`);
  process.exit(1);
};

if (!existsSync(resolve(srcDir, "topics.json"))) die("bank-src/topics.json not found.");
const catalog = JSON.parse(readFileSync(resolve(srcDir, "topics.json"), "utf8"));
if (!Array.isArray(catalog.topics)) die("topics.json must have a `topics` array.");

const topicIds = new Set(catalog.topics.map((t) => t.id));
const topics = catalog.topics.map((t, i) => ({
  id: t.id,
  name: t.name,
  order: t.order ?? i + 1,
  ...(t.color ? { color: t.color } : {}),
}));

// Warn about stray topic files with no catalog entry (likely a typo / forgot to catalog).
for (const f of readdirSync(srcDir)) {
  if (f.endsWith(".json") && f !== "topics.json" && !f.startsWith("_")) {
    const id = f.replace(/\.json$/, "");
    if (!topicIds.has(id)) warnings.push(`bank-src/${f} has no matching topic in topics.json (add it to the catalog).`);
  }
}

const shortId = (topic, stem) => `${topic}-${createHash("sha1").update(stem).digest("hex").slice(0, 6)}`;

const questions = [];
const seenIds = new Set();
const perTopicCount = {};

for (const t of catalog.topics) {
  const file = resolve(srcDir, `${t.id}.json`);
  perTopicCount[t.id] = 0;
  if (!existsSync(file)) {
    warnings.push(`No questions file for topic "${t.id}" (bank-src/${t.id}.json) yet.`);
    continue;
  }
  let arr;
  try {
    arr = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    die(`bank-src/${t.id}.json is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(arr)) die(`bank-src/${t.id}.json must be an array of questions.`);

  arr.forEach((q, i) => {
    const at = `bank-src/${t.id}.json[${i}]`;
    if (!q.stem || !String(q.stem).trim()) errors.push(`${at} is missing a "stem".`);
    const type = q.type || "mcq";
    if (!["mcq", "multi", "read"].includes(type)) errors.push(`${at} invalid type "${type}".`);

    if (type === "mcq" || type === "multi") {
      const opts = q.options || [];
      if (opts.length < 2) errors.push(`${at} needs at least 2 options.`);
      const correct = opts.filter((o) => o.correct).length;
      if (correct === 0) errors.push(`${at} has no correct option.`);
      if (type === "mcq" && correct > 1) errors.push(`${at} is "mcq" but has ${correct} correct options — use "multi".`);
    }

    const id = q.id || shortId(t.id, q.stem || String(i));
    if (seenIds.has(id)) errors.push(`${at} duplicate id "${id}" (give it an explicit unique "id").`);
    seenIds.add(id);

    questions.push({
      id,
      topic: t.id,
      type,
      ...(q.difficulty ? { difficulty: q.difficulty } : {}),
      stem: q.stem,
      ...(q.images ? { images: q.images } : {}),
      ...(q.options ? { options: q.options } : {}),
      ...(q.explanation ? { explanation: q.explanation } : {}),
      ...(q.references ? { references: q.references } : {}),
      ...(q.tags ? { tags: q.tags } : {}),
    });
    perTopicCount[t.id]++;
  });
}

for (const w of warnings) console.log(`  ⚠︎  ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  ✖  ${e}`);
  die(`${errors.length} error(s) — nothing written. Fix and re-run.`);
}

const bank = {
  version: 1,
  updatedAt: new Date().toISOString().slice(0, 10),
  title: catalog.title || "Hand Surgery Trainer",
  topics,
  questions,
};
writeFileSync(outFile, JSON.stringify(bank, null, 2) + "\n");

console.log(`\n  ${bank.title}`);
for (const t of catalog.topics) console.log(`   · ${t.name.padEnd(16)} ${perTopicCount[t.id]} question(s)`);
console.log(`\n  ✓ Wrote ${questions.length} questions across ${topics.length} topics → public/bank/questions.json\n`);
