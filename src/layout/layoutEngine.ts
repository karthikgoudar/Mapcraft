import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip as clipOp, endPath } from 'pdf-lib';
import { El, Field, Template, A4, TALL_ON_A4 } from './templates';
import {
  RaceDetails, resolveTitle, formatDate, formatFinishTime, distanceNumber, paceNumber, nameLabelText
} from './raceDetails';

/** Resolved drawing primitive in poster mm (top-left origin). */
export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; radius?: number; stroke?: string; strokeW?: number; guide?: boolean; cutOutline?: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; guide: true }
  | { t: 'image'; slot: 'map' | 'skyline'; x: number; y: number; w: number; h: number; placeholder?: string }
  | {
      t: 'text'; x: number; baseline: number; text: string; size: number; weight: number; color: string;
      align: 'left' | 'right'; letterSpacing: number; font: string; ascent: number; descent: number;
    };

const MEASURE_PX_PER_MM = 20;
let measureCtx: CanvasRenderingContext2D | null = null;
function mctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  return measureCtx;
}

/** Text width in mm, including manual letter spacing (mm). */
export function measureText(text: string, sizeMm: number, weight: number, font: string, letterSpacingMm = 0): number {
  const c = mctx();
  c.font = `${weight} ${sizeMm * MEASURE_PX_PER_MM}px ${font}`;
  if (!letterSpacingMm) return c.measureText(text).width / MEASURE_PX_PER_MM;
  let w = 0;
  for (const ch of text) w += c.measureText(ch).width / MEASURE_PX_PER_MM;
  return w + letterSpacingMm * Math.max(0, [...text].length - 1);
}

/** Font ascent/descent in mm (font-level, so every line of a size sits identically). */
function fontMetrics(sizeMm: number, weight: number, font: string) {
  const c = mctx();
  c.font = `${weight} ${sizeMm * MEASURE_PX_PER_MM}px ${font}`;
  const m = c.measureText('Hg');
  const asc = (m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent) / MEASURE_PX_PER_MM;
  const desc = (m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent) / MEASURE_PX_PER_MM;
  return { asc, desc };
}

/** Baseline for a line whose Canva line box starts at `top` (half-leading model). */
function baselineFor(top: number, sizeMm: number, lineHeight: number, weight: number, font: string) {
  const { asc, desc } = fontMetrics(sizeMm, weight, font);
  return { baseline: top + (lineHeight * sizeMm) / 2 + (asc - desc) / 2, asc, desc };
}

function fieldValue(f: Field, d: RaceDetails, t: Template): string {
  const fmt = t.format;
  const u = (unit: 'km' | 'mi') => (fmt.unitCase === 'title' ? (unit === 'km' ? 'Km' : 'Mi') : unit);
  const { subtitle } = resolveTitle(d);
  switch (f) {
    case 'subtitle': return subtitle;
    case 'athlete': return d.athleteName.trim();
    case 'nameLabel': return nameLabelText(d);
    case 'bib': return d.bib.trim();
    case 'date': {
      const s = formatDate(d.date, fmt.dateStyle);
      return fmt.dateStyle === 'long' ? s.toUpperCase() : s;
    }
    case 'finish': return formatFinishTime(d.finishTime, fmt.padHours);
    case 'distance': {
      const n = distanceNumber(d, fmt.distanceDp);
      return n ? `${n} ${u(d.distanceUnit)}` : '';
    }
    case 'pace': {
      const p = paceNumber(d);
      return p ? `${p} /${u(d.paceUnit)}` : '';
    }
    case 'tallDateLine':
      return [subtitle.toUpperCase(), formatDate(d.date, 'long').toUpperCase()].filter(Boolean).join('  ·  ');
    case 'tallBibLine': return d.bib.trim() ? `BIB  ${d.bib.trim()}` : '';
  }
}

