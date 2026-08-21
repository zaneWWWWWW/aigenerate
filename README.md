# 与先贤同游 · 书院数字合影体验

一个可本地运行的书院游客 AI 合影原型。游客上传照片或使用摄像头拍照，选择先贤、人物风格、书院背景和互动姿势，由 Gemini 生成打卡合照。

## 当前功能

- 上传游客全身照，或使用浏览器摄像头拍摄
- 可选上传面部近照，增强游客身份与五官还原
- 选择蒋万里、陆象山、吕祖谦、王阳明或朱熹
- 在二维立绘和写实 3D 人物之间切换
- 选择书院背景和固定互动姿势
- 使用 NanoApple Gemini 中转站生成合照
- 生成后添加诗人、代表诗句和书院数字体验标签
- 生图失败时提示重试；连续失败三次后提示联系工作人员
- 下载最终合照

项目不会在 Gemini 失败时回退到本地合成。未配置 API Key、网络异常或上游生成失败时，不会输出替代图片。

## 本地启动

安装依赖：

```bash
npm install
```

复制环境变量模板：

```bash
cp .env.example .env
```

在 `.env` 中填写 NanoApple 中转站密钥：

```env
GEMINI_API_STYLE=google
GEMINI_API_BASE_URL=https://cn.nanoapple.cc/v1beta
GEMINI_API_KEY=你的中转站密钥
GEMINI_MODEL=gemini-3.1-flash-image-preview-time
PORT=5174
```

启动开发服务：

```bash
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。浏览器摄像头通常需要在 `localhost` 或 HTTPS 环境中使用。

修改 `.env` 后必须重启 `npm run dev`，服务端只在启动时加载环境变量。前端通过 `/api/config` 判断 Gemini 是否已配置，但不会获得或显示 API Key。

## 生成流程

### 未上传面部近照

系统向 Gemini 提供三张参考图：

1. 游客全身照：身份、体态、服装、发型和原始表情参考
2. 固定先贤图片：先贤五官、冠帽和服装参考
3. 固定书院背景：建筑、牌匾、树木和透视参考

Gemini 完成一次合照生成。

### 上传面部近照

系统采用两阶段生成：

1. 使用游客全身照、先贤图片和书院背景生成完整合照
2. 使用生成结果、游客面部近照和游客全身照进行局部身份精修

第二阶段以生成合照锁定头部朝向、颈部位置、身体方向和现场光线。面部近照只提供五官身份与表情，不应复制近照的拍摄角度、曝光、白平衡或背景。全身照辅助校验身体朝向、发型、服装和肤色过渡。

上传面部近照会额外调用一次 Gemini，因此等待时间和调用成本会增加。面部近照尽量与全身照保持相近朝向和光线，融合效果更稳定。

## 接口与错误处理

服务端使用 Gemini 原生 `generateContent` 协议：

```text
/v1beta/models/gemini-3.1-flash-image-preview-time:generateContent?key=...
```

参考图片使用 `inlineData` 发送，并请求 `TEXT + IMAGE` 输出。前端会在发送前压缩参考图，降低大尺寸背景造成超时的概率。

错误处理规则：

- 第一次和第二次失败：提示“生图网络异常，请重试”
- 连续三次失败：提示“生图连续异常，请联系工作人员”
- 失败时不生成本地替代图

## 隐私与密钥

- API Key 只由服务端读取，不会发送到浏览器
- `.env` 已加入 `.gitignore`，不要将真实密钥写入 `.env.example`
- 游客照片仅保存在浏览器内存和当前 Gemini 请求中
- 当前原型不持久化存储游客原始照片
- 本地 `测试/` 和 `示例/` 目录不会提交到 Git

## 素材目录

- `public/assets/historical`：二维先贤立绘
- `public/assets/historical-3d`：写实 3D 先贤图片
- `public/assets/backgrounds`：书院实拍背景
- `public/assets/process-example`：页面顶部生成流程示例

前端人物配置位于 `src/main.jsx` 的 `people` 数组。新增人物时，需要同时配置人物 ID、显示名称、二维图片和写实 3D 图片。正式部署前应确认所有人物与场景图片的使用授权。
