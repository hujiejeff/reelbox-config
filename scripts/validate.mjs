#!/usr/bin/env node
// index.json 的守门人。
//
// 订阅是「一条链接换全部配置」——用户在应用里粘一个地址,里面写什么就会被装什么。
// 所以这里比应用更严格地检查:结构对不对、引用的文件在不在、代码能不能解析。
// CI 里跑不过就不许合。
//
// 用法: node scripts/validate.mjs [别的.json]
// 退出码 0 = 通过;1 = 有问题(逐条打印在 stderr)。

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "index.json");
const SCHEMA = "reelbox-index/2";

/** 应用随包带的适配器,订阅里出现同名会被拒绝 */
const BUILTIN_ADAPTERS = new Set(["vod", "vod-rs", "iplayr", "m3u", "reelbox"]);
const SOURCE_TYPES = new Set(["vod", "xml", "live", "webox"]);

const errors = [];
const notes = [];
const fail = (msg) => errors.push(msg);
const note = (msg) => notes.push(msg);

const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

/** 相对 index.json 的路径;拒绝 ../ 逃逸 */
function resolveLocal(p) {
  const abs = resolve(ROOT, "plugins", p);
  if (!abs.startsWith(ROOT)) {
    fail(`url 逃出了仓库:${p}`);
    return null;
  }
  return abs;
}

function checkCode(entry, where) {
  if (!entry.name || typeof entry.name !== "string") fail(`${where}:缺 name`);
  if (!entry.url || typeof entry.url !== "string") return fail(`${where}:缺 url(代码文件在哪)`);

  const remote = isHttpUrl(entry.url);
  const fileName = entry.url.split(/[?#]/)[0].split("/").pop() || "";
  if (!/\.(reelbox|adapter)\.js$/i.test(fileName)) {
    fail(`${where}:文件名要是 *.reelbox.js 或 *.adapter.js`);
  }
  if (!remote && entry.url.includes("/") && !entry.url.startsWith("plugins/")) {
    fail(`${where}:相对路径请写成 plugins/xxx.js`);
  }
  if (remote) {
    note(`${where}:url 是远程地址,内容不在这份仓库里,本地校验跳过`);
    return;
  }

  const abs = resolveLocal(entry.url.replace(/^plugins\//, ""));
  if (!abs) return;
  if (!existsSync(abs)) return fail(`${where}:文件不存在 plugins/${entry.url.replace(/^plugins\//, "")}`);

  const size = statSync(abs).size;
  if (size === 0) fail(`${where}:文件是空的`);
  if (size > 512 * 1024) note(`${where}:文件 ${Math.round(size / 1024)}KB,偏大`);

  // 语法能不能解析 —— 应用里跑的是同一份代码
  try {
    execFileSync(process.execPath, ["--check", abs], { stdio: "pipe" });
  } catch (e) {
    fail(`${where}:语法错误\n${String(e.stderr || e.message).trim()}`);
  }
}

// ---- 读 ----

if (!existsSync(INDEX)) {
  console.error("找不到 index.json");
  process.exit(1);
}

let idx;
try {
  idx = JSON.parse(readFileSync(INDEX, "utf8"));
} catch (e) {
  console.error(`index.json 不是合法 JSON:${e.message}`);
  process.exit(1);
}

// ---- 顶层 ----

if (idx.schema !== SCHEMA) {
  fail(`schema 必须是 "${SCHEMA}",现在是 ${JSON.stringify(idx.schema)}`);
}
if (!idx.name || typeof idx.name !== "string") fail("缺 name(订阅列表里显示的就是它)");
if (!/^\d+\.\d+\.\d+$/.test(String(idx.version))) {
  fail(`version 要写成 1.0.0 这种三段式,现在是 ${JSON.stringify(idx.version)}`);
}
if (!idx.updated || Number.isNaN(Date.parse(idx.updated))) {
  fail("updated 必须是 ISO8601 时间");
} else if (Date.parse(idx.updated) > Date.now() + 60_000) {
  fail("updated 在未来(schema 和时区写错了?)");
}
for (const key of ["adapters", "sources"]) {
  if (idx[key] === undefined) continue;
  if (!Array.isArray(idx[key])) fail(`${key} 必须是数组`);
}

// ---- 适配器 ----

const adapterIds = new Set();
for (const a of idx.adapters || []) {
  const where = `适配器 ${a && a.id ? a.id : "(无 id)"}`;
  if (!a || typeof a !== "object") {
    fail(`${where}:不是对象`);
    continue;
  }
  if (!a.id || typeof a.id !== "string") fail(`${where}:缺 id`);
  if (BUILTIN_ADAPTERS.has(a.id)) {
    fail(`${where}:和内置适配器重名(内置靠 @builtin-version 升级)`);
  }
  if (adapterIds.has(a.id)) fail(`${where}:id 重复`);
  adapterIds.add(a.id);
  checkCode(a, where);
}

// ---- 源 ----

const srcIds = new Set();
for (const s of idx.sources || []) {
  const where = `源 ${(s && s.id) || "(无 id)"}`;
  if (!s || typeof s !== "object") {
    fail(`${where}:不是对象`);
    continue;
  }
  if (!s.id || typeof s.id !== "string") fail(`${where}:缺 id(更新时靠它认人)`);
  if (srcIds.has(s.id)) fail(`${where}:id 重复`);
  srcIds.add(s.id);
  if (!s.name || typeof s.name !== "string") fail(`${where}:缺 name`);
  if (!isHttpUrl(s.url)) fail(`${where}:url 必须是 http(s),不能是本地路径`);
  if (!SOURCE_TYPES.has(s.type)) {
    fail(`${where}:type 只能是 ${[...SOURCE_TYPES].join(" / ")},现在是 ${JSON.stringify(s.type)}`);
  }
  if (!s.adapter || typeof s.adapter !== "string") {
    fail(`${where}:缺 adapter`);
  } else if (!BUILTIN_ADAPTERS.has(s.adapter) && !adapterIds.has(s.adapter)) {
    fail(`${where}:adapter "${s.adapter}" 既不是内置的,也不在本索引的 adapters 里`);
  }
  if (s.verify !== undefined && typeof s.verify !== "boolean") fail(`${where}:verify 必须是 true/false`);
  if (s.verify === true && !s.verifyUrl && !isHttpUrl(s.url)) {
    fail(`${where}:开了 verify 但推不出站点地址,要显式写 verifyUrl`);
  }
  if (s.posterRatio !== undefined && !/^\d+:\d+$/.test(String(s.posterRatio))) {
    fail(`${where}:posterRatio 要写成 16:9 这种`);
  }
}

// ---- 报告 ----

for (const n of notes) console.error("! " + n);
if (errors.length) {
  for (const e of errors) console.error("✗ " + e);
  console.error(`\n${errors.length} 个问题`);
  process.exit(1);
}

const counts = [
  `${(idx.adapters || []).length} 个适配器`,
  `${(idx.sources || []).length} 条源`,
];
console.log(`✓ index.json v${idx.version} 通过检查(${counts.join(" / ")})`);
