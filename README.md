# reelbox-config

我的 Reelbox 配置。一个 `index.json` 里放着源、源插件、适配器,应用里粘一次地址就全装好。

## 怎么用

Reelbox 里打开 **设置 → 订阅 → 添加**,填这个地址:

```
https://cdn.jsdelivr.net/gh/hujiejeff/reelbox-config@master/index.json
```

国内用上面这条(jsDelivr)。连 GitHub 顺畅的话也可以直接用 raw:

```
https://raw.githubusercontent.com/hujiejeff/reelbox-config/master/index.json
```

分支是 `master`。装完会立刻切换过去。以后我改了仓库,你在订阅页点「检查更新」就能看到新版本。

## 里面有什么

- **源**:点播站点的采集接口(苹果 CMS 那套 JSON / XML),一共 30 条
- **插件**:`4kvm.reelbox.js`,4k 影视(4kvm.net)的解析插件,对应订阅里的「4K影视」
- **适配器**:没有。`vod` / `iplayr` / `m3u` 是应用自带的内置适配器,不用放进仓库

## index.json 怎么写

```json
{
  "schema": "reelbox-index/1",
  "name": "reelbox 基础配置",
  "version": "1.1.0",
  "updated": "2026-11-22T12:20:00Z",
  "sources": [
    { "id": "ffzy", "name": "非凡资源", "type": "vod",
      "url": "https://cj.ffzyapi.com/api.php/provide/vod/from/ffm3u8", "adapter": "vod" }
  ]
}
```

顶层四个字段是必填的:`schema`、`name`、`version`、`updated`。`version` 用 `1.0.0` 这种三段式,
内容变了就把最后一段加一 —— 应用靠它判断有没有新版本。

### 源

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定标识,定了就别改,更新时靠它认人 |
| `name` | 显示名 |
| `type` | `vod`(JSON 接口)/ `xml` / `live`(频道表)/ `webox`(插件源) |
| `url` | 接口地址,必须是 http(s) |
| `adapter` | 用哪个适配器:`vod` / `iplayr` / `m3u` / `reelbox`(插件) |
| `posterRatio` | 可选,封面比例,比如 `16:9`;不写就按 2:3 |

插件型的源不写 `url`,写 `plugin`,值是 `plugins` 里那条的 id。装的时候应用会把它换成本机
插件文件的路径:

```json
{ "id": "4kvm", "name": "4K影视", "type": "webox", "adapter": "reelbox", "plugin": "4kvm" }
```

### 插件 / 适配器

```json
{ "id": "4kvm", "name": "4K影视", "path": "4kvm.reelbox.js", "version": "1.0.0", "sha256": "…" }
```

- `path` 只写文件名,文件放在 `plugins/` 下(应用只扫这一层,子目录不认)
- `sha256` 用 `node scripts/stamp.mjs` 自动填,别手写
- 适配器把文件名换成 `xxx.adapter.js` 即可,别用 `vod` / `iplayr` / `m3u` / `reelbox` 这几个内置名字

## 改完怎么发

```bash
node scripts/validate.mjs        # 检查:字段、文件、语法、sha256
node scripts/stamp.mjs --bump    # 重新算 sha256,版本号 +1
git add -A && git commit -m "..." && git push
```

推上去 GitHub 会自动跑一遍校验,通过后顺手把 jsDelivr 的缓存刷掉,几十秒后应用就能查到新版本。

## 缓存

jsDelivr 对分支地址缓存 12 小时。CI 已经自动刷新了,一般不用管;真遇到"改了没生效",手动刷一下:

```
https://purge.jsdelivr.net/gh/hujiejeff/reelbox-config@master
```
