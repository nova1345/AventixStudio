// Rebuilds after.png onto before.png's exact layout so the before/after slider lines up.
// The two dashboard screenshots were taken at different window widths: same text size,
// different card widths/bar lengths. So per card we copy text at its natural size
// (anchored to where the before text sits) and stretch only the bars to the before bars.
//
// Usage: node scripts/build-ba.cjs   (reads before.png + after-src.png, writes after.png)
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.cjs');

const ROOT = path.join(__dirname, '..');
const B = decode(fs.readFileSync(path.join(ROOT, 'before.png')));
const A = decode(fs.readFileSync(path.join(ROOT, 'after-src.png')));
const W = B.width, H = B.height;
const out = { width: W, height: H, data: Buffer.alloc(W * H * 4) };

const px = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
const lum = (im, x, y) => { const p = px(im, x, y); return (p[0] + p[1] + p[2]) / 3; };
const put = (x, y, rgb, a = 1) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4, d = out.data;
  d[i] = Math.round(d[i] * (1 - a) + rgb[0] * a); d[i + 1] = Math.round(d[i + 1] * (1 - a) + rgb[1] * a); d[i + 2] = Math.round(d[i + 2] * (1 - a) + rgb[2] * a); d[i + 3] = 255;
};
// bilinear sample (x fractional, y integer row) — from the after image, or a dot-free copy of it
const sampleFrom = (im, xf, y) => {
  const x0 = Math.max(0, Math.min(im.width - 1, Math.floor(xf))), x1 = Math.min(im.width - 1, x0 + 1), t = Math.max(0, Math.min(1, xf - x0));
  const p = px(im, x0, y), q = px(im, x1, y);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
};
const sampleA = (xf, y) => sampleFrom(A, xf, y);
const A2 = { width: A.width, height: A.height, data: Buffer.from(A.data) }; // after with dots erased

// ---- geometry (measured from the images) ----
const SX = 1.045; // before text is ~4.5% wider than after text; heights match
const BC = { xs: [[16, 300], [314, 598], [612, 896], [910, 1194]], ys: [[43, 211], [225, 393]] };
const AC = { xs: [[9, 229], [250, 472], [492, 714], [732, 955]], ys: [[64, 238], [251, 425]] };
const CARDS = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1]]; // [row, col] present in both

// bands in after-card-relative rows → vertical offset into before-card-relative rows
const BAND_A = { y0: 14, y1: 66, dy: -2 };   // title + value
const BAND_L = { y0: 72, y1: 92, dy: -7 };   // percentile label above the dot
const BAND_B = { y0: 92, y1: 112, dy: -5 };  // bar + dot
const BAND_C = { y0: 113, y1: 160, dy: -3 };  // 50th / 90th boxes
const BAR_ROW_A = 101, BAR_ROW_B = 96, DOT_ROWS_A = [93, 96];

const pageBg = px(B, 5, H - 5);
const border = px(B, BC.xs[0][0], 130);

// columns in [x0,x1] whose rows [y0,y1) differ from bg by more than thr → merged segments
function segments(im, x0, x1, y0, y1, bg, thr = 18, gap = 4) {
  const segs = []; let cur = null, last = -99;
  for (let x = x0; x <= x1; x++) {
    let act = false;
    for (let y = y0; y < y1 && !act; y++) { const p = px(im, x, y); if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > thr * 3) act = true; }
    if (act) { if (cur && x - last <= gap) cur[1] = x; else { cur = [x, x]; segs.push(cur); } last = x; }
  }
  return segs;
}

// fill whole canvas with the page background
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, pageBg);

// rounded-rect card frame (AA corners)
function frame(x0, y0, x1, y1, fill, r = 8) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
    const dist = Math.hypot(x - cx, y - cy);
    const outer = Math.max(0, Math.min(1, r + 0.5 - dist));
    if (outer <= 0) continue;
    const inner = Math.max(0, Math.min(1, r - 0.5 - dist));
    put(x, y, border, outer);
    if (inner > 0) put(x, y, fill, inner);
  }
}

