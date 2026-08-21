# 与先贤同游 · 书院数字合影体验

这是一个可本地运行的快速原型，支持：

- 上传游客照片，或调用浏览器摄像头拍照
- 选择先贤与书院背景
- 无需密钥的本地演示合成与下载
- 可选的 Gemini 中转 API 精修模式

## 启动

```bash
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。摄像头通常需要 `localhost` 或 HTTPS 环境。

## NanoApple Gemini 中转站

复制 `.env.example` 为 `.env`，填写你的中转站地址、模型和密钥，然后重新启动服务。页面里的“生成模式”开关打开后，会先生成一张本地合成预览，再交给 Gemini 进行图像精修；如果密钥、网络或接口不可用，会自动回退到本地合成，保证试拍流程不中断。

```bash
cp .env.example .env
npm run dev
```

项目已按照 NanoApple 的 Gemini 原生 `generateContent` 协议配置。只需要在 `.env` 中填写中转站密钥：

```env
GEMINI_API_STYLE=google
GEMINI_API_BASE_URL=https://cn.nanoapple.cc/v1beta
GEMINI_API_KEY=你的中转站密钥
GEMINI_MODEL=gemini-3.1-flash-image-preview-time
```

修改 `.env` 后需要重启 `npm run dev`，因为服务端只在启动时加载密钥。页面右侧生成模式会通过 `/api/config` 自动显示当前是否已配置。

服务端请求路径为 `/v1beta/models/gemini-3.1-flash-image-preview-time:generateContent?key=...`，现在会分别上传三张参考图：游客原图、固定诗人立绘、固定书院背景，均使用 Gemini `inlineData` 格式，并请求 `TEXT + IMAGE` 输出。这样模型不需要重建一张已经拼好的卡片图，背景建筑和诗人身份更容易保持稳定。页面提供“自然搭肩 / 轻挽手臂 / 并肩共读”三种固定动作，默认使用稳定性更高的自然搭肩。服务端也保留了对常见 `b64_json`、`inlineData`、`image_url` 返回格式的识别。API 密钥只在服务端读取，不会下发到浏览器；`.env` 已加入 `.gitignore`。原始游客照片只停留在浏览器内存和当前请求中，当前原型不做持久化存储。

前端发送前会将参考图压缩到适合中转站处理的尺寸，避免原始高清书院照片导致请求超时。游客全身照是必需的，用于身高、体态和服装比例；面部近照是可选的。上传面部近照时，系统会先生成完整合影，再调用一次 Gemini 做局部身份精修。精修阶段以生成合影锁定头部朝向、颈部位置和现场光线，面部近照只提供五官身份与表情，全身照辅助校验身体方向和肤色过渡；不上传面部近照时只调用一次 Gemini。Gemini 失败时不会回退到本地合成：第一次失败提示重试，连续三次失败后提示联系工作人员。

## 素材

`public/assets` 中的背景图用于原型演示；`public/assets/historical` 是从 `历史名人立绘` 复制的本地人物资产：

- 岳麓书院场景：Wikimedia Commons，文件页可通过图片文件名检索
- 蒋万里、陆象山、吕祖谦、王阳明、朱熹：对应目录中的拼音文件名

前端人物列表直接绑定这些拼音文件名。新增人物时，添加同名 `.png` 到 `历史名人立绘`，再在 `src/main.jsx` 的 `people` 数组加一条配置即可。正式部署前请确认人物图像的使用授权，并替换为书院实拍背景。
