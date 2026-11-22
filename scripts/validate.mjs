#!/usr/bin/env node
// index.json 的守门人。
//
// 订阅是「一条链接换全部配置」——用户在应用里粘一个地址,里面写什么就会被装什么。
// 所以这里比应用更严格地检查:结构对不对、引用的文件在不在、代码能不能解析、
// sha256 有没有对不上。CI 里跑不过就不许合。
//
// 用法: node scripts/validate.mjs
// 退出码 0 = 通过;1 = 有问题(逐条打印在 stderr)。

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** 默认查仓库根上的 index.json;传参数可以查别的文件(本地试错用) */
const INDEX = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "index.json");
const SCHEMA = "reelbox-index/1";

/** 应用随包带的适配器,订阅里出现同名会被拒绝 —— 两套升级机制不能打架 */
const BUILTIN_ADAPTERS = new Set(["vod", "vod-rs", "iplayr", "m3u", "reelbox"]);

/** 源的类型;`xml` 是 vod 的 XML 变体,走同一个适配器 */
const SOURCE_TYPES = new Set(["vod", "xml", "live", "webox"]);

const errors = [];
const notes = [];
const fail = (msg) => errors.push(msg);
const note = (msg) => notes.push(msg);

function readJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    fail(`${path} 读不出来:${e.message}`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`index.json 不是合法 JSON:${e.message}`);
    return null;
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isHttpUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

/** 相对 index.json 的路径;拒绝 ../ 逃逸 */
function resolvePath(p) {
  const abs = resolve(ROOT, p);
  if (!abs.startsWith(ROOT)) {
    fail(`path 逃出了仓库:${p}`);
    return null;
  }
  return abs;
}

