const video = document.getElementById('video');
const cameraSelect = document.getElementById('cameraSelect');
const cameraBtn = document.getElementById('cameraBtn');
const lastResult = document.getElementById('lastResult');

let stream = null;
let scanning = false;
let detector = null;
let scanInterval = null;
let track = null;
let lastScanned = null;

/* ---------- URL detection helper ---------- */
function looksLikeURL(text) {
  try {
    const u = new URL(text);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return (
      /^https?:\/\//i.test(text) ||
      /^www\./i.test(text) ||
      /^[\w.-]+\.[a-z]{2,}/i.test(text)
    );
  }
}

/* ---------- Camera List ---------- */
async function listCameras() {
  cameraSelect.innerHTML = '';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    cams.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || `Camera ${i + 1}`;
      cameraSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error listing cameras:', err);
  }
}

/* ---------- Start scanning ---------- */
async function startScan() {
  if (scanning) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
        facingMode: 'environment'
      },
      audio: false
    });

    video.srcObject = stream;
    track = stream.getVideoTracks()[0];
    scanning = true;

    if ('BarcodeDetector' in window) {
      const formats = await BarcodeDetector.getSupportedFormats();
      detector = new BarcodeDetector({ formats });
    }

    scanLoop();
  } catch (err) {
    console.error('Error starting camera:', err);
    alert('Unable to access camera. Please allow permissions.');
  }
}

/* ---------- Stop scanning ---------- */
function stopScan() {
  scanning = false;

  if (scanInterval) clearTimeout(scanInterval);
  if (stream) stream.getTracks().forEach(t => t.stop());

  video.srcObject = null;
}

/* ---------- Scan Loop ---------- */
async function scanLoop() {
  if (!scanning) return;

  if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    scanInterval = setTimeout(scanLoop, 200);
    return;
  }

  const w = video.videoWidth;
  const h = video.videoHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  try {
    if (detector) {
      const barcodes = await detector.detect(canvas);
      if (barcodes.length) handleResult(barcodes[0].rawValue);
    } else if (window.jsQR) {
      const code = jsQR(imageData.data, w, h);
      if (code) handleResult(code.data);
    }
  } catch (e) {
    console.error('Detection error:', e);
  }

  scanInterval = setTimeout(scanLoop, 200);
}

/* ---------- Handle QR Result ---------- */
function handleResult(text) {
  if (!text || text === lastScanned) return;

  lastScanned = text;
  lastResult.textContent = text;

  // Redirect if it's a URL
  if (looksLikeURL(text)) {
    let url = text.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setTimeout(() => {
      window.location.href = url;
    }, 500);
  }
}

/* ---------- Event Listeners ---------- */
cameraBtn.addEventListener('click', () => {
  if (scanning) {
    stopScan();
    cameraBtn.classList.remove('active');
  } else {
    startScan();
    cameraBtn.classList.add('active');
  }
});

window.addEventListener('DOMContentLoaded', listCameras);
window.addEventListener('pagehide', stopScan);