/** Greedy word wrap into at most maxLines lines; the last line takes any remaining words. */
function wrapWords(text: string, width: number, sizeMm: number, weight: number, font: string, ls: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (!cur || measureText(next, sizeMm, weight, font, ls) <= width) { cur = next; continue; }
    if (lines.length === maxLines - 1) { cur = [cur, ...words.slice(i)].join(' '); break; }
    lines.push(cur);
    cur = words[i];
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Best balanced two-line split of a title, or null if it has no spaces. */
function splitTwoLines(text: string, sizeMm: number, weight: number, font: string): [string, string] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(measureText(a, sizeMm, weight, font), measureText(b, sizeMm, weight, font));
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return best;
}

/**
 * Title sizing inside an invisible container (el.x, el.y, el.w, el.h):
 * - one line, shrunk until it fits both the container width and height
 * - if that falls below 75% of the design size and the title has several words, two balanced
 *   lines are used when they allow a larger size (also limited by width and height)
 * The text never leaves the container. Lines are bottom-aligned to it, so the gap to the runner
 * row is constant, and the subtitle above moves with the top of the title.
 */
function fitTitle(el: Extract<El, { kind: 'title' }>, title: string, font: string) {
  const text = el.upper ? title.toUpperCase() : title;
  if (!text) return { lines: [] as string[], size: el.maxSize };
  const wAtMax = measureText(text, el.maxSize, el.weight, font);
  const one = Math.min(el.maxSize, (el.maxSize * el.w) / Math.max(wAtMax, 0.001), el.h / el.lineHeight);
  if (one >= el.maxSize * 0.75) return { lines: [text], size: one };
  const split = splitTwoLines(text, el.maxSize, el.weight, font);
  if (split) {
    const wLine = Math.max(...split.map((l) => measureText(l, el.maxSize, el.weight, font)));
    const two = Math.min(el.maxSize, (el.maxSize * el.w) / Math.max(wLine, 0.001), el.h / (2 * el.lineHeight));
    if (two > one * 1.15) return { lines: split, size: two };
  }
  return { lines: [text], size: one };
}

export interface ResolvedLayout {
  prims: Prim[];
  title: { lines: string[]; sizeMm: number };
}

