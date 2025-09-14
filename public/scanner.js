const video = document.getElementById('video');
const cameraSelect = document.getElementById('cameraSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const flashBtn = document.getElementById('flashBtn');
const lastResult = document.getElementById('lastResult');
const autoRedirectCheckbox = document.getElementById('autoRedirect');

let stream = null;
let scanning = false;
let detector = null;
let scanInterval = null;
let track = null;

function looksLikeURL(text){
  try {
    // Try to parse with the URL API
    const u = new URL(text);
    // If parsing succeeds, check if scheme is http or https
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch(e) {
    // If parsing fails, fall back to regex checks
    return /^https?:\/\//i.test(text) || /^www\./i.test(text);
  }
}


async function listCameras(){
  cameraSelect.innerHTML = '';
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === 'videoinput');
  cams.forEach((c,i)=>{
    const opt = document.createElement('option');
    opt.value = c.deviceId;
    opt.textContent = c.label || `Camera ${i+1}`;
    cameraSelect.appendChild(opt);
  });
}

async function startScan(){
  if(scanning) return;
  stream = await navigator.mediaDevices.getUserMedia({
    video: {deviceId: cameraSelect.value?{exact:cameraSelect.value}:undefined,facingMode:'environment'},
    audio:false
  });
  video.srcObject = stream;
  track = stream.getVideoTracks()[0];
  scanning = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  flashBtn.disabled = false;

  if('BarcodeDetector' in window){
    const formats = await BarcodeDetector.getSupportedFormats();
    detector = new BarcodeDetector({formats: formats});
  }
  scanLoop();
}

function stopScan(){
  scanning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  flashBtn.disabled = true;
  if(scanInterval) clearTimeout(scanInterval);
  if(stream){ stream.getTracks().forEach(t=>t.stop()); }
  video.srcObject = null;
}

async function toggleTorch(){
  if(!track) return;
  const capabilities = track.getCapabilities();
  if(capabilities.torch){
    const settings = track.getSettings();
    const current = settings.torch || false;
    await track.applyConstraints({advanced:[{torch:!current}]});
  }
}

async function scanLoop(){
  if(!scanning) return;
  if(video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA){
    scanInterval = setTimeout(scanLoop,200); return;
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(video,0,0,w,h);
  const imageData=ctx.getImageData(0,0,w,h);

  try{
    if(detector){
      const barcodes = await detector.detect(canvas);
      if(barcodes.length){ handleResult(barcodes[0].rawValue); }
    }else if(window.jsQR){
      const code=jsQR(imageData.data,w,h);
      if(code) handleResult(code.data);
    }
  }catch(e){console.error(e);}
  scanInterval = setTimeout(scanLoop,200);
}

let lastScanned = null;

function handleResult(text) {
  // 1. Ignore empty results or duplicates
  if (!text || text === lastScanned) return;

  // 2. Save the new result
  lastScanned = text;

  // 3. Show it in the UI
  lastResult.textContent = text;

  // 4. If auto-redirect enabled and result looks like a URL, redirect
  if (autoRedirectCheckbox.checked && looksLikeURL(text)) {
    let url = text;

    // prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // redirect after 400ms
    setTimeout(() => {
      window.location.href = url;
    }, 400);
  }
}


startBtn.addEventListener('click',startScan);
stopBtn.addEventListener('click',stopScan);
flashBtn.addEventListener('click',toggleTorch);

window.addEventListener('DOMContentLoaded',listCameras);
window.addEventListener('pagehide',stopScan);
