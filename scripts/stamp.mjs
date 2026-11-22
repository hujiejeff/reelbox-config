#!/usr/bin/env node
// 提交前跑一次:更新 updated 时间,发布时把版本号 +1。
//
// v2 起索引里不再有 sha256 —— 完整性靠 HTTPS 和"地址由配置作者控制",
// 本地装完之后应用自己算一份存着(只用来判断用户有没有手改过)。
//
// 用法:
//   node scripts/stamp.mjs           只更新时间
//   node scripts/stamp.mjs --bump    时间 + 最后一段 +1(发布用)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "index.json");
const bump = process.argv.includes("--bump");

const idx = JSON.parse(readFileSync(INDEX, "utf8"));

if (bump) {
  // 三段式:x.y.z,只加最后一段。改结构才动中间/前面那段
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(idx.version));
  idx.version = m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : "1.0.0";
  console.log(`  version → ${idx.version}`);
}
idx.updated = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

writeFileSync(INDEX, JSON.stringify(idx, null, 2) + "\n", "utf8");
console.log(`✓ 写回 index.json(v${idx.version})`);
