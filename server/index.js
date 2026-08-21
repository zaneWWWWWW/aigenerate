import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const clientDir = fs.existsSync(path.join(root, 'dist')) ? path.join(root, 'dist') : root;
dotenv.config({ path: path.join(root, '.env') });
const app = express();
app.use(express.json({ limit: '16mb' }));

app.get('/api/config', (_req, res) => {
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    provider: 'NanoApple Gemini',
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-image-preview-time',
  });
});

app.post('/api/generate', async (req, res) => {
  const { preview, visitorImage, faceImage, poetImage, backgroundImage, person, quote, pose } = req.body || {};
  if (!visitorImage?.startsWith('data:image/') || !poetImage?.startsWith('data:image/') || !backgroundImage?.startsWith('data:image/')) return res.status(400).json({ error: '缺少游客全身、诗人或背景参考图' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: '未配置 GEMINI_API_KEY' });
  try {
    const output = await generateWithGemini({ preview, visitorImage, faceImage, poetImage, backgroundImage, person, quote, pose });
    res.json({ image: output });
  } catch (error) {
    console.error('[gemini]', error);
    const timedOut = error?.name === 'TimeoutError' || error?.code === 'UND_ERR_CONNECT_TIMEOUT' || /aborted|timeout/i.test(error?.message || '');
    res.status(502).json({ error: timedOut ? '生图服务响应超时' : (error?.message || 'Gemini 图像服务请求失败'), code: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR' });
  }
});

async function generateWithGemini({ preview, visitorImage, faceImage, poetImage, backgroundImage, person, quote, pose }) {
  const style = (process.env.GEMINI_API_STYLE || 'google').toLowerCase();
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-image-preview-time';
  const baseUrl = (process.env.GEMINI_API_BASE_URL || 'https://cn.nanoapple.cc/v1beta').replace(/\/$/, '');
  const hasFace = Boolean(faceImage?.startsWith('data:image/'));
  const compositionPrompt = `Generate one extremely realistic, high-resolution documentary photograph for a Chinese academy cultural-tourism experience. Reference 1 is the visitor full-body photo and is the authoritative identity, facial-expression, body-proportion, height, clothing and hairstyle reference. Reference 2 is the fixed historical figure ${person}; preserve his face, age, beard, hat, robe, colors and identity. Reference 3 is the locked academy background; preserve its architecture, signboard, trees, stones, perspective and framing.\n\nShow exactly two people, the poet and visitor, standing side by side. ${pose || 'The visitor stands naturally beside the poet.'} Reproduce the visitor's original facial expression exactly as shown in Reference 1, including gaze direction, eyelid openness, eyebrow position, mouth shape, lip separation, smile intensity and facial-muscle state. Do not add a smile, remove a smile, open or close the mouth, change the gaze, or otherwise reinterpret the expression. Preserve the visitor's identity; do not beautify, age, slim, enlarge eyes, change skin tone, change clothing or create a generic face. Keep both full bodies visible from head to shoes and feet planted on the same ground plane. Match scale, perspective, daylight, color temperature, contact shadows and depth of field. Do not add people, objects, text, logos, watermarks or borders. Do not distort or repaint the architecture. The result must look like a real camera photograph, not an illustration or synthetic portrait. Do not render this contextual quote: ${quote}`;
  const compositionRefs = [
    { label: 'REFERENCE 1 - VISITOR FULL-BODY AND IDENTITY PHOTO', dataUrl: visitorImage },
    { label: 'REFERENCE 2 - FIXED POET CHARACTER MASTER', dataUrl: poetImage },
    { label: 'REFERENCE 3 - LOCKED ACADEMY BACKGROUND', dataUrl: backgroundImage },
  ];
  let output = style === 'google'
    ? await requestGoogleImage({ baseUrl, model, apiKey: process.env.GEMINI_API_KEY, prompt: compositionPrompt, refs: compositionRefs, stage: 'composition', person })
    : await requestOpenAICompatibleImage({ baseUrl, model, apiKey: process.env.GEMINI_API_KEY, prompt: compositionPrompt, image: preview || visitorImage });

  if (hasFace && style === 'google') {
    const refinePrompt = `Localized identity-preserving facial-feature correction only. Reference 1 is the generated group photograph and is the authoritative edit target. Reference 2 is the visitor's face identity and exact expression reference; use it only for facial identity, facial proportions, skin complexion and expression. Reference 3 is the original visitor full-body photograph and is the body orientation, neck alignment, hairstyle and clothing reference.

In Reference 1, locate the modern visitor, not the historical poet. Keep the visitor's existing head position, head size, yaw, pitch, roll, camera perspective, neck position, shoulder alignment and body direction exactly as they appear in Reference 1. Do not paste or transplant the entire head from Reference 2. Do not copy Reference 2's camera angle, head angle, focal length, exposure, white balance, indoor lighting or background. Adapt the identity and expression from Reference 2 onto the existing head geometry in Reference 1.

Correct only the modern visitor's internal facial features and the minimum surrounding skin needed for a seamless blend. Preserve the exact expression from Reference 2: eye openness, eyebrow state, mouth shape, lip separation and smile intensity, but render that expression in the head orientation and perspective already established by Reference 1. Preserve facial structure, eye shape and spacing, nose, lips, jawline, natural asymmetry and apparent age. Keep the visitor's intrinsic skin complexion from References 2 and 3, while applying the scene illumination, color temperature, exposure and shadow direction from Reference 1. The face, ears, jaw, hairline and neck must have a continuous natural skin-tone transition with no mask edge, pasted-face boundary, halo, color patch or mismatched sharpness.

Do not beautify, enlarge eyes, narrow the jaw, smooth skin excessively or create a generic face. Preserve all other pixels and content from Reference 1 as closely as possible: visitor hair, head silhouette, body, clothing, hands, poet, background, architecture, lighting, shadows, crop and composition. Output the complete corrected group photograph with no text or added objects.`;
    output = await requestGoogleImage({
      baseUrl,
      model,
      apiKey: process.env.GEMINI_API_KEY,
      prompt: refinePrompt,
      refs: [
        { label: 'REFERENCE 1 - GENERATED GROUP PHOTO / AUTHORITATIVE EDIT TARGET AND HEAD GEOMETRY', dataUrl: output },
        { label: 'REFERENCE 2 - VISITOR FACE IDENTITY AND EXACT EXPRESSION ONLY', dataUrl: faceImage },
        { label: 'REFERENCE 3 - ORIGINAL VISITOR FULL-BODY / BODY DIRECTION, NECK, HAIR AND CLOTHING', dataUrl: visitorImage },
      ],
      stage: 'face-refine',
      person,
    });
  }
  return output;
}

async function requestGoogleImage({ baseUrl, model, apiKey, prompt, refs, stage, person }) {
  const parsedRefs = refs.map(({ label, dataUrl }) => ({ label, ...parseDataUrl(dataUrl) }));
  console.info('[gemini] request', { stage, model, person, referenceBytes: parsedRefs.map((ref) => ref.base64.length) });
  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, ...parsedRefs.flatMap((ref) => [{ text: ref.label }, { inlineData: { mimeType: ref.mimeType, data: ref.base64 } }])] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`中转站返回 ${response.status}: ${detail.slice(0, 500)}`);
  }
  const payload = await response.json();
  const output = extractImage(payload);
  if (!output) throw new Error('Gemini 返回中没有找到图片数据');
  return output;
}