export function resolveLayout(t: Template, d: RaceDetails): ResolvedLayout {
  const prims: Prim[] = [];
  const { title } = resolveTitle(d);
  let titleShift = 0;
  let titleInfo = { lines: [] as string[], sizeMm: 0 };

  // Title first, so subtitle elements know how far to move
  const titleEl = t.elements.find((e) => e.kind === 'title') as Extract<El, { kind: 'title' }> | undefined;
  const titlePrims: Prim[] = [];
  if (titleEl) {
    const fit = fitTitle(titleEl, title, t.font);
    titleInfo = { lines: fit.lines, sizeMm: fit.size };
    const secondH = titleEl.second ? titleEl.second.size * titleEl.second.lineHeight : 0;
    const containerBottom = titleEl.y + titleEl.h; // title lines sit on this edge
    const designBottom = containerBottom + secondH; // second line (tall poster) sits below it
    const blockTop = containerBottom - fit.lines.length * fit.size * titleEl.lineHeight;
    titleShift = blockTop - titleEl.refTop;
    fit.lines.forEach((line, i) => {
      const top = blockTop + i * fit.size * titleEl.lineHeight;
      const b = baselineFor(top, fit.size, titleEl.lineHeight, titleEl.weight, t.font);
      titlePrims.push({ t: 'text', x: titleEl.x, baseline: b.baseline, text: line, size: fit.size, weight: titleEl.weight, color: titleEl.color, align: 'left', letterSpacing: 0, font: t.font, ascent: b.asc, descent: b.desc });
    });
    if (titleEl.second) {
      const s = titleEl.second;
      const text = fieldValue('tallDateLine', d, t);
      if (text) {
        const b = baselineFor(designBottom - secondH, s.size, s.lineHeight, s.weight, t.font);
        titlePrims.push({ t: 'text', x: titleEl.x, baseline: b.baseline, text, size: s.size, weight: s.weight, color: s.color, align: 'left', letterSpacing: 0, font: t.font, ascent: b.asc, descent: b.desc });
      }
    }
  }

  const bottoms: Record<string, number> = {}; // element id -> bottom edge (mm), for stacking

  for (const el of t.elements) {
    switch (el.kind) {
      case 'rect':
        prims.push({ t: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, fill: el.fill, radius: el.radius, stroke: el.stroke, strokeW: el.strokeW, guide: el.guide, cutOutline: el.cutOutline });
        break;
      case 'circle':
        prims.push({ t: 'circle', cx: el.cx, cy: el.cy, r: el.r, fill: el.fill, guide: true });
        break;
      case 'rule':
        prims.push({ t: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, fill: el.color });
        break;
      case 'map':
        prims.push({ t: 'image', slot: 'map', x: el.x, y: el.y, w: el.w, h: el.h, placeholder: el.placeholder });
        break;
      case 'skyline':
        prims.push({ t: 'image', slot: 'skyline', x: el.x, y: el.y, w: el.w, h: el.h });
        break;
      case 'title':
        prims.push(...titlePrims);
        break;
      case 'text': {
        let text = typeof el.value === 'string' ? fieldValue(el.value, d, t) : el.value.literal;
        if (el.upper) text = text.toUpperCase();
        let top = el.y + (el.moveWithTitle ? titleShift : 0);
        if (el.below && bottoms[el.below.id] !== undefined) top = bottoms[el.below.id] + el.below.gap;
        if (!text) {
          // empty: elements stacked below this one close up to where it would have started
          if (el.id) bottoms[el.id] = top - (el.below ? el.below.gap : 0);
          break;
        }
        const ls = (el.letterSpacingEm ?? 0) * el.size;
        let size = el.size;
        let lines: string[];
        if (el.maxLines && el.maxLines > 1) {
          // Same font size; wrap at word boundaries. Only shrink if a single word/line still overflows.
          lines = wrapWords(text, el.w, size, el.weight, t.font, ls, el.maxLines);
          const widest = Math.max(...lines.map((l) => measureText(l, size, el.weight, t.font, ls)));
          if (widest > el.w) size = (el.size * el.w) / widest;
        } else {
          lines = [text];
          // Shrink long values to their box rather than overlap the next column
          const w = measureText(text, size, el.weight, t.font, ls);
          if (w > el.w * 1.15) size = (el.size * el.w * 1.15) / w;
        }
        const k = size / el.size;
        const lineH = el.size * el.lineHeight; // keep the design's line pitch so rows stay aligned
        lines.forEach((line, i) => {
          const b = baselineFor(top + i * lineH, el.size, el.lineHeight, el.weight, t.font);
          prims.push({ t: 'text', x: el.align === 'right' ? el.x + el.w : el.x, baseline: b.baseline, text: line, size, weight: el.weight, color: el.color, align: el.align, letterSpacing: ls * k, font: t.font, ascent: b.asc * k, descent: b.desc * k });
        });
        if (el.id) bottoms[el.id] = top + lines.length * lineH;
        break;
      }
    }
  }
  return { prims, title: titleInfo };
}

// ---------- Canvas renderer (live preview) ----------