// copy an after rect [sx0,sx1]×[sy0,sy1) to before, dest x = mapX(srcX) (any monotonic map), rows shifted by dy
function blit(sx0, sx1, sy0, sy1, mapX, dy, clip, im = A) {
  const dx0 = Math.ceil(mapX(sx0)), dx1 = Math.floor(mapX(sx1));
  // invert mapX via its endpoints (all maps used are affine)
  const inv = (dx) => sx0 + (dx - mapX(sx0)) * (sx1 - sx0) / Math.max(1e-6, (mapX(sx1) - mapX(sx0)));
  for (let y = sy0; y < sy1; y++) for (let dx = dx0; dx <= dx1; dx++) {
    const ty = y + dy;
    if (clip && (dx < clip[0] || dx > clip[1] || ty < clip[2] || ty > clip[3])) continue;
    put(dx, ty, sampleFrom(im, inv(dx), y));
  }
}

for (const [r, c] of CARDS) {
  const [ax0, ax1] = AC.xs[c], [ay0, ay1] = AC.ys[r];
  const [bx0, bx1] = BC.xs[c], [by0, by1] = BC.ys[r];
  const aBg = px(A, ax0 + 6, ay1 - 6);
  const bBg = px(B, bx0 + 6, by1 - 6);
  frame(bx0, by0, bx1, by1, aBg);
  const clip = [bx0 + 2, bx1 - 2, by0 + 2, by1 - 2];
  const AY = (rel) => ay0 + rel, dyOf = (band) => (by0 + band.dy) - ay0; // row shift after→before

  // ---- band A: title/value left-anchored to the before title; right-side icons right-anchored
  const aSegsA = segments(A, ax0 + 4, ax1 - 4, AY(BAND_A.y0), AY(BAND_A.y1), aBg);
  const bSegsA = segments(B, bx0 + 4, bx1 - 4, by0 + 18, by0 + 52, bBg);
  const aLeft = aSegsA.length ? aSegsA[0][0] : ax0 + 19, bLeft = bSegsA.length ? bSegsA[0][0] : bx0 + 18;
  for (const s of aSegsA) {
    const rightSide = s[0] - ax0 > 0.62 * (ax1 - ax0);
    const map = rightSide ? (x) => bx1 - (ax1 - x) * SX : (x) => bLeft + (x - aLeft) * SX;
    blit(s[0] - 1, s[1] + 1, AY(BAND_A.y0), AY(BAND_A.y1), map, dyOf(BAND_A), clip);
  }

  // ---- bar mapping: after bar extent → before bar extent (exact, per card)
  const aBar = segments(A, ax0 + 4, ax1 - 4, AY(BAR_ROW_A), AY(BAR_ROW_A) + 1, aBg, 14, 8);
  const bBar = segments(B, bx0 + 4, bx1 - 4, by0 + BAR_ROW_B, by0 + BAR_ROW_B + 1, bBg, 14, 8);
  const aB0 = aBar[0][0], aB1 = aBar[aBar.length - 1][1], bB0 = bBar[0][0], bB1 = bBar[bBar.length - 1][1];
  const barMap = (x) => bB0 + (x - aB0) * (bB1 - bB0) / (aB1 - aB0);

  // ---- band B: erase the dot from the source bar, stretch the clean bar, then paste the round dot back
  const bgL = lum(A, ax0 + 6, ay1 - 6);
  const capSeg = segments(A, ax0 + 4, ax1 - 4, AY(DOT_ROWS_A[0]), AY(DOT_ROWS_A[1]), aBg, 18, 2)[0];
  let dot = null;
  if (capSeg) {
    const dc = Math.round((capSeg[0] + capSeg[1]) / 2), dcy = AY(BAR_ROW_A);
    let top = dcy; while (top > AY(BAND_B.y0) && Math.abs(lum(A, dc, top - 1) - bgL) > 14) top--;
    const R = dcy - top + 0.5;
    dot = { dc, dcy, R };
    // inpaint in A2: extend the nearest real bar pixels (skipping tick gaps) inward from each side
    const isBarCol = (x) => Math.abs(lum(A, x, dcy) - bgL) > 14;
    let xl = Math.floor(dc - R) - 1; while (xl > aB0 && !isBarCol(xl)) xl--;
    let xr = Math.ceil(dc + R) + 1; while (xr < aB1 && !isBarCol(xr)) xr++;
    for (let y = AY(BAND_B.y0); y < AY(BAND_B.y1); y++) {
      const lc = px(A, xl, y), rc = xr <= aB1 ? px(A, xr, y) : px(A, Math.min(A.width - 1, Math.ceil(dc + R) + 3), y);
      for (let x = Math.floor(dc - R) - 1; x <= Math.ceil(dc + R) + 1; x++) {
        const i = (y * A.width + x) * 4, c = x < dc ? lc : rc;
        A2.data[i] = c[0]; A2.data[i + 1] = c[1]; A2.data[i + 2] = c[2];
      }
    }
  }
  blit(aB0 - 2, aB1 + 2, AY(BAND_B.y0), AY(BAND_B.y1), barMap, dyOf(BAND_B), clip, A2);
  if (dot) {
    const mc = barMap(dot.dc), dyB = dyOf(BAND_B);
    for (let y = Math.floor(dot.dcy - dot.R - 1); y <= Math.ceil(dot.dcy + dot.R + 1); y++)
      for (let x = Math.floor(dot.dc - dot.R - 1); x <= Math.ceil(dot.dc + dot.R + 1); x++) {
        const a = Math.max(0, Math.min(1, dot.R + 0.75 - Math.hypot(x - dot.dc, y - dot.dcy)));
        if (a > 0) put(Math.round(mc + (x - dot.dc)), y + dyB, px(A, x, y), a);
      }
  }

  // ---- band L (label over dot) and band C (percentile boxes): natural size, centred on mapped x
  for (const band of [BAND_L, BAND_C]) {
    for (const s of segments(A, ax0 + 4, ax1 - 4, AY(band.y0), AY(band.y1), aBg, 18, 3)) {
      const c = (s[0] + s[1]) / 2;
      let mc = barMap(c);
      const halfW = (s[1] - s[0] + 2) * SX / 2;
      mc = Math.max(bx0 + 6 + halfW, Math.min(bx1 - 6 - halfW, mc)); // keep inside the card
      blit(s[0] - 1, s[1] + 1, AY(band.y0), AY(band.y1), (x) => mc + (x - c) * SX, dyOf(band), clip);
    }
  }

  // ---- normalise card background to the before card (the after shot had one card hover-highlighted):
  // remap each channel so aBg → bBg while keeping white text white
  if (Math.abs(aBg[0] - bBg[0]) + Math.abs(aBg[1] - bBg[1]) + Math.abs(aBg[2] - bBg[2]) > 9) {
    const r = 8 - 1.5; // inside the 1px border
    for (let y = by0 + 1; y < by1; y++) for (let x = bx0 + 1; x < bx1; x++) {
      const cx = x < bx0 + 8 ? bx0 + 8 : x > bx1 - 8 ? bx1 - 8 : x, cy = y < by0 + 8 ? by0 + 8 : y > by1 - 8 ? by1 - 8 : y;
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        const v = out.data[i + k];
        out.data[i + k] = Math.max(0, Math.min(255, Math.round(bBg[k] + (v - aBg[k]) * (255 - bBg[k]) / Math.max(1, 255 - aBg[k]))));
      }
    }
  }
}