async function requestOpenAICompatibleImage({ baseUrl, model, apiKey, prompt, image }) {
  const response = await callOpenAICompatible({ baseUrl, model, apiKey, prompt, image });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`中转站返回 ${response.status}: ${detail.slice(0, 500)}`);
  }
  const output = extractImage(await response.json());
  if (!output) throw new Error('Gemini 返回中没有找到图片数据');
  return output;
}

function parseDataUrl(dataUrl) {
  const [mimeType, base64] = dataUrl.slice(5).split(';base64,');
  if (!base64) throw new Error('参考图格式无效');
  return { mimeType, base64 };
}

async function callOpenAICompatible({ baseUrl, model, apiKey, prompt, image }) {
  const endpoint = process.env.GEMINI_OPENAI_PATH || '/chat/completions';
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }],
      modalities: ['text', 'image'],
    }),
    signal: AbortSignal.timeout(120000),
  });
}

function extractImage(payload) {
  const candidates = [
    payload?.data?.[0]?.b64_json && `data:image/png;base64,${payload.data[0].b64_json}`,
    payload?.data?.[0]?.url,
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url,
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.data && `data:image/png;base64,${payload.choices[0].message.images[0].image_url.data}`,
    payload?.choices?.[0]?.message?.images?.[0]?.b64_json && `data:image/png;base64,${payload.choices[0].message.images[0].b64_json}`,
    typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content : null,
    payload?.choices?.[0]?.message?.content?.find?.((part) => part?.inline_data || part?.inlineData || part?.image_url),
    payload?.candidates?.flatMap?.((candidate) => candidate?.content?.parts || []).find?.((part) => part?.inlineData || part?.inline_data),
    payload?.image,
    payload?.image_url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && (candidate.startsWith('data:image/') || candidate.startsWith('http'))) return candidate;
    const inline = candidate?.inlineData || candidate?.inline_data;
    if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
    const imageUrl = candidate?.image_url?.url;
    if (imageUrl) return imageUrl;
  }
  return null;
}

app.use(express.static(publicDir));
app.use(express.static(clientDir));
app.use((_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
const port = Number(process.env.PORT || 5174);
app.listen(port, () => console.log(`Shuyuan prototype server running at http://localhost:${port}`));