export interface LayoutImages {
  map?: CanvasImageSource & { width: number; height: number } | null;
  skyline?: CanvasImageSource & { width: number; height: number } | null;
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const br = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > br) { sw = img.height * br; sx = (img.width - sw) / 2; } else { sh = img.width / br; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draws one text primitive; k = px per mm. Shared by the preview and the 600 DPI PDF text layer. */
export function drawTextPrim(ctx: CanvasRenderingContext2D, p: Extract<Prim, { t: 'text' }>, k: number, dx = 0, dy = 0) {
  ctx.font = `${p.weight} ${p.size * k}px ${p.font}`;
  ctx.fillStyle = p.color;
  ctx.textBaseline = 'alphabetic';
  const y = (p.baseline + dy) * k;
  if (!p.letterSpacing) {
    ctx.textAlign = p.align === 'right' ? 'right' : 'left';
    ctx.fillText(p.text, (p.x + dx) * k, y);
    ctx.textAlign = 'left';
    return;
  }
  const w = measureText(p.text, p.size, p.weight, p.font, p.letterSpacing);
  let x = (p.align === 'right' ? p.x - w : p.x) + dx;
  ctx.textAlign = 'left';
  for (const ch of p.text) {
    ctx.fillText(ch, x * k, y);
    x += measureText(ch, p.size, p.weight, p.font) + p.letterSpacing;
  }
}

export interface DrawOptions {
  showGuides: boolean;
  /** Tall poster: draw it on the A4 sheet with its cut line, as it will print. */
  onSheet: boolean;
}

/** Renders the layout into ctx at k px per mm. */
export function drawLayout(ctx: CanvasRenderingContext2D, t: Template, layout: ResolvedLayout, imgs: LayoutImages, k: number, opts: DrawOptions) {
  const sheet = t.frame === 'tall' && opts.onSheet;
  const ox = sheet ? TALL_ON_A4.x : 0;
  const oy = sheet ? TALL_ON_A4.y : 0;
  if (sheet) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4.w * k, A4.h * k);
  }
  ctx.save();
  ctx.translate(ox * k, oy * k);
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, t.pageW * k, t.pageH * k);

  for (const p of layout.prims) {
    if (p.t === 'rect' && p.guide && p.cutOutline && !opts.showGuides) {
      roundRectPath(ctx, p.x * k, p.y * k, p.w * k, p.h * k, (p.radius || 0) * k);
      ctx.strokeStyle = p.cutOutline;
      ctx.lineWidth = Math.max(1, CUT_OUTLINE_MM * k);
      ctx.stroke();
      continue;
    }
    if ((p.t === 'rect' && p.guide) || p.t === 'circle') {
      if (!opts.showGuides) continue;
      ctx.save();
      ctx.globalAlpha = 0.55;
    }
    if (p.t === 'rect') {
      ctx.fillStyle = p.fill;
      if (p.radius) {
        roundRectPath(ctx, p.x * k, p.y * k, p.w * k, p.h * k, p.radius * k);
        ctx.fill();
        if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = (p.strokeW || 0.26) * k; ctx.stroke(); }
      } else {
        ctx.fillRect(p.x * k, p.y * k, p.w * k, p.h * k);
      }
    } else if (p.t === 'circle') {
      ctx.fillStyle = p.fill;
      ctx.beginPath();
      ctx.arc(p.cx * k, p.cy * k, p.r * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.t === 'image') {
      const img = p.slot === 'map' ? imgs.map : imgs.skyline;
      if (img) drawCover(ctx, img, p.x * k, p.y * k, p.w * k, p.h * k);
      else if (p.placeholder) { ctx.fillStyle = p.placeholder; ctx.fillRect(p.x * k, p.y * k, p.w * k, p.h * k); }
    } else if (p.t === 'text') {
      drawTextPrim(ctx, p, k);
    }
    if ((p.t === 'rect' && p.guide) || p.t === 'circle') ctx.restore();
  }
  ctx.restore();

  if (sheet) {
    ctx.strokeStyle = TALL_ON_A4.cutLineColor;
    ctx.lineWidth = Math.max(1, TALL_ON_A4.cutLineMm * k);
    ctx.strokeRect(ox * k, oy * k, t.pageW * k, t.pageH * k);
  }
}

// ---------- PDF writer ----------

const PT_PER_MM = 72 / 25.4;
/** Line weight of printed cut outlines (ribbon slot), mm. */
export const CUT_OUTLINE_MM = 0.2;
const TEXT_DPI = 600;

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function canvasToPng(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Could not encode text layer');
  return new Uint8Array(await blob.arrayBuffer());
}