// ---- header: left text block + right "7 day average" dropdown, natural size
const hdrDy = BC.ys[0][0] - AC.ys[0][0]; // align card tops
const aHdr = segments(A, 2, A.width - 3, 0, AC.ys[0][0] - 3, px(A, 3, 50), 18, 14);
const bHdr = segments(B, 2, W - 3, 0, BC.ys[0][0] - 3, pageBg, 18, 14);
const bL = bHdr[0][0], bR = bHdr[bHdr.length - 1][1];
for (const s of aHdr) {
  const right = s[0] > A.width * 0.6;
  const map = right ? (x) => bR - (aHdr[aHdr.length - 1][1] - x) * SX : (x) => bL + (x - aHdr[0][0]) * SX;
  blit(s[0] - 1, s[1] + 1, 0, AC.ys[0][0] - 3, map, hdrDy, [0, W - 1, 0, BC.ys[0][0] - 3]);
}

// ---- light unsharp mask on the whole result (after source is a soft JPEG)
const src = Buffer.from(out.data);
const g = (x, y, k) => src[(y * W + x) * 4 + k];
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) for (let k = 0; k < 3; k++) {
  const blur = (g(x - 1, y, k) + g(x + 1, y, k) + g(x, y - 1, k) + g(x, y + 1, k) + 4 * g(x, y, k)) / 8;
  const v = g(x, y, k) + 0.6 * (g(x, y, k) - blur);
  out.data[(y * W + x) * 4 + k] = Math.max(0, Math.min(255, Math.round(v)));
}

fs.writeFileSync(path.join(ROOT, 'after.png'), encode(out));
console.log(`after.png rebuilt: ${W}x${H} (matches before.png)`);
