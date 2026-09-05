'use strict';
const TAU = Math.PI * 2;

/* ---------- seeded randomness ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const newSeed = () => (Math.random() * 0xffffffff) >>> 0;
const pick = (rand, arr) => arr[(rand() * arr.length) | 0];
const range = (rand, a, b) => a + rand() * (b - a);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* ---------- value noise + fbm ---------- */
function makeNoise(rand) {
  const S = 256, v = new Float32Array(S * S);
  for (let i = 0; i < v.length; i++) v[i] = rand();
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const xi = x | 0, yi = y | 0, xf = x - xi, yf = y - yi;
    const x1 = (xi + 1) % S, y1 = (yi + 1) % S;
    const a = v[yi * S + xi], b = v[yi * S + x1];
    const c = v[y1 * S + xi], d = v[y1 * S + x1];
    const u = sm(xf), w = sm(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
function makeFbm(noise) {
  return (x, y) => {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < 4; o++) { sum += amp * noise(x * freq, y * freq); freq *= 2; amp *= 0.5; }
    return sum / 0.9375;
  };
}

/* ---------- color: hex, alpha, OKLab gradients ---------- */
const PALETTES = [
  { bg: '#0f0e17', ink: ['#ff8906', '#f25f4c', '#e53170', '#fffffe', '#7f5af0'] },
  { bg: '#fffcf2', ink: ['#403d39', '#eb5e28', '#ccc5b9', '#252422'] },
  { bg: '#10002b', ink: ['#e0aaff', '#c77dff', '#9d4edd', '#7b2cbf', '#5a189a'] },
  { bg: '#001219', ink: ['#94d2bd', '#e9d8a6', '#ee9b00', '#ca6702', '#ae2012', '#0a9396'] },
  { bg: '#fdf0d5', ink: ['#003049', '#d62828', '#f77f00', '#669bbc'] },
  { bg: '#0d1b2a', ink: ['#e0e1dd', '#778da9', '#415a77', '#fca311'] },
  { bg: '#f4f1de', ink: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'] },
  { bg: '#1a1a2e', ink: ['#e94560', '#0f3460', '#53bf9d', '#f1f1f1'] },
  { bg: '#fefae0', ink: ['#606c38', '#283618', '#dda15e', '#bc6c25'] },
  { bg: '#2b2d42', ink: ['#8d99ae', '#edf2f4', '#ef233c', '#d90429'] },
  { bg: '#03071e', ink: ['#ffba08', '#f48c06', '#e85d04', '#dc2f02', '#d00000', '#9d0208'] },
  { bg: '#f8f9fa', ink: ['#212529', '#0077b6', '#e63946', '#ffb703'] },
];
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const withAlpha = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lum = hex => { const [r, g, b] = hexRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

const srgb2lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lin2srgb = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function rgb2oklab([r, g, b]) {
  r = srgb2lin(r); g = srgb2lin(g); b = srgb2lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
function oklab2rgb([L, A, B]) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
  const px = v => Math.max(0, Math.min(255, lin2srgb(v)));
  return [
    px(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    px(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    px(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}
function makeGradient(hexes) {
  const labs = hexes.map(h => rgb2oklab(hexRgb(h)));
  return t => {
    t = clamp01(t);
    const x = t * (labs.length - 1), i = Math.min(labs.length - 2, x | 0), f = x - i;
    const A = labs[i], B = labs[i + 1];
    return oklab2rgb([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f]);
  };
}
function gradientLUT(hexes) {
  const grad = makeGradient(hexes);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = grad(i / 255);
    lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
  }
  return lut;
}
const mixHex = (h1, h2, t) => {
  const [r, g, b] = makeGradient([h1, h2])(t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};
const inksByLum = palette => [...palette.ink].sort((a, b) => lum(a) - lum(b));
// sorted by how strongly each ink stands out against the background, weakest first
const inksByContrast = palette => {
  const bl = lum(palette.bg);
  return [...palette.ink].sort((a, b) => Math.abs(lum(a) - bl) - Math.abs(lum(b) - bl));
};
const darkBg = palette => lum(palette.bg) < 128;

/* ---------- film grain (static pieces only) ---------- */
function grain(ctx, W, H, rand) {
  const s = 140;
  const oc = document.createElement('canvas');
  oc.width = oc.height = s;
  const octx = oc.getContext('2d');
  const img = octx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() * 255 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(oc, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------- low-res simulation surface ----------
   Sims run on a coarse grid and get upscaled; this bundles the grid,
   its ImageData, and a LUT-colored blit into the full-size work canvas. */
function makeSurface(g, targetCells) {
  const cell = Math.max(2, Math.round(Math.min(g.W, g.H) / targetCells));
  const gw = Math.max(64, Math.round(g.W / cell));
  const gh = Math.max(64, Math.round(g.H / cell));
  const oc = document.createElement('canvas');
  oc.width = gw; oc.height = gh;
  const octx = oc.getContext('2d');
  const img = octx.createImageData(gw, gh);
  img.data.fill(255);
  return {
    gw, gh,
    blit(values, lut, { scale = 1, offset = 0, gamma = 1 } = {}) {
      const d = img.data;
      for (let i = 0, n = gw * gh; i < n; i++) {
        let t = (values[i] - offset) * scale;
        t = t <= 0 ? 0 : t >= 1 ? 1 : gamma === 1 ? t : Math.pow(t, gamma);
        const j = (t * 255 | 0) * 3;
        const o = i * 4;
        d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2];
      }
      octx.putImageData(img, 0, 0);
      g.wctx.imageSmoothingEnabled = true;
      g.wctx.drawImage(oc, 0, 0, g.W, g.H);
    },
  };
}

/* ---------- WebGL shader engine (one shared context) ---------- */
let glCanvas = null, gl = null, glTried = false;
const glPrograms = new Map();
function getGL() {
  if (!glTried) {
    glTried = true;
    glCanvas = document.createElement('canvas');
    gl = glCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  }
  return gl;
}
function getProgram(name, fragSrc) {
  if (glPrograms.has(name)) return glPrograms.get(name);
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(fs));
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const entry = { prog, buf };
  glPrograms.set(name, entry);
  return entry;
}

/* ================= art systems ================= */

function flowField(g) {
  const { ctx, W, H, rand, fbm, palette } = g;
  const scale = range(rand, 0.0012, 0.003);
  const twist = range(rand, 1.5, 3.5);
  const count = Math.round(W * H / 900);
  const steps = 40 + (rand() * 50 | 0);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = rand() * W, y = rand() * H;
    ctx.strokeStyle = withAlpha(pick(rand, palette.ink), range(rand, 0.25, 0.7));
    ctx.lineWidth = rand() < 0.9 ? range(rand, 0.6, 1.8) : range(rand, 2, 5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const stepLen = range(rand, 1.5, 3);
    for (let s = 0; s < steps; s++) {
      const a = fbm(x * scale, y * scale) * TAU * twist;
      x += Math.cos(a) * stepLen; y += Math.sin(a) * stepLen;
      ctx.lineTo(x, y);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) break;
    }
    ctx.stroke();
  }
}

function circlePack(g) {
  const { ctx, W, H, rand, palette } = g;
  const placed = [];
  const maxR = Math.min(W, H) * range(rand, 0.12, 0.2);
  let attempts = 5000;
  while (attempts-- > 0 && placed.length < 500) {
    const x = rand() * W, y = rand() * H;
    let r = maxR;
    for (const c of placed) {
      const d = Math.hypot(x - c.x, y - c.y) - c.r - 3;
      if (d < r) r = d;
    }
    if (r < 4) continue;
    r *= range(rand, 0.82, 1);
    placed.push({ x, y, r });
    const col = pick(rand, palette.ink);
    const style = rand();
    ctx.beginPath();
    if (style < 0.55) {
      ctx.fillStyle = col;
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else if (style < 0.8) {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.arc(x, y, r * 0.92, 0, TAU);
      ctx.stroke();
    } else {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (let rr = r * 0.9; rr > 2; rr -= Math.max(3, r * 0.18)) {
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.stroke();
      }
    }
  }
}

function ridgelines(g) {
  const { ctx, W, H, rand, fbm, palette } = g;
  const rows = 24 + (rand() * 30 | 0);
  const amp = H / rows * range(rand, 2.5, 6);
  const ns = range(rand, 0.0015, 0.004);
  let prev = -1;
  for (let r = 0; r < rows; r++) {
    let ci = (rand() * palette.ink.length) | 0;
    if (ci === prev) ci = (ci + 1) % palette.ink.length;
    prev = ci;
    const baseY = (r + 0.5) / rows * H * 1.12 - H * 0.02;
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 4) {
      ctx.lineTo(x, baseY - fbm(x * ns, r * 0.35) * amp);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fillStyle = palette.ink[ci];
    ctx.fill();
    ctx.strokeStyle = palette.bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function watercolor(g) {
  const { ctx, W, H, rand, fbm, palette } = g;
  const clusters = 3 + (rand() * 4 | 0);
  for (let c = 0; c < clusters; c++) {
    const cx = range(rand, W * 0.15, W * 0.85);
    const cy = range(rand, H * 0.15, H * 0.85);
    const baseR = Math.min(W, H) * range(rand, 0.15, 0.35);
    const col = pick(rand, palette.ink);
    const layers = 18 + (rand() * 14 | 0);
    const phase = rand() * 100;
    for (let l = 0; l < layers; l++) {
      ctx.fillStyle = withAlpha(col, 0.03 + rand() * 0.05);
      ctx.beginPath();
      const pts = 28;
      for (let i = 0; i <= pts; i++) {
        const a = i / pts * TAU;
        const wob = fbm(Math.cos(a) * 1.4 + phase, Math.sin(a) * 1.4 + l * 0.13);
        const rr = baseR * (0.5 + wob * 0.8);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

function mosaic(g) {
  const { ctx, W, H, rand, palette } = g;
  const gap = rand() < 0.5 ? 0 : range(rand, 3, 9);
  const rects = [];
  const minS = Math.min(W, H) * 0.05;
  (function split(x, y, w, h, depth) {
    if (depth > 6 || (w < minS * 2 && h < minS * 2) || (depth > 2 && rand() < 0.28)) {
      rects.push([x, y, w, h]);
      return;
    }
    const t = range(rand, 0.33, 0.67);
    if (w > h) {
      split(x, y, w * t, h, depth + 1);
      split(x + w * t, y, w * (1 - t), h, depth + 1);
    } else {
      split(x, y, w, h * t, depth + 1);
      split(x, y + h * t, w, h * (1 - t), depth + 1);
    }
  })(0, 0, W, H, 0);
  for (const [x, y, w, h] of rects) {
    ctx.fillStyle = rand() < 0.12 ? palette.bg : pick(rand, palette.ink);
    ctx.fillRect(x + gap / 2, y + gap / 2, w - gap, h - gap);
    if (rand() < 0.18) {
      ctx.fillStyle = pick(rand, palette.ink);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.28, 0, TAU);
      ctx.fill();
    }
  }
}

function halos(g) {
  const { wctx: ctx, W, H, rand, palette } = g;
  const cx = W * range(rand, 0.3, 0.7), cy = H * range(rand, 0.3, 0.7);
  const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
  const cap = rand() < 0.5 ? 'round' : 'butt';
  const arcs = [];
  let r = range(rand, 10, 40), ring = 0;
  while (r < maxR) {
    const lw = range(rand, 2, 14);
    const segs = 1 + (rand() * 4 | 0);
    const spin = range(rand, 0.02, 0.08) * (ring % 2 ? 1 : -1);
    for (let s = 0; s < segs; s++) {
      const a0 = rand() * TAU;
      arcs.push({
        r, lw, a0, a1: a0 + range(rand, 0.3, 2.5), spin,
        col: withAlpha(pick(rand, palette.ink), range(rand, 0.5, 1)),
      });
    }
    r += lw + range(rand, 4, 26);
    ring++;
  }
  return {
    animated: true,
    frame(t) {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = cap;
      for (const a of arcs) {
        const off = t * a.spin;
        ctx.strokeStyle = a.col;
        ctx.lineWidth = a.lw;
        ctx.beginPath();
        ctx.arc(cx, cy, a.r, a.a0 + off, a.a1 + off);
        ctx.stroke();
      }
    },
  };
}

/* --- physarum: slime-mold agents building living vein networks --- */
function physarum(g) {
  const { rand, palette } = g;
  const surf = makeSurface(g, 300);
  const { gw, gh } = surf;
  const trail = new Float32Array(gw * gh);
  const tmp = new Float32Array(gw * gh);
  const N = Math.min(24000, (gw * gh / 7) | 0);
  const ax = new Float32Array(N), ay = new Float32Array(N), ah = new Float32Array(N);
  const srand = mulberry32((rand() * 0xffffffff) >>> 0);
  const layout = rand();
  for (let i = 0; i < N; i++) {
    if (layout < 0.4) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * Math.min(gw, gh) * 0.25;
      ax[i] = gw / 2 + Math.cos(a) * d; ay[i] = gh / 2 + Math.sin(a) * d;
    } else {
      ax[i] = rand() * gw; ay[i] = rand() * gh;
    }
    ah[i] = rand() * TAU;
  }
  const SA = range(rand, 0.3, 0.8);
  const SD = range(rand, 5, 14);
  const TURN = range(rand, 0.25, 0.55);
  const SPEED = range(rand, 1, 1.8);
  const DECAY = range(rand, 0.93, 0.97);
  const inks = inksByContrast(palette);
  const lut = gradientLUT([palette.bg, inks[Math.max(0, inks.length - 2)], inks[inks.length - 1]]);
  const sense = (x, y, a) => {
    const sx = ((((x + Math.cos(a) * SD) | 0) % gw) + gw) % gw;
    const sy = ((((y + Math.sin(a) * SD) | 0) % gh) + gh) % gh;
    return trail[sy * gw + sx];
  };
  return {
    animated: true,
    frame() {
      for (let step = 0; step < 2; step++) {
        for (let i = 0; i < N; i++) {
          const h = ah[i], x = ax[i], y = ay[i];
          const F = sense(x, y, h), L = sense(x, y, h + SA), R = sense(x, y, h - SA);
          if (F >= L && F >= R) { /* straight ahead */ }
          else if (F < L && F < R) ah[i] += (srand() < 0.5 ? 1 : -1) * TURN;
          else if (L > R) ah[i] += TURN;
          else ah[i] -= TURN;
          ah[i] += (srand() - 0.5) * 0.05;
          let nx = x + Math.cos(ah[i]) * SPEED, ny = y + Math.sin(ah[i]) * SPEED;
          nx = ((nx % gw) + gw) % gw; ny = ((ny % gh) + gh) % gh;
          ax[i] = nx; ay[i] = ny;
          trail[(ny | 0) * gw + (nx | 0)] += 1;
        }
      }
      for (let y = 0; y < gh; y++) {
        const ym = ((y - 1 + gh) % gh) * gw, yp = ((y + 1) % gh) * gw, y0 = y * gw;
        for (let x = 0; x < gw; x++) {
          const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw;
          tmp[y0 + x] = (trail[y0 + x] + trail[y0 + xm] + trail[y0 + xp] + trail[ym + x] + trail[yp + x]) * 0.2 * DECAY;
        }
      }
      trail.set(tmp);
      /* auto-exposure: subtract the ambient haze, expose for the lanes
         (well below the junction hotspots), lift midtones */
      let max = 0, sum = 0;
      for (let i = 0; i < trail.length; i++) { const v = trail[i]; if (v > max) max = v; sum += v; }
      const mean = sum / trail.length;
      const floor = mean * 0.8;
      surf.blit(trail, lut, { offset: floor, scale: 1 / Math.max(0.3, max * 0.22 - floor), gamma: 0.4 });
    },
  };
}

/* --- reaction-diffusion: Gray-Scott chemistry --- */
function reactionDiffusion(g) {
  const { rand, palette } = g;
  const surf = makeSurface(g, 220);
  const { gw, gh } = surf;
  const n = gw * gh;
  const A = new Float32Array(n).fill(1), B = new Float32Array(n);
  const A2 = new Float32Array(n), B2 = new Float32Array(n);
  const V = new Float32Array(n);
  // known-lovely (feed, kill) pairs: mitosis, coral, maze, worms, solitons
  const [f, k] = pick(rand, [
    [0.0367, 0.0649], [0.0545, 0.062], [0.029, 0.057],
    [0.078, 0.061], [0.026, 0.051], [0.022, 0.051],
  ]);
  const spots = 6 + (rand() * 24 | 0);
  for (let s = 0; s < spots; s++) {
    const cx = rand() * gw | 0, cy = rand() * gh | 0, r = 2 + rand() * 5;
    for (let y = -r | 0; y <= r; y++) for (let x = -r | 0; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const px = ((cx + x) + gw) % gw, py = ((cy + y) + gh) % gh;
      B[py * gw + px] = 1;
    }
  }
  const inks = inksByContrast(palette);
  const mid = inks[(inks.length / 2) | 0];
  const lut = gradientLUT([palette.bg, mid, inks[inks.length - 1]]);
  const dA = 1.0, dB = 0.5;
  return {
    animated: true,
    frame() {
      for (let step = 0; step < 10; step++) {
        for (let y = 0; y < gh; y++) {
          const ym = ((y - 1 + gh) % gh) * gw, yp = ((y + 1) % gh) * gw, y0 = y * gw;
          for (let x = 0; x < gw; x++) {
            const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw, i = y0 + x;
            const a = A[i], b = B[i];
            const lapA = A[y0 + xm] + A[y0 + xp] + A[ym + x] + A[yp + x] - 4 * a;
            const lapB = B[y0 + xm] + B[y0 + xp] + B[ym + x] + B[yp + x] - 4 * b;
            const abb = a * b * b;
            let na = a + dA * lapA * 0.2 - abb + f * (1 - a);
            let nb = b + dB * lapB * 0.2 + abb - (k + f) * b;
            // clamp to [0,1]: unclamped values can blow up to NaN
            A2[i] = na < 0 ? 0 : na > 1 ? 1 : na;
            B2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb;
          }
        }
        A.set(A2); B.set(B2);
      }
      for (let i = 0; i < n; i++) V[i] = B[i] * 3.5;
      surf.blit(V, lut);
    },
  };
}

/* --- strange attractor: De Jong, accumulating and slowly morphing --- */
function attractor(g) {
  const { rand, palette, W, H } = g;
  const gw = Math.ceil(W / 2), gh = Math.ceil(H / 2);
  const dens = new Float32Array(gw * gh);
  const tone = new Uint16Array(1024);
  const oc = document.createElement('canvas');
  oc.width = gw; oc.height = gh;
  const octx = oc.getContext('2d');
  const img = octx.createImageData(gw, gh);
  img.data.fill(255);
  const sgn = () => (rand() < 0.5 ? -1 : 1);
  /* vet parameters: De Jong maps can collapse to a fixed point or thin
     cycle, so test-iterate and re-roll until the orbit fills real area */
  let A0, B0, C0, D0;
  for (let tries = 0; tries < 30; tries++) {
    A0 = sgn() * range(rand, 1.4, 2.8); B0 = sgn() * range(rand, 1.4, 2.8);
    C0 = sgn() * range(rand, 1.4, 2.8); D0 = sgn() * range(rand, 1.4, 2.8);
    const seen = new Uint8Array(64 * 64);
    let tx = 0.1, ty = 0.1, unique = 0;
    for (let i = 0; i < 4000; i++) {
      const nx = Math.sin(A0 * ty) - Math.cos(B0 * tx);
      const ny = Math.sin(C0 * tx) - Math.cos(D0 * ty);
      tx = nx; ty = ny;
      const ci = (((ty + 2.1) * 15.2) | 0) * 64 + (((tx + 2.1) * 15.2) | 0);
      if (!seen[ci]) { seen[ci] = 1; unique++; }
    }
    if (unique > 600) break;
  }
  const p1 = rand() * TAU, p2 = rand() * TAU, p3 = rand() * TAU, p4 = rand() * TAU;
  const inks = inksByContrast(palette);
  const lut = gradientLUT([palette.bg, inks[(inks.length / 2) | 0], inks[inks.length - 1], inks[inks.length - 1]]);
  const s = Math.min(gw, gh) / 4.4;
  const ox = gw / 2, oy = gh / 2;
  let x = 0.1, y = 0.1;
  return {
    animated: true,
    frame(t) {
      const pa = A0 + 0.12 * Math.sin(t * 0.06 + p1);
      const pb = B0 + 0.12 * Math.sin(t * 0.043 + p2);
      const pc = C0 + 0.12 * Math.sin(t * 0.051 + p3);
      const pd = D0 + 0.12 * Math.sin(t * 0.037 + p4);
      let dmax = 0;
      for (let i = 0; i < dens.length; i++) { dens[i] *= 0.996; if (dens[i] > dmax) dmax = dens[i]; }
      for (let i = 0; i < 50000; i++) {
        const nx = Math.sin(pa * y) - Math.cos(pb * x);
        const ny = Math.sin(pc * x) - Math.cos(pd * y);
        x = nx; y = ny;
        const px = (ox + x * s) | 0, py = (oy + y * s) | 0;
        if (px >= 0 && px < gw && py >= 0 && py < gh) dens[py * gw + px] += 1;
      }
      const d = img.data;
      /* log-density tone mapping: curve cells sit orders of magnitude below
         the hotspots, so any linear scale hides them. A per-frame tone table
         keeps the per-pixel loop cheap. */
      const invMax = 1 / Math.max(1, dmax);
      const invLog = 1 / Math.log1p(Math.max(1, dmax));
      for (let i = 0; i < 1024; i++) {
        const t = Math.pow(Math.log1p((i / 1023) * dmax) * invLog, 1.2);
        tone[i] = (t * 255 | 0) * 3;
      }
      for (let i = 0; i < dens.length; i++) {
        let ti = dens[i] * invMax * 1023 | 0;
        if (ti > 1023) ti = 1023;
        const j = tone[ti];
        const o = i * 4;
        d[o] = lut[j]; d[o + 1] = lut[j + 1]; d[o + 2] = lut[j + 2];
      }
      octx.putImageData(img, 0, 0);
      g.wctx.imageSmoothingEnabled = true;
      g.wctx.drawImage(oc, 0, 0, W, H);
    },
  };
}

/* --- multi-scale Truchet arc tiles --- */
function truchet(g) {
  const { ctx, W, H, rand, palette } = g;
  const inks = inksByLum(palette);
  const colA = darkBg(palette) ? inks[inks.length - 1] : inks[0];
  const colB = pick(rand, palette.ink);
  const base = Math.min(W, H) / (5 + (rand() * 4 | 0));
  const tiles = [];
  for (let y = 0; y < H; y += base) {
    for (let x = 0; x < W; x += base) {
      (function split(px, py, s, depth) {
        if (depth < 2 && rand() < 0.42) {
          const h = s / 2;
          split(px, py, h, depth + 1); split(px + h, py, h, depth + 1);
          split(px, py + h, h, depth + 1); split(px + h, py + h, h, depth + 1);
        } else {
          tiles.push([px, py, s]);
        }
      })(x, y, base, 0);
    }
  }
  ctx.lineCap = 'butt';
  const HP = Math.PI / 2;
  for (const [x, y, s] of tiles) {
    const col = rand() < 0.75 ? colA : colB;
    const flip = rand() < 0.5;
    const lw = s * 0.34;
    // quarter arcs centered on opposite corners, clipped to the tile
    const corners = flip
      ? [[x, y, 0, HP], [x + s, y + s, Math.PI, Math.PI + HP]]
      : [[x + s, y, HP, Math.PI], [x, y + s, Math.PI + HP, TAU]];
    for (const [cx, cy, a0, a1] of corners) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2, a0, a1);
      ctx.stroke();
      ctx.strokeStyle = palette.bg;
      ctx.lineWidth = lw * 0.34;
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2, a0, a1);
      ctx.stroke();
    }
  }
}

/* --- silk: GPU domain-warped flowing gradient --- */
const SILK_FRAG = `
precision highp float;
uniform vec2 R;
uniform float T, SC, WA, WB, OX, OY;
uniform vec3 C0, C1, C2, C3;
float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p*=2.03;a*=.5;}return v;}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*SC+vec2(OX,OY);
 float t=T*.03;
 vec2 q=vec2(fbm(uv+vec2(0.,t)),fbm(uv+vec2(5.2,1.3)-vec2(t*.7,0.)));
 vec2 r=vec2(fbm(uv+WA*q+vec2(1.7,9.2)+.15*t),fbm(uv+WA*q+vec2(8.3,2.8)-.126*t));
 float f=fbm(uv+WB*r);
 vec3 col=mix(C0,C1,clamp(f*f*3.,0.,1.));
 col=mix(col,C2,clamp(length(q),0.,1.));
 col=mix(col,C3,clamp(r.x*r.x,0.,1.));
 col*=.55+.65*f;
 gl_FragColor=vec4(col,1.);
}`;
function silk(g) {
  const { rand, palette, W, H, dpr } = g;
  glCanvas.width = W * dpr;
  glCanvas.height = H * dpr;
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  const { prog, buf } = getProgram('silk', SILK_FRAG);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = name => gl.getUniformLocation(prog, name);
  gl.uniform2f(u('R'), glCanvas.width, glCanvas.height);
  gl.uniform1f(u('SC'), range(rand, 1.2, 3.2));
  gl.uniform1f(u('WA'), range(rand, 2.2, 4.5));
  gl.uniform1f(u('WB'), range(rand, 2, 4));
  gl.uniform1f(u('OX'), rand() * 40);
  gl.uniform1f(u('OY'), rand() * 40);
  const inks = inksByLum(palette);
  const cols = [
    palette.bg,
    inks[0],
    inks[(inks.length / 2) | 0],
    inks[inks.length - 1],
  ];
  if (rand() < 0.5) cols.reverse();
  ['C0', 'C1', 'C2', 'C3'].forEach((name, i) => {
    const [r, gr, b] = hexRgb(cols[i]);
    gl.uniform3f(u(name), r / 255, gr / 255, b / 255);
  });
  const uT = u('T');
  const t0 = rand() * 500;
  return {
    animated: true,
    source: glCanvas,
    frame(t) {
      gl.uniform1f(uT, t0 + t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

/* --- contours: topographic map with slowly migrating elevation lines --- */
function contours(g) {
  const { wctx: ctx, W, H, rand, fbm, palette } = g;
  const cell = 8;
  const gw = Math.ceil(W / cell) + 1, gh = Math.ceil(H / cell) + 1;
  const F = new Float32Array(gw * gh);
  const ns = range(rand, 0.002, 0.005);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    F[y * gw + x] = fbm(x * cell * ns, y * cell * ns);
  }
  const levels = 14;
  const grad = makeGradient([pick(rand, palette.ink), pick(rand, palette.ink)]);
  const cols = [];
  for (let i = 0; i < levels; i++) {
    const [r, gr, b] = grad(i / (levels - 1));
    cols.push(`rgb(${r | 0},${gr | 0},${b | 0})`);
  }
  // segment table: which cell edges each marching-squares case crosses
  const CASES = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [1, 2]],
    6: [[0, 2]], 7: [[3, 0]], 8: [[3, 0]], 9: [[0, 2]], 10: [[0, 1], [2, 3]],
    11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
  };
  return {
    animated: true,
    frame(t) {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';
      const drift = t * 0.004;
      for (let li = 0; li < levels; li++) {
        const iso = 0.15 + 0.7 * (((li / levels) + drift) % 1);
        ctx.strokeStyle = cols[li];
        ctx.lineWidth = li % 4 === 0 ? 2 : 0.8;
        ctx.beginPath();
        for (let y = 0; y < gh - 1; y++) {
          for (let x = 0; x < gw - 1; x++) {
            const a = F[y * gw + x], b = F[y * gw + x + 1];
            const c = F[(y + 1) * gw + x + 1], d = F[(y + 1) * gw + x];
            const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
            const segs = CASES[idx];
            if (!segs) continue;
            const px = x * cell, py = y * cell;
            const ep = e => {
              switch (e) {
                case 0: return [px + cell * (iso - a) / (b - a), py];
                case 1: return [px + cell, py + cell * (iso - b) / (c - b)];
                case 2: return [px + cell * (iso - d) / (c - d), py + cell];
                default: return [px, py + cell * (iso - a) / (d - a)];
              }
            };
            for (const [e0, e1] of segs) {
              const [x0, y0] = ep(e0), [x1, y1] = ep(e1);
              ctx.moveTo(x0, y0);
              ctx.lineTo(x1, y1);
            }
          }
        }
        ctx.stroke();
      }
    },
  };
}

/* --- night sky: nebula, twinkling stars, occasional meteor --- */
function nightSky(g) {
  const { wctx: ctx, W, H, rand, palette } = g;
  const inks = inksByLum(palette);
  const skyTop = mixHex(palette.bg, '#000008', 0.55);
  const horizon = mixHex(palette.bg, inks[inks.length - 1], 0.22);
  // nebula painted once at quarter res
  const nw = Math.ceil(W / 4), nh = Math.ceil(H / 4);
  const neb = document.createElement('canvas');
  neb.width = nw; neb.height = nh;
  const nctx = neb.getContext('2d');
  const nfbm = makeFbm(makeNoise(mulberry32((rand() * 0xffffffff) >>> 0)));
  const img = nctx.createImageData(nw, nh);
  const gTop = rgb2oklab(hexRgb(skyTop)), gBot = rgb2oklab(hexRgb(horizon));
  const tintA = hexRgb(pick(rand, palette.ink)), tintB = hexRgb(pick(rand, palette.ink));
  const ns = range(rand, 0.008, 0.02);
  for (let y = 0; y < nh; y++) {
    const f = y / nh;
    const sky = oklab2rgb([
      gTop[0] + (gBot[0] - gTop[0]) * f,
      gTop[1] + (gBot[1] - gTop[1]) * f,
      gTop[2] + (gBot[2] - gTop[2]) * f,
    ]);
    for (let x = 0; x < nw; x++) {
      const v = nfbm(x * ns * 4, y * ns * 4);
      const cloud = Math.pow(Math.max(0, v - 0.42) * 1.9, 1.6);
      const tint = v > 0.55 ? tintA : tintB;
      const o = (y * nw + x) * 4;
      img.data[o] = sky[0] + (tint[0] - sky[0]) * cloud * 0.5;
      img.data[o + 1] = sky[1] + (tint[1] - sky[1]) * cloud * 0.5;
      img.data[o + 2] = sky[2] + (tint[2] - sky[2]) * cloud * 0.5;
      img.data[o + 3] = 255;
    }
  }
  nctx.putImageData(img, 0, 0);
  const stars = [];
  const N = 250 + (rand() * 250 | 0);
  for (let i = 0; i < N; i++) {
    stars.push({
      x: rand() * W, y: rand() * H,
      r: rand() < 0.9 ? range(rand, 0.4, 1.1) : range(rand, 1.2, 2.2),
      a: range(rand, 0.25, 1),
      phase: rand() * TAU,
      speed: range(rand, 0.4, 2.5),
      col: rand() < 0.85 ? '255,255,255' : hexRgb(pick(rand, palette.ink)).join(','),
    });
  }
  const moon = rand() < 0.45
    ? { x: range(rand, W * 0.15, W * 0.85), y: range(rand, H * 0.12, H * 0.45), r: range(rand, 18, 42) }
    : null;
  const srand = mulberry32((rand() * 0xffffffff) >>> 0);
  let meteor = null, nextMeteor = range(rand, 6, 18);
  return {
    animated: true,
    frame(t) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(neb, 0, 0, W, H);
      for (const s of stars) {
        const tw = s.a * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(${s.col},${tw})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      if (moon) {
        const glow = ctx.createRadialGradient(moon.x, moon.y, moon.r * 0.5, moon.x, moon.y, moon.r * 3);
        glow.addColorStop(0, 'rgba(255,250,235,0.35)');
        glow.addColorStop(1, 'rgba(255,250,235,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(moon.x, moon.y, moon.r * 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f5efdc';
        ctx.beginPath();
        ctx.arc(moon.x, moon.y, moon.r, 0, TAU);
        ctx.fill();
      }
      if (!meteor && t > nextMeteor) {
        const mx = srand() * W, my = srand() * H * 0.5;
        const ang = range(srand, 0.5, 1.1) + (srand() < 0.5 ? Math.PI / 2 : Math.PI * 0.9);
        meteor = { x: mx, y: my, dx: Math.cos(ang) * 900, dy: Math.abs(Math.sin(ang)) * 500, born: t };
      }
      if (meteor) {
        const age = t - meteor.born;
        if (age > 0.8) { meteor = null; nextMeteor = t + range(srand, 8, 25); }
        else {
          const hx = meteor.x + meteor.dx * age, hy = meteor.y + meteor.dy * age;
          const fadeM = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.65;
          const gr2 = ctx.createLinearGradient(hx - meteor.dx * 0.12, hy - meteor.dy * 0.12, hx, hy);
          gr2.addColorStop(0, 'rgba(255,255,255,0)');
          gr2.addColorStop(1, `rgba(255,255,255,${0.9 * fadeM})`);
          ctx.strokeStyle = gr2;
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(hx - meteor.dx * 0.12, hy - meteor.dy * 0.12);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
      }
    },
  };
}

/* ---------- system registry ---------- */
const staticSystem = draw => g => {
  draw({ ...g, ctx: g.wctx });
  grain(g.wctx, g.W, g.H, g.rand);
  return { animated: false, frame() { } };
};
const SYSTEMS = [
  { name: 'flow field', make: staticSystem(flowField) },
  { name: 'circle pack', make: staticSystem(circlePack) },
  { name: 'ridgelines', make: staticSystem(ridgelines) },
  { name: 'watercolor', make: staticSystem(watercolor) },
  { name: 'mosaic', make: staticSystem(mosaic) },
  { name: 'halos', make: halos },
  { name: 'physarum', make: physarum },
  { name: 'reaction-diffusion', make: reactionDiffusion },
  { name: 'attractor', make: attractor },
  { name: 'truchet', make: staticSystem(truchet) },
  { name: 'silk', make: silk, gl: true },
  { name: 'contours', make: contours },
  { name: 'night sky', make: nightSky },
].filter(s => !s.gl || getGL());

/* ---------- taste memory ---------- */
const PREF_KEY = 'everyload-prefs';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY));
    if (p && p.systems && p.palettes) return p;
  } catch (e) { /* private mode or blocked storage */ }
  return { systems: {}, palettes: {} };
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { }
}
const prefs = loadPrefs();
const statFor = (map, key) => map[key] || { up: 0, down: 0 };
const scoreOf = st => (st.up + 1) / (st.up + st.down + 2);
function weightedIndex(items, keyFn, map) {
  const w = items.map((it, i) => {
    const s = scoreOf(statFor(map, keyFn(it, i)));
    return Math.max(0.04, s * s);
  });
  let t = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; }
  return w.length - 1;
}
const pickSystem = () => weightedIndex(SYSTEMS, s => s.name, prefs.systems);
const pickPalette = () => weightedIndex(PALETTES, (p, i) => String(i), prefs.palettes);

/* ---------- main ---------- */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const work = document.createElement('canvas');
const wctx = work.getContext('2d');
const label = document.getElementById('label');
let labelTimer;

const q = new URLSearchParams(location.search);
const intParam = (name, max) => {
  const v = q.get(name);
  return v !== null && /^\d+$/.test(v) && Number(v) < max ? Number(v) : null;
};
let seed = intParam('seed', 2 ** 32) ?? newSeed();
let sysIdx = intParam('sys', SYSTEMS.length) ?? pickSystem();
let palIdx = intParam('pal', PALETTES.length) ?? pickPalette();
let currentName = '';

function newPiece() {
  seed = newSeed();
  sysIdx = pickSystem();
  palIdx = pickPalette();
  render();
}

function showLabel(text, ms = 4000) {
  label.textContent = text;
  label.classList.add('show');
  clearTimeout(labelTimer);
  labelTimer = setTimeout(() => label.classList.remove('show'), ms);
}

function feedback(dir) {
  const skey = SYSTEMS[sysIdx].name, pkey = String(palIdx);
  const s = prefs.systems[skey] = statFor(prefs.systems, skey);
  const p = prefs.palettes[pkey] = statFor(prefs.palettes, pkey);
  if (dir > 0) { s.up++; p.up++; } else { s.down++; p.down++; }
  savePrefs();
  const btn = document.getElementById(dir > 0 ? 'accept' : 'reject');
  btn.classList.remove('pop');
  void btn.offsetWidth;
  btn.classList.add('pop');
  if (dir < 0) newPiece();
  else showLabel(`noted — more ${skey} and colors like these`, 2500);
}

/* Paint the palette background immediately so the previous image never
   lingers, then build the piece and fade its frames in. Animated systems
   keep looping; static ones stop once the fade completes. */
let renderToken = 0;
let rafId = 0;
let artSource = null;

function render() {
  const token = ++renderToken;
  cancelAnimationFrame(rafId);
  const rand = mulberry32(seed);
  const noise = makeNoise(rand);
  const fbm = makeFbm(noise);
  const palette = PALETTES[palIdx];
  const system = SYSTEMS[sysIdx];
  currentName = system.name;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  work.width = W * dpr;
  work.height = H * dpr;
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.fillStyle = palette.bg;
  wctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  document.body.style.background = palette.bg;

  /* build after the bg paint; the timeout fallback covers hidden tabs,
     where requestAnimationFrame never fires */
  let built = false;
  const build = () => {
    if (token !== renderToken || built) return;
    built = true;
    const g = { W, H, dpr, rand, noise, fbm, palette, wctx, work };
    const piece = system.make(g);
    const source = piece.source || work;
    artSource = source;
    const start = performance.now();
    /* dev hook: advance the piece n frames and composite immediately,
       so it can be exercised even when rAF is throttled (hidden tab) */
    window.__pump = (n = 60) => {
      for (let i = 0; i < n; i++) piece.frame((performance.now() - start) / 1000 + i / 60);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.drawImage(source, 0, 0, W, H);
    };
    const loop = now => {
      if (token !== renderToken) return;
      const t = (now - start) / 1000;
      piece.frame(t);
      const k = Math.min(1, (now - start) / 500);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1 - (1 - k) * (1 - k);
      ctx.drawImage(source, 0, 0, W, H);
      ctx.globalAlpha = 1;
      if (piece.animated || k < 1) rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  };
  requestAnimationFrame(build);
  setTimeout(build, 120);

  showLabel(`${system.name} · seed ${seed} — ♥ / ✕ teach it your taste · click for another · S saves a PNG`);
}

canvas.addEventListener('click', newPiece);
document.getElementById('accept').addEventListener('click', () => feedback(1));
document.getElementById('reject').addEventListener('click', () => feedback(-1));

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'y' || e.key === 'ArrowUp') {
    feedback(1);
  } else if (k === 'n' || k === 'x' || e.key === 'ArrowDown') {
    feedback(-1);
  } else if (e.key === ' ' || k === 'r') {
    newPiece();
  } else if (k === 's') {
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    const sctx = snap.getContext('2d');
    sctx.fillStyle = PALETTES[palIdx].bg;
    sctx.fillRect(0, 0, snap.width, snap.height);
    if (artSource) sctx.drawImage(artSource, 0, 0, snap.width, snap.height);
    snap.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `everyload-${currentName.replace(/ /g, '-')}-${seed}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 150);
});

render();