export interface PdfInputs {
  mapPng?: Uint8Array | null; // print-resolution map image for the map slot
  skyline?: { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
}

/**
 * Builds the print PDF (always an A4 sheet):
 *  - shapes and rules as vector
 *  - map and skyline as embedded images at their full resolution
 *  - each text item rasterised alone at 600 DPI (exact web-font rendering, crisp on inkjet)
 *  - medal / ribbon / slot guides are never printed
 *  - tall poster: centred on A4 with a light cut line on its edge
 */
export async function buildPdf(t: Template, layout: ResolvedLayout, inputs: PdfInputs, meta: { title: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  pdf.setCreator('MapCraft Layout Studio');
  const page = pdf.addPage([A4.w * PT_PER_MM, A4.h * PT_PER_MM]);
  const pageHpt = A4.h * PT_PER_MM;
  const sheet = t.frame === 'tall';
  const ox = sheet ? TALL_ON_A4.x : 0;
  const oy = sheet ? TALL_ON_A4.y : 0;
  // mm box (top-left origin, poster coords) -> PDF points (bottom-left origin)
  const box = (x: number, y: number, w: number, h: number) => ({
    x: (ox + x) * PT_PER_MM,
    y: pageHpt - (oy + y + h) * PT_PER_MM,
    width: w * PT_PER_MM,
    height: h * PT_PER_MM
  });

  page.drawRectangle({ ...box(0, 0, t.pageW, t.pageH), color: hexToRgb(t.background) });

  const mapImg = inputs.mapPng ? await pdf.embedPng(inputs.mapPng) : null;
  const skyImg = inputs.skyline
    ? inputs.skyline.type === 'png' ? await pdf.embedPng(inputs.skyline.bytes) : await pdf.embedJpg(inputs.skyline.bytes)
    : null;

  for (const p of layout.prims) {
    if (p.t === 'rect' && p.guide && p.cutOutline) {
      // Ribbon slot: printed as a faded outline only, so it can be cut out after printing
      const b = box(p.x, p.y, p.w, p.h);
      const r = Math.min((p.radius || 0) * PT_PER_MM, b.height / 2, b.width / 2);
      const w = b.width, h = b.height;
      const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
      page.drawSvgPath(path, { x: b.x, y: b.y + h, borderColor: hexToRgb(p.cutOutline), borderWidth: CUT_OUTLINE_MM * PT_PER_MM });
      continue;
    }
    if (p.t === 'circle' || (p.t === 'rect' && p.guide)) continue; // medal and ribbon guides never print
    if (p.t === 'rect') {
      page.drawRectangle({ ...box(p.x, p.y, p.w, p.h), color: hexToRgb(p.fill) });
    } else if (p.t === 'image') {
      const img = p.slot === 'map' ? mapImg : skyImg;
      if (!img) {
        if (p.placeholder) page.drawRectangle({ ...box(p.x, p.y, p.w, p.h), color: hexToRgb(p.placeholder) });
        continue;
      }
      // Cover-fit: crop via a clipping rectangle so the image fills the slot without distortion
      const ir = img.width / img.height;
      const br = p.w / p.h;
      let dw = p.w, dh = p.h;
      if (ir > br) dw = p.h * ir; else dh = p.w / ir;
      const dx = p.x - (dw - p.w) / 2;
      const dy = p.y - (dh - p.h) / 2;
      const clip = box(p.x, p.y, p.w, p.h);
      page.pushOperators(pushGraphicsState(), rectangle(clip.x, clip.y, clip.width, clip.height), clipOp(), endPath());
      page.drawImage(img, box(dx, dy, dw, dh));
      page.pushOperators(popGraphicsState());
    } else if (p.t === 'text') {
      const w = measureText(p.text, p.size, p.weight, p.font, p.letterSpacing);
      const pad = p.size * 0.3;
      const left = (p.align === 'right' ? p.x - w : p.x) - pad;
      const top = p.baseline - p.ascent - pad;
      const bw = w + pad * 2;
      const bh = p.ascent + p.descent + pad * 2;
      const k = TEXT_DPI / 25.4;
      const c = document.createElement('canvas');
      c.width = Math.ceil(bw * k);
      c.height = Math.ceil(bh * k);
      const ctx = c.getContext('2d')!;
      drawTextPrim(ctx, p, k, -left, -top);
      const png = await pdf.embedPng(await canvasToPng(c));
      page.drawImage(png, box(left, top, c.width / k, c.height / k));
    }
  }

  if (sheet) {
    page.drawRectangle({
      ...box(0, 0, t.pageW, t.pageH),
      borderColor: hexToRgb(TALL_ON_A4.cutLineColor),
      borderWidth: TALL_ON_A4.cutLineMm * PT_PER_MM
    });
  }
  return pdf.save();
}
