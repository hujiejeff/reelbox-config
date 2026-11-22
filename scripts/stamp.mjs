#!/usr/bin/env node
// 提交前跑一次:把每个代码文件的 sha256 和 updated 时间写回 index.json。
//
// 手填 sha256 是件必错的事,所以让机器填。应用靠 sha256 判断
// 「这个文件用户改过没有」——少了它就只能无脑覆盖。
//
// 用法:
//   node scripts/stamp.mjs           只补 sha256 + updated
//   node scripts/stamp.mjs --bump    顺便把 version 加一(发布前用)
//
// 注意:版本号是**给应用的信号**,不是给用户看的。改了任何一个文件就该 bump,
// 否则装过的人不会收到更新。

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "index.json");
const bump = process.argv.includes("--bump");

const idx = JSON.parse(readFileSync(INDEX, "utf8"));
let changed = 0;

function stamp(entry, kind) {
  if (!entry || !entry.path) {
    console.error(`! ${kind} ${entry && entry.id}:没有 path,跳过`);
    return;
  }
  const abs = resolve(ROOT, "plugins", entry.path);
  if (!existsSync(abs)) {
    console.error(`! ${kind} ${entry.id}:文件不存在 plugins/${entry.path}`);
    return;
  }
  const sha = createHash("sha256").update(readFileSync(abs)).digest("hex");
  if (entry.sha256 !== sha) {
    entry.sha256 = sha;
    changed++;
    console.log(`  ${entry.id} → ${sha.slice(0, 12)}…`);
  }
}

for (const a of idx.adapters || []) stamp(a, "adapter");
for (const p of idx.plugins || []) stamp(p, "plugin");

if (bump) {
  idx.version = (Number(idx.version) || 0) + 1;
  console.log(`  version → ${idx.version}`);
}
idx.updated = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

writeFileSync(INDEX, JSON.stringify(idx, null, 2) + "\n", "utf8");
console.log(`✓ 写回 index.json(${changed} 个文件有变化,v${idx.version})`);
