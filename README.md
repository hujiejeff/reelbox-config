# reelbox-config

reelbox 的**配置订阅**仓库:一个 `index.json` 里装着源、源插件、适配器。

在应用里粘贴一次地址,就能一次装齐。同一时刻只有一份配置生效,切换 = 整体换一套源;以后改了仓库,在应用里点「检查」看有没有新版本。

```
index.json          ← 清单(源直接写在里面)
plugins/            ← 适配器 *.adapter.js 和源插件 *.reelbox.js
scripts/validate.mjs  CI 检查
scripts/stamp.mjs     提交前补 sha256
```

> 适配器和插件都放在 `plugins/` **第一层**。应用只扫描这一层,放子目录等于没装。

## 订阅地址怎么给

三个都指向同一份文件,内容一样,只是可达性不同:

| 地址 | 适用 |
| --- | --- |
| `https://raw.githubusercontent.com/hujiejeff/reelbox-config/master/index.json` | 直连 GitHub 顺畅时 |
| `https://cdn.jsdelivr.net/gh/hujiejeff/reelbox-config@master/index.json` | 国内通常更快 |
| `https://hujiejeff.github.io/reelbox-config/index.json` | 开了 Pages 才有 |

分支叫 **master**(不是 main)—— 写错就是 404。想固定版本不被误改,把 `master` 换成 tag,例如 `@v1.0.0`。

## 和上一版的区别

**`version` 必须是字符串**:`"1.0.0"`,不能再写 `1`。
老写法现在装不上,应用会直接提示「version 要写成字符串 \"1.0.0\"」。

其余字段没变。

## index.json 字段

### 顶层

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schema` | ✅ | 固定 `"reelbox-index/1"` |
| `name` | ✅ | 订阅列表里显示的名字 |
| `version` | ✅ | **semver**(`1.0.0`),只增不减。应用靠它判断「有没有更新」 |
| `updated` | ✅ | ISO8601,不能是未来时间 |
| `homepage` | | 仓库地址 |
| `adapters` / `plugins` / `sources` | | 三个数组,缺省当空 |

### adapters / plugins

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 全索引唯一 |
| `name` | ✅ | 展示名 |
| `path` | ✅ | `plugins/` 下的文件名,不带目录 |
| `version` | | 这个文件自己的版本(semver),便于看变更 |
| `sha256` | ✅ | 由 `scripts/stamp.mjs` 生成 |
| `minApp` | | 需要的最低应用版本 `x.y.z` |

### sources

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 更新时靠它认人,不要改 |
| `name` | ✅ | 展示名 |
| `type` | ✅ | `vod` / `xml` / `live` / `webox` |
| `url` | ✅ | **必须是 http(s)** |
| `adapter` | ✅ | 内置 `vod` `iplayr` `m3u` `reelbox`,或本索引 `adapters` 里的 id |
| `verify` | | `true` = 运行时要人工过校验(Cloudflare) |
| `verifyUrl` | | 校验页地址;`url` 推不出站点域名时必填 |
| `posterRatio` | | 封面比例,如 `16:9`;空 = 2:3 |
| `options` | | 引擎插件的站点配置 |

## 加一条源

1. 往 `sources` 里加一项,`id` 想个短而稳的(后面不要改)
2. `node scripts/validate.mjs` 检查
3. `node scripts/stamp.mjs --bump` 把最后一段 +1(`1.0.0` → `1.0.1`)
4. 提交

## 加一个插件

1. 文件丢进 `plugins/`,`{文件}.reelbox.js`
2. `plugins` 数组里加一条,`path` 只写文件名
3. 依赖它的源,`adapter` 写 `"reelbox"`,`url` 指向**站点地址**(不是插件文件)
4. `node scripts/stamp.mjs --bump`

## 几条硬规则

- **内置适配器名是保留字**:`vod` `iplayr` `m3u` `reelbox` 不能出现在 `adapters` 里。内置的靠 `@builtin-version` 升级,订阅不能抢这个位置。
- **不能有本地路径的源**。`C:\...\plugins\x.js` 这种只有本机有,别人装了是坏的。
- **sha256 必须对得上**。应用拿它判断「用户改过没有」;对不上时会问用户要不要覆盖,而不是闷头覆盖。
- **`version` 只在真改了东西时才加**。改了不加,装过的人收不到更新;没改就加,所有人白下一次。

## 这份配置里没放什么

| 东西 | 为什么 |
| --- | --- |
| 4k影视 | 100KB 的第三方 webox 插件改造版,且是本地文件路径源;放公开仓库等于转载别人的代码 |
| 厂长资源 | 站点是雷池 WAF 硬封,本机 IP 直接 403,不是校验能过的 |
| 欧乐影视 | 当时探测网络失败,可能是代理问题;等验证稳定再加 |

需要的话可以另开一个**私有**订阅仓库放这些,机制完全一样,只是地址带认证。

## 本地校验

```bash
node scripts/validate.mjs          # 结构 + 文件 + 语法 + sha256
node scripts/validate.mjs 别的.json  # 校验任意文件
node scripts/stamp.mjs             # 只补 sha256
node scripts/stamp.mjs --bump      # 补 sha256 并把 version +1
```
