# reelbox-config

我的 Reelbox 配置。一个 `index.json` 里放着源和适配器,应用里粘一次地址就全装好。

## 怎么用

Reelbox 里打开 **设置 → 订阅 → 添加**,填这个地址:

```
https://raw.githubusercontent.com/hujiejeff/reelbox-config/master/index.json
```

国内连不上 GitHub 时可以走 jsDelivr(有缓存,最多晚 12 小时):

```
https://cdn.jsdelivr.net/gh/hujiejeff/reelbox-config@master/index.json
```

分支是 `master`。装完会立刻切换过去。以后我改了仓库,你在订阅页点「检查更新」。

## 里面有什么

- **源**:30 条,点播站的采集接口 + 直播频道表
- **适配器**:1 个 —— `4kvm.reelbox.js`,4k 影视(4kvm.net)的解析插件

## 写法

```json
{
  "schema": "reelbox-index/2",
  "name": "reelbox 基础配置",
  "version": "2.0.0",
  "updated": "2026-11-22T14:30:00Z",

  "adapters": [
    { "id": "4kvm", "name": "4K影视", "url": "plugins/4kvm.reelbox.js" }
  ],

  "sources": [
    { "id": "ffzy", "name": "非凡资源",
      "url": "https://cj.ffzyapi.com/api.php/provide/vod/from/ffm3u8",
      "adapter": "vod", "type": "vod" }
  ]
}
```

- `schema` / `name` / `version` / `updated` 必填。`version` 用 `1.0.0`,内容变了把最后一段加一
- `adapters` 可以不写 —— 用内置的 `vod` / `iplayr` / `m3u` 时不用声明

### 源

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 稳定标识,定了别改 |
| `name` | ✅ | 显示名 |
| `url` | ✅ | 站点地址,必须 http(s) |
| `adapter` | ✅ | 内置名字,或 `adapters` 里的 id |
| `type` | ✅ | `vod` / `xml` / `live` / `webox` |
| `verify` | | `true` = 运行时要人工过校验(Cloudflare) |
| `verifyUrl` | | 校验页地址;`url` 推不出站点域名时必填 |
| `posterRatio` | | 封面比例,如 `16:9` |
| `options` | | 交给插件的参数,比如 `{ "quality": "1080" }` |

`type` 为什么不省:直播插件的 url 是站点域名、又不是 `.m3u8`,靠猜会被当成点播,
表现是"能播但进度条一直在"。

### 适配器

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 源用它引用;不能和内置名重名 |
| `name` | ✅ | 显示名 |
| `url` | ✅ | 代码文件位置,相对或绝对 |

**不写版本号、不写 sha256**:版本在代码自己的 `define({...})` 里,完整性靠 HTTPS。

`url` 两种写法:

```
plugins/4kvm.reelbox.js                    → 仓库里的 plugins/ 下(推荐)
https://cdn.x.com/4kvm.reelbox.js          → 别处(换了 CDN 要改索引)
```

## 改完怎么发

```bash
node scripts/validate.mjs        # 检查:字段、文件、语法
node scripts/stamp.mjs --bump    # 版本号 +1、更新时间
git add -A && git commit -m "..." && git push
```

推上去 GitHub 会跑一遍校验,通过后顺手刷掉 jsDelivr 的缓存。
