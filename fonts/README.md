# 文楷字库

`wenkai.woff2` 裁自霞鹜文楷官方 v1.522 Medium（`LXGWWenKai-Medium.ttf`），许可证为 SIL Open Font License 1.1。原始许可证见 [OFL.txt](OFL.txt)。子集的字体内部名为 Huanwo WenKai Medium，保留原版权署名。

[官方发布 v1.522](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.522) · [上游仓库](https://github.com/lxgw/LxgwWenKai)

子集收录游戏源码与入口页面使用的字符、GB2312 一级 3755 字、ASCII 和中文标点。新增玩家可见文字后，在源码仓库根目录重建并校验。

```sh
python3 -m pip install 'fonttools[woff]'
python3 tools/font-subset.py /path/to/LXGWWenKai-Medium.ttf
node tools/check.js
```

裁字脚本同时更新源码仓库的字库覆盖清单及 WOFF2 哈希。
