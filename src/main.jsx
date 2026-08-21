import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Check, ChevronRight, CircleAlert, Download, ImagePlus, Info, LoaderCircle, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import './styles.css';

const people = [
  { id: 'jiangwanli', name: '蒋万里', era: '先贤 · 书院人物', quote: '立志宜思真品格，读书须尽苦功夫。', intro: '以笃学与实干影响后世的先贤。', image: '/assets/historical/jiangwanli.png', image3d: '/assets/historical-3d/jiangwanli.jpg', accent: '#b44f2f' },
  { id: 'luxiangshan', name: '陆象山', era: '南宋 · 1139—1193', quote: '宇宙便是吾心，吾心即是宇宙。', intro: '以心学思想闻名的理学家、教育家。', image: '/assets/historical/luxiangshan.png', image3d: '/assets/historical-3d/luxiangshan.jpg', accent: '#2f716b' },
  { id: 'lvzuqian', name: '吕祖谦', era: '南宋 · 1137—1181', quote: '学者须是务实，不务实则学无所益。', intro: '兼容并蓄、重视经世致用的学者。', image: '/assets/historical/lvzuqian.png', image3d: '/assets/historical-3d/lvzuqian.jpg', accent: '#8c6a3e' },
  { id: 'wangyangming', name: '王阳明', era: '明 · 1472—1529', quote: '破山中贼易，破心中贼难。', intro: '知行合一思想的提出者与践行者。', image: '/assets/historical/wangyangming.png', image3d: '/assets/historical-3d/wangyangming.jpg', accent: '#6d5b86' },
  { id: 'zhuxi', name: '朱熹', era: '南宋 · 1130—1200', quote: '问渠那得清如许？为有源头活水来。', intro: '理学集大成者，重视读书与实践。', image: '/assets/historical/zhuxi.png', image3d: '/assets/historical-3d/zhuxi.jpg', accent: '#356f68' },
];

const scenes = [
  { id: 'courtyard', name: '讲堂庭院', academy: '岳麓书院', note: '古木 · 回廊 · 书院日光', image: '/assets/yuelu-courtyard.jpg' },
  { id: 'gate', name: '书院门庭', academy: '岳麓书院', note: '牌匾 · 石阶 · 入院时刻', image: '/assets/yuelu-gate.jpg' },
  { id: 'bailudong', name: '慎思门', academy: '白鹿洞书院', note: '白鹿洞书院 · 实拍背景', image: '/assets/backgrounds/bailudong-shensi-gate.jpg' },
];

const poses = [
  { id: 'shoulder', name: '自然搭肩', prompt: '游客一只手臂轻轻搭在诗人肩膀上，身体略向诗人靠近，另一只手自然下垂；身体动作不得改变游客原照片中的面部表情。' },
  { id: 'arm', name: '轻挽手臂', prompt: '游客轻轻挽住诗人的手臂，身体略向诗人靠近，双脚自然站立；身体动作不得改变游客原照片中的面部表情。' },
  { id: 'book', name: '并肩共读', prompt: '两人并肩站立，游客双手自然捧着一本书，诗人一只手持卷轴；游客保持原照片中的面部表情。' },
];

