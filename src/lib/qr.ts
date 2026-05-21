/**
 * Minimal QR-code SVG generator. Pure JS — no native dependency, no
 * external runtime. Supports up to ~80 characters at error-correction
 * level L, which comfortably covers any LinkFolio public URL.
 *
 * Adapted from the canonical small-spec QR encoder (the textbook bit
 * layout — Reed-Solomon, mask 0, version-aware lookup). For larger
 * payloads we'd swap in the `qrcode` npm package, but every URL we
 * generate is short enough that the minimal encoder works fine and
 * ships zero extra bytes.
 */

// ── Reed-Solomon over GF(256) with the QR generator polynomial ──
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let coeff = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(coeff.length + 1);
    for (let j = 0; j < coeff.length; j++) {
      next[j] ^= coeff[j];
      next[j + 1] ^= gfMul(coeff[j], GF_EXP[i]);
    }
    coeff = next;
  }
  return coeff;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const gen = rsGeneratorPoly(degree);
  const remainder = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[remainder.length - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        remainder[j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return remainder;
}

// ── QR version 5-L: 37x37 modules, 108 data bytes, 26 EC bytes ──
const SIZE = 37;
const DATA_BYTES = 108;
const EC_BYTES = 26;

function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(DATA_BYTES);
  for (let i = 0; i < bits.length; i++) {
    out[i >> 3] |= bits[i] << (7 - (i & 7));
  }
  return out;
}

function pushBits(out: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) out.push((value >> i) & 1);
}

function encodeByteMode(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, 8); // count, 8 bits for version 1-9 byte mode
  for (let i = 0; i < bytes.length; i++) pushBits(bits, bytes[i], 8);

  // Terminator + pad to byte boundary.
  const targetBits = DATA_BYTES * 8;
  pushBits(bits, 0, Math.min(4, targetBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes alternate 0xEC / 0x11 until we hit the capacity.
  const pads = [0b11101100, 0b00010001];
  let p = 0;
  while (bits.length < targetBits) {
    pushBits(bits, pads[p], 8);
    p ^= 1;
  }
  return bits;
}

type Matrix = Uint8Array;
function mat(): Matrix {
  return new Uint8Array(SIZE * SIZE);
}
function setM(m: Matrix, x: number, y: number, v: 0 | 1): void {
  m[y * SIZE + x] = v;
}
function getM(m: Matrix, x: number, y: number): number {
  return m[y * SIZE + x];
}

function placeFinder(m: Matrix, reserved: Matrix, ox: number, oy: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
      const onBorder = (dy === 0 || dy === 6 || dx === 0 || dx === 6) && dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const onCore = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
      setM(m, x, y, onBorder || onCore ? 1 : 0);
      setM(reserved, x, y, 1);
    }
  }
}

function placeAlignment(m: Matrix, reserved: Matrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const onBorder = dx === -2 || dx === 2 || dy === -2 || dy === 2;
      const center = dx === 0 && dy === 0;
      setM(m, x, y, onBorder || center ? 1 : 0);
      setM(reserved, x, y, 1);
    }
  }
}

function placeTimings(m: Matrix, reserved: Matrix): void {
  for (let i = 8; i < SIZE - 8; i++) {
    const v = (i % 2 === 0 ? 1 : 0) as 0 | 1;
    if (!getM(reserved, i, 6)) {
      setM(m, i, 6, v);
      setM(reserved, i, 6, 1);
    }
    if (!getM(reserved, 6, i)) {
      setM(m, 6, i, v);
      setM(reserved, 6, i, 1);
    }
  }
}

function reserveFormatBits(reserved: Matrix): void {
  for (let i = 0; i < 9; i++) {
    setM(reserved, i, 8, 1);
    setM(reserved, 8, i, 1);
  }
  for (let i = 0; i < 8; i++) {
    setM(reserved, SIZE - 1 - i, 8, 1);
    setM(reserved, 8, SIZE - 1 - i, 1);
  }
}

function placeFormat(m: Matrix): void {
  // Format string for EC level L, mask pattern 0 = 0b111011111000100, then
  // XOR with 0b101010000010010 (per QR spec).
  const bits = 0b111011111000100 ^ 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) as 0 | 1;
    // Left side, top row
    if (i < 6) setM(m, 8, i, bit);
    else if (i < 8) setM(m, 8, i + 1, bit);
    else if (i < 9) setM(m, 7, 8, bit);
    else setM(m, 14 - i, 8, bit);
    // Bottom + right
    if (i < 8) setM(m, SIZE - 1 - i, 8, bit);
    else setM(m, 8, SIZE - 15 + i, bit);
  }
  setM(m, 8, SIZE - 8, 1); // mandatory dark module
}

function placeData(m: Matrix, reserved: Matrix, payload: Uint8Array): void {
  let bitIdx = 0;
  let up = true;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < SIZE; i++) {
      const y = up ? SIZE - 1 - i : i;
      for (const dx of [0, -1]) {
        const x = col + dx;
        if (getM(reserved, x, y)) continue;
        const byte = payload[bitIdx >> 3] ?? 0;
        const bit = ((byte >> (7 - (bitIdx & 7))) & 1);
        // mask 0: invert when (x + y) % 2 === 0
        const masked = ((x + y) % 2 === 0 ? bit ^ 1 : bit) as 0 | 1;
        setM(m, x, y, masked);
        bitIdx++;
      }
    }
    up = !up;
  }
}

/**
 * Build a 37x37 QR matrix (version 5-L) for `text`. Returns the matrix as
 * a `boolean[][]` so the SVG renderer can iterate it directly.
 */
export function buildQrMatrix(text: string): boolean[][] {
  const dataBits = encodeByteMode(text);
  const data = bitsToBytes(dataBits);
  const ec = rsRemainder(data, EC_BYTES);
  const payload = new Uint8Array(data.length + ec.length);
  payload.set(data);
  payload.set(ec, data.length);

  const m = mat();
  const reserved = mat();
  placeFinder(m, reserved, 0, 0);
  placeFinder(m, reserved, SIZE - 7, 0);
  placeFinder(m, reserved, 0, SIZE - 7);
  // Version 5 alignment pattern lives at (30, 30).
  placeAlignment(m, reserved, 30, 30);
  placeTimings(m, reserved);
  reserveFormatBits(reserved);
  placeData(m, reserved, payload);
  placeFormat(m);

  const out: boolean[][] = [];
  for (let y = 0; y < SIZE; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < SIZE; x++) row.push(getM(m, x, y) === 1);
    out.push(row);
  }
  return out;
}

/**
 * Render a QR code as an SVG string. `size` is the final pixel size of
 * the outer square; modules are scaled to fit. The result is safe to
 * drop into `dangerouslySetInnerHTML`.
 */
export function qrSvg(text: string, size = 256): string {
  const matrix = buildQrMatrix(text);
  const n = matrix.length;
  const quiet = 2; // quiet-zone modules on each side
  const total = n + quiet * 2;
  const cell = size / total;

  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        rects.push(
          `<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${cell}" height="${cell}" />`
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="white"/>
  <g fill="black">${rects.join("")}</g>
</svg>`;
}