function checkCodeEntry(entry, kind) {
  const where = `${kind} ${entry.id || "(无 id)"}`;
  if (!entry || typeof entry !== "object") return fail(`${where}:不是对象`);
  if (!entry.id || typeof entry.id !== "string") fail(`${where}:缺 id`);
  if (!entry.name || typeof entry.name !== "string") fail(`${where}:缺 name`);
  if (!entry.path || typeof entry.path !== "string") return fail(`${where}:缺 path`);

  const suffix = kind === "adapter" ? ".adapter.js" : ".reelbox.js";
  // path 两种写法:
  //   1) 文件名 —— 装在仓库的 plugins/ 下(应用只扫一层,不能带子目录)
  //   2) 完整的 http(s) 地址 —— 文件放在别处(别的仓库 / CDN),这一份校验不了内容
  const remote = isHttpUrl(entry.path);
  const fileName = entry.path.split(/[?#]/)[0].split("/").pop() || "";
  if (!fileName.endsWith(suffix)) {
    fail(`${where}:文件名必须以 ${suffix} 结尾(应用只认这个后缀)`);
  }
  if (!remote && entry.path.includes("/")) {
    fail(`${where}:path 要么是文件名(装在 plugins/ 下),要么是完整的 http(s) 地址`);
  }
  if (remote) {
    if (!entry.sha256 || !/^[0-9a-f]{64}$/i.test(String(entry.sha256))) {
      fail(`${where}:远程文件也要填 sha256(应用会拿它校验下载内容)`);
    }
    note(`${where}:path 是远程地址,内容不在这份仓库里,本地校验跳过`);
    return checkMinApp(entry, where);
  }

  const abs = resolvePath(`plugins/${entry.path}`) ?? resolvePath(entry.path);
  if (!abs) return;
  if (!existsSync(abs)) return fail(`${where}:文件不存在 ${entry.path}`);

  const size = statSync(abs).size;
  if (size === 0) fail(`${where}:文件是空的`);
  if (size > 512 * 1024) note(`${where}:文件 ${Math.round(size / 1024)}KB,偏大`);

  // 语法能不能解析 —— 应用里跑的是同一份代码
  try {
    execFileSync(process.execPath, ["--check", abs], { stdio: "pipe" });
  } catch (e) {
    fail(`${where}:语法错误\n${String(e.stderr || e.message).trim()}`);
  }

  if (entry.sha256) {
    const got = sha256(abs);
    if (got !== String(entry.sha256).toLowerCase()) {
      fail(`${where}:sha256 对不上\n  索引里 ${entry.sha256}\n  实际值 ${got}`);
    }
  } else {
    fail(`${where}:缺 sha256(订阅要靠它判断文件是否被改)`);
  }

  checkMinApp(entry, where);
}

function checkMinApp(entry, where) {
  if (entry.minApp !== undefined && !/^\d+\.\d+\.\d+$/.test(String(entry.minApp))) {
    fail(`${where}:minApp 要写成 x.y.z`);
  }
}

// ---- 读 ----

if (!existsSync(INDEX)) {
  console.error("找不到 index.json");
  process.exit(1);
}

const idx = readJson(INDEX);
if (!idx) {
  for (const e of errors) console.error("✗ " + e);
  process.exit(1);
}

// ---- 顶层 ----

if (idx.schema !== SCHEMA) fail(`schema 必须是 "${SCHEMA}",现在是 ${JSON.stringify(idx.schema)}`);
if (!idx.name || typeof idx.name !== "string") fail("缺 name(订阅列表里显示的就是它)");
if (!/^\d+\.\d+\.\d+$/.test(String(idx.version))) {
  fail(`version 要写成 1.0.0 这种三段式,现在是 ${JSON.stringify(idx.version)}`);
}
if (!idx.updated || Number.isNaN(Date.parse(idx.updated))) {
  fail("updated 必须是 ISO8601 时间");
} else if (Date.parse(idx.updated) > Date.now() + 60_000) {
  fail("updated 在未来(schema 和时区写错了?)");
}
if (idx.homepage && !isHttpUrl(idx.homepage)) fail("homepage 必须是 http(s) 地址");

for (const key of ["adapters", "plugins", "sources"]) {
  if (idx[key] === undefined) continue;
  if (!Array.isArray(idx[key])) fail(`${key} 必须是数组`);
}

// 两个命名空间:插件 / 适配器共用一套(都是装在 plugins/ 下的文件),源自己一套。
// 所以"插件 4kvm + 源 4kvm"是合法的 —— 那是两件事。
const ids = new Map();
const srcIds = new Map();
const claim = (id, kind) => {
  if (!id) return;
  const box = kind === "source" ? srcIds : ids;
  if (box.has(id)) fail(`id "${id}" 重复(${box.get(id)} 和 ${kind})`);
  else box.set(id, kind);
};

// ---- 适配器 / 插件 ----

const adapterIds = new Set();
for (const a of idx.adapters || []) {
  if (a && a.id) {
    if (BUILTIN_ADAPTERS.has(a.id)) {
      fail(`适配器 "${a.id}" 是内置名字,订阅里不能重名(内置靠 @builtin-version 升级)`);
    }
    adapterIds.add(a.id);
  }
  claim(a && a.id, "adapter");
  checkCodeEntry(a, "adapter");
}

const pluginIds = new Set();
for (const p of idx.plugins || []) {
  if (p && p.id) pluginIds.add(p.id);
  claim(p && p.id, "plugin");
  checkCodeEntry(p, "plugin");
}

// ---- 源 ----

for (const s of idx.sources || []) {
  const where = `源 ${(s && s.id) || "(无 id)"}`;
  if (!s || typeof s !== "object") {
    fail(`${where}:不是对象`);
    continue;
  }
  claim(s.id, "source");
  if (!s.id || typeof s.id !== "string") fail(`${where}:缺 id(更新时靠它认人)`);
  if (!s.name || typeof s.name !== "string") fail(`${where}:缺 name`);
  if (!SOURCE_TYPES.has(s.type)) {
    fail(`${where}:type 只能是 ${[...SOURCE_TYPES].join(" / ")},现在是 ${JSON.stringify(s.type)}`);
  }
  const hasPlugin = typeof s.plugin === "string" && s.plugin !== "";
  if (hasPlugin) {
    // 插件型的源:装的时候 url 会被换成插件在本机的路径,索引里不用写
    if (!pluginIds.has(s.plugin)) {
      fail(`${where}:引用了不在 plugins 里的插件 ${JSON.stringify(s.plugin)}`);
    }
    if (s.url !== undefined && s.url !== "" && !isHttpUrl(s.url)) {
      fail(`${where}:url 要么不写,要么是 http(s)`);
    }
  } else if (!s.url || typeof s.url !== "string") {
    fail(`${where}:缺 url(或者用 plugin 指明由哪个插件解析)`);
  } else if (!isHttpUrl(s.url)) {
    // 本地路径的源(指向用户自己 plugins 里的文件)不能进订阅:别人装了没有那个文件
    fail(`${where}:url 必须是 http(s),不能是本地路径 —— 本地插件的源请写成 plugin`);
  }
  if (!s.adapter || typeof s.adapter !== "string") {
    fail(`${where}:缺 adapter`);
  } else if (!BUILTIN_ADAPTERS.has(s.adapter) && !adapterIds.has(s.adapter)) {
    fail(`${where}:adapter "${s.adapter}" 既不是内置的,也不在本索引的 adapters 里`);
  }
  if (s.verify !== undefined && typeof s.verify !== "boolean") fail(`${where}:verify 必须是 true/false`);
  if (s.verify === true && !s.verifyUrl && !hasPlugin && !isHttpUrl(s.url)) {
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
  `${(idx.plugins || []).length} 个插件`,
  `${(idx.sources || []).length} 条源`,
];
console.log(`✓ index.json v${idx.version} 通过检查(${counts.join(" / ")})`);