function App() {
  const [personId, setPersonId] = useState('jiangwanli');
  const [sceneId, setSceneId] = useState('courtyard');
  const [poseId, setPoseId] = useState('shoulder');
  const [characterStyle, setCharacterStyle] = useState('2d');
  const [photo, setPhoto] = useState(null);
  const [facePhoto, setFacePhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState('upload');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const uploadFileRef = useRef(null);
  const replaceFileRef = useRef(null);
  const faceFileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const person = people.find((item) => item.id === personId) || people[0];
  const scene = scenes.find((item) => item.id === sceneId) || scenes[0];
  const pose = poses.find((item) => item.id === poseId) || poses[0];
  const characterImage = characterStyle === '3d' ? person.image3d : person.image;

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((config) => {
        setApiConfigured(Boolean(config.configured));
      })
      .catch(() => setApiConfigured(false));
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setStatus('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('当前浏览器不支持摄像头，请使用上传照片。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setStatus('无法打开摄像头，请检查浏览器权限，或改用上传照片。');
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.92));
    setResult(null);
    setSource('camera');
    setCameraOpen(false);
    stopCamera();
  }

  function handleFile(event, target = 'body') {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (target === 'face') setFacePhoto(reader.result);
      else setPhoto(reader.result);
      setResult(null);
      if (target !== 'face') setSource('upload');
      setStatus('');
    };
    reader.onerror = () => setStatus('照片读取失败，请换一张 JPG、PNG 或 WebP 图片重试。');
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function clearPhoto() {
    setPhoto(null);
    setResult(null);
    setStatus('');
  }

  function clearFacePhoto() {
    setFacePhoto(null);
    setResult(null);
    setStatus('');
  }

  async function composeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    const [background, ancient, visitor] = await Promise.all([loadImage(scene.image), loadImage(characterImage), loadImage(photo)]);
    drawCover(ctx, background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(26, 21, 16, .18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const personHeight = 880;
    const personWidth = Math.min(490, personHeight * ancient.width / ancient.height);
    const personX = 130;
    const personY = 420;
    ctx.save();
    ctx.globalAlpha = .98;
    ctx.filter = 'sepia(.12) saturate(.84) contrast(1.02)';
    drawContain(ctx, ancient, personX, personY, personWidth, personHeight);
    ctx.restore();
    const visitorW = 500;
    const visitorH = 650;
    const visitorX = 620;
    const visitorY = 470;
    ctx.save();
    ctx.shadowColor = 'rgba(23, 19, 13, .28)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 18;
    roundedRect(ctx, visitorX, visitorY, visitorW, visitorH, 28);
    ctx.clip();
    drawCover(ctx, visitor, visitorX, visitorY, visitorW, visitorH);
    ctx.restore();
    ctx.fillStyle = 'rgba(246, 238, 222, .92)';
    ctx.fillRect(72, 1175, 1056, 250);
    ctx.fillStyle = '#332b22';
    ctx.font = '600 34px "Noto Serif SC", serif';
    ctx.fillText(`与${person.name}同游`, 112, 1245);
    ctx.font = '400 25px "Noto Serif SC", serif';
    wrapText(ctx, person.quote, 112, 1300, 920, 42);
    ctx.fillStyle = '#8c7353';
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText('书院数字体验 · 演示合成', 112, 1380);
    return canvas.toDataURL('image/jpeg', .94);
  }

  async function generate() {
    if (!photo || busy) return;
    if (!apiConfigured) {
      setErrorModal(true);
      return;
    }
    setBusy(true);
    setResult(null);
    setStatus('正在请求 Gemini 生成服务，通常需要 15–30 秒…');
    try {
      const [visitorImage, faceImage, backgroundImage, poetImage] = await Promise.all([
        optimizeDataUrl(photo, 1400, 0.86),
        facePhoto ? optimizeDataUrl(facePhoto, 1200, 0.92) : Promise.resolve(null),
        optimizeDataUrl(scene.image, 1800, 0.84),
        optimizeDataUrl(characterImage, 1400, 0.9),
      ]);
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorImage, faceImage, poetImage, backgroundImage, person: person.name, quote: person.quote, pose: pose.prompt }) });
      const data = await response.json();
      if (!response.ok || !data.image) throw new Error(data.error || 'API 生成失败');
      const labeledImage = await addResultLabel(data.image, { person: person.name, quote: person.quote, academy: scene.academy });
      setResult(labeledImage);
      setFailureCount(0);
      setStatus('Gemini 生成完成，可以下载或重新选择人物。');
    } catch (error) {
      console.error('[client-generate]', error);
      const nextFailureCount = failureCount + 1;
      setFailureCount(nextFailureCount);
      setStatus('');
      setErrorModal(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><span className="brand-mark">游</span><div><strong>与先贤同游</strong><span>书院数字合影体验</span></div></div>
      <div className="topbar-meta"><span className="status-dot" /> 本地试拍版 <span className="divider" /> <span>不保存原始照片</span></div>
    </header>

    <main className="workspace">
      <section className="process-example" aria-labelledby="process-title">
        <div className="process-heading"><div><p className="eyebrow">SHUYUAN ENCOUNTER</p><h1 id="process-title">一张书院合影如何生成</h1></div><div className="intro-note"><Info size={16} /><span>示例流程<br />照片仅用于本次生成</span></div></div>
        <div className="process-flow-scroll">
          <div className="process-flow">
            <article className="process-step"><div className="process-image contain"><img src="/assets/process-example/visitor.jpg" alt="游客全身照片示例" /><span>01</span></div><strong>游客照片</strong><small>一张清晰全身照</small></article>
            <div className="process-arrow"><span>选择先贤</span><ChevronRight size={20} /></div>
            <article className="process-step"><div className="process-image contain"><img src="/assets/process-example/poet.jpg" alt="朱熹写实三维人物示例" /><span>02</span></div><strong>诗人形象</strong><small>二维立绘或写实 3D</small></article>
            <div className="process-arrow"><span>选择场景</span><ChevronRight size={20} /></div>
            <article className="process-step"><div className="process-image cover"><img src="/assets/process-example/academy.jpg" alt="白鹿洞书院背景示例" /><span>03</span></div><strong>书院背景</strong><small>固定实拍打卡场景</small></article>
            <div className="process-arrow"><span>Gemini 融合</span><ChevronRight size={20} /></div>
            <article className="process-step result"><div className="process-image contain"><img src="/assets/process-example/result.jpg" alt="游客与朱熹最终合照示例" /><span>04</span></div><strong>打卡合照</strong><small>生成并添加书院标签</small></article>
          </div>
        </div>
      </section>

      <div className="studio-grid">
        <section className="preview-panel panel">
          <div className="panel-heading"><div><span className="step-index">01</span><h2>准备游客照片</h2></div><span className="quiet-label">{photo ? '已准备' : '等待照片'}</span></div>
          <div className={`photo-stage ${photo ? 'has-photo' : ''}`}>
            {!photo ? <div className="empty-stage"><div className="camera-glyph"><Camera size={26} strokeWidth={1.6} /></div><strong>站在光线自然的位置</strong><span>建议半身正面、单人入镜，面部清晰</span><div className="capture-actions"><button className="primary-button" onClick={openCamera}><Camera size={17} /> 打开摄像头</button><button className="secondary-button" onClick={() => uploadFileRef.current?.click()}><Upload size={17} /> 上传照片</button></div><input ref={uploadFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden /></div> : <><img src={photo} alt="待生成的游客照片" /><div className="photo-badge"><Check size={14} /> {source === 'camera' ? '摄像头采集' : '已上传照片'}</div><button className="remove-photo" onClick={clearPhoto} aria-label="移除照片"><X size={17} /></button></>}
          </div>
          {cameraOpen && <div className="camera-modal"><div className="camera-dialog"><div className="camera-dialog-head"><strong>调整取景</strong><button onClick={() => { setCameraOpen(false); stopCamera(); }} aria-label="关闭"><X size={18} /></button></div><div className="video-wrap"><video ref={videoRef} autoPlay playsInline muted /><div className="face-guide" /></div><button className="primary-button wide" onClick={capturePhoto}><Camera size={18} /> 拍下这一刻</button></div></div>}
          {photo && <div className="photo-actions"><button className="secondary-button" onClick={() => replaceFileRef.current?.click()}><ImagePlus size={17} /> 换一张</button><input ref={replaceFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden /></div>}
          <div className={`face-photo-card ${facePhoto ? 'has-face-photo' : ''}`}>
            <div className="face-photo-heading"><div><span className="step-index">01A</span><strong>补充一张面部近照</strong></div><span className="quiet-label">可选 · 用于增强五官还原</span></div>
            {facePhoto ? <div className="face-photo-preview"><img src={facePhoto} alt="游客面部参考照片" /><span className="photo-badge"><Check size={14} /> 面部精修已准备</span><button className="remove-photo" onClick={clearFacePhoto} aria-label="移除面部照片"><X size={17} /></button></div> : <button className="face-upload-button" onClick={() => faceFileRef.current?.click()}><ImagePlus size={18} /><span><strong>上传清晰面部照片</strong><small>可选；尽量与全身照保持相近朝向和光线，融合更自然</small></span><Upload size={16} /></button>}
            <input ref={faceFileRef} type="file" accept="image/*" onChange={(event) => handleFile(event, 'face')} hidden />
          </div>
        </section>

        <section className="settings-panel panel">
          <div className="panel-heading"><div><span className="step-index">02</span><h2>选择你的同行者</h2></div><span className="quiet-label">{person.era}</span></div>
          <div className="character-style-switch" aria-label="选择人物表现形式"><span>人物形象</span><button className={characterStyle === '2d' ? 'active' : ''} onClick={() => { setCharacterStyle('2d'); setResult(null); }}>二维立绘</button><button className={characterStyle === '3d' ? 'active' : ''} onClick={() => { setCharacterStyle('3d'); setResult(null); }}>写实 3D</button></div>
          <div className="people-list">{people.map((item) => <button key={item.id} className={`person-card ${item.id === personId ? 'selected' : ''}`} onClick={() => { setPersonId(item.id); setResult(null); }}><div className={`person-avatar ${characterStyle === '3d' ? 'avatar-3d' : ''}`}><img src={characterStyle === '3d' ? item.image3d : item.image} alt={item.name} /></div><div className="person-copy"><strong>{item.name}</strong><span>{item.intro}</span><small>{item.quote}</small></div>{item.id === personId && <span className="selected-check"><Check size={15} /></span>}</button>)}</div>
          <div className="subsection-heading"><span>选择书院场景</span><span className="quiet-label">可替换为实拍背景</span></div>
          <div className="scene-grid">{scenes.map((item) => <button key={item.id} className={`scene-card ${item.id === sceneId ? 'selected' : ''}`} onClick={() => { setSceneId(item.id); setResult(null); }}><img src={item.image} alt={item.name} /><span className="scene-overlay"><strong>{item.name}</strong><small>{item.note}</small></span>{item.id === sceneId && <span className="scene-check"><Check size={14} /></span>}</button>)}</div>
          <div className="subsection-heading"><span>选择互动姿势</span><span className="quiet-label">固定动作更稳定</span></div>
          <div className="pose-grid">{poses.map((item) => <button key={item.id} className={`pose-option ${item.id === poseId ? 'selected' : ''}`} onClick={() => { setPoseId(item.id); setResult(null); }}>{item.name}{item.id === poseId && <Check size={13} />}</button>)}</div>
          <div className="mode-row"><div><span>生成服务</span><small>{apiConfigured ? 'NanoApple Gemini · 三图参考融合' : 'Gemini 服务未配置'}</small></div><span className={`service-state ${apiConfigured ? 'ready' : ''}`}>{apiConfigured ? '已连接' : '待连接'}</span></div>
          <button className="generate-button" disabled={!photo || busy} onClick={generate}>{busy ? <><LoaderCircle className="spin" size={19} /> 正在生成</> : <><Sparkles size={19} /> 生成我的合影 <ChevronRight size={17} /></>}</button>
          {!photo && <p className="photo-requirement">请先上传或拍摄一张全身照，才能开始生图。</p>}
          {status && <p className="status-message">{status}</p>}
        </section>
      </div>

      <section className="result-panel panel"><div className="panel-heading"><div><span className="step-index">03</span><h2>领取你的书院合影</h2></div><span className="quiet-label">{result ? '可以下载' : '生成后显示'}</span></div><div className={`result-stage ${result ? 'has-result' : ''}`}>{result ? <><img src={result} alt="生成完成的书院合影" /><div className="result-actions"><a className="primary-button" href={result} download={`与${person.name}同游.jpg`}><Download size={17} /> 下载合影</a><button className="secondary-button" onClick={() => { setResult(null); setStatus(''); }}><RotateCcw size={17} /> 重新生成</button></div></> : <div className="result-empty"><Sparkles size={24} strokeWidth={1.5} /><span>你的合影会在这里出现</span><small>建议先完成上方的照片采集与人物选择</small></div>}</div></section>
    </main>
    {errorModal && <div className="error-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title"><div className="error-dialog"><div className="error-icon"><CircleAlert size={24} /></div><div><h2 id="error-title">暂时无法生成</h2><p>{failureCount >= 3 ? '生图连续异常，请联系工作人员。' : '生图网络异常，请重试。'}</p></div><button className="error-close" onClick={() => setErrorModal(false)} aria-label="关闭提示"><X size={18} /></button><div className="error-actions"><button className="secondary-button" onClick={() => setErrorModal(false)}>知道了</button>{failureCount < 3 && <button className="primary-button" onClick={() => { setErrorModal(false); generate(); }}>重试</button>}</div></div></div>}
    <footer className="footer"><span>试拍原型 · 先贤形象支持二维立绘与写实 3D</span><span>后续可接入：真实书院背景 / 审核人物资产 / 二维码领取</span></footer>
  </div>;
}

function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
async function toDataUrl(src) { if (src.startsWith('data:')) return src; const response = await fetch(src); const blob = await response.blob(); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }); }
async function optimizeDataUrl(src, maxDimension, quality) {
  const dataUrl = src.startsWith('data:') ? src : await toDataUrl(src);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
function drawCover(ctx, image, x, y, width, height) { const scale = Math.max(width / image.width, height / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h); }
function drawContain(ctx, image, x, y, width, height) { const scale = Math.min(width / image.width, height / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h); }
function roundedRect(ctx, x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); }
function wrapText(ctx, text, x, y, maxWidth, lineHeight) { let line = ''; let lineY = y; for (const char of text) { const test = line + char; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, lineY); line = char; lineY += lineHeight; } else line = test; } if (line) ctx.fillText(line, x, lineY); }
async function addResultLabel(src, { person, quote, academy }) {
  const image = await loadImage(src.startsWith('data:') ? src : await toDataUrl(src));
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const bandHeight = Math.max(170, Math.round(canvas.height * 0.16));
  const gradient = ctx.createLinearGradient(0, canvas.height - bandHeight, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(28, 24, 19, 0.05)');
  gradient.addColorStop(0.28, 'rgba(28, 24, 19, 0.72)');
  gradient.addColorStop(1, 'rgba(28, 24, 19, 0.92)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
  const pad = Math.round(canvas.width * 0.055);
  const titleSize = Math.max(26, Math.round(canvas.width * 0.033));
  const quoteSize = Math.max(20, Math.round(canvas.width * 0.023));
  const footerSize = Math.max(16, Math.round(canvas.width * 0.017));
  ctx.fillStyle = '#fff8ea';
  ctx.font = `600 ${titleSize}px "Noto Serif SC", serif`;
  ctx.fillText(`诗人：${person}`, pad, canvas.height - bandHeight + Math.round(bandHeight * 0.36));
  ctx.fillStyle = 'rgba(255, 248, 234, .92)';
  ctx.font = `400 ${quoteSize}px "Noto Serif SC", serif`;
  const quoteText = `代表诗句：「${quote}」`;
  const quoteLine = quoteText.length > 34 ? `${quoteText.slice(0, 34)}…` : quoteText;
  ctx.fillText(quoteLine, pad, canvas.height - bandHeight + Math.round(bandHeight * 0.64));
  ctx.fillStyle = 'rgba(255, 224, 176, .84)';
  ctx.font = `500 ${footerSize}px Manrope, sans-serif`;
  ctx.fillText(`${academy}数字体验`, pad, canvas.height - Math.round(bandHeight * 0.14));
  return canvas.toDataURL('image/jpeg', 0.95);
}

createRoot(document.getElementById('root')).render(<App />);
