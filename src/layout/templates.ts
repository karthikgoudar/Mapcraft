/**
 * Poster templates, measured from the Canva designs:
 *  - "Medal Frame A4 - Refined Type (Dark & Light)" (pages 1-4)
 *  - "Tata Mumbai Marathon" page 3 (tall, left-aligned, 135 x 227 mm); dark version derived from it.
 * Canva positions are in px at 96 px/inch; P() converts them to mm.
 */

export type FrameKind = 'a4' | 'tall';
export type Theme = 'dark' | 'light';

/** Text values the engine fills from RaceDetails. */
export type Field =
  | 'subtitle' | 'athlete' | 'bib' | 'date' | 'finish' | 'distance' | 'pace' | 'nameLabel'
  | 'tallDateLine' | 'tallBibLine';

export const P = (px: number) => (px * 25.4) / 96;

interface Box { x: number; y: number; w: number; h: number } // mm

export type El =
  | (Box & {
      kind: 'rect'; fill: string; guide?: boolean; radius?: number; stroke?: string; strokeW?: number;
      /** Guide that still prints as a faded outline (ribbon slot cut line). */
      cutOutline?: string;
    })
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; guide: true }
  | (Box & { kind: 'rule'; color: string }) // horizontal line; h = thickness
  | {
      kind: 'text';
      x: number; y: number; w: number; // y = top of Canva text box
      size: number; // mm
      weight: number;
      color: string;
      align: 'left' | 'right';
      lineHeight: number;
      letterSpacingEm?: number;
      upper?: boolean;
      value: Field | { literal: string };
      moveWithTitle?: boolean; // shifts up when the title wraps to two lines
      /** Id other elements can stack below. */
      id?: string;
      /** Wrap at word boundaries into up to this many lines at the SAME font size. */
      maxLines?: number;
      /** Place this element `gap` mm below the bottom of element `id` (pushes down when that wraps). */
      below?: { id: string; gap: number };
    }
  | {
      kind: 'title';
      /** Invisible container: title lines are fitted inside it and bottom-aligned to it. */
      x: number; y: number; w: number; h: number;
      /** Top of the title line box in the original design; the subtitle moves relative to this. */
      refTop: number;
      maxSize: number; minSize: number; // mm
      weight: number; color: string; lineHeight: number; upper?: boolean;
      /** Tall poster: a small second line (subtitle + date) sits under the title in the same block. */
      second?: { size: number; weight: number; color: string; lineHeight: number };
    }
  | (Box & { kind: 'map'; placeholder: string })
  | (Box & { kind: 'skyline' });

export interface Template {
  id: string;
  frame: FrameKind;
  theme: Theme;
  label: string;
  pageW: number; pageH: number; // poster size, mm
  background: string;
  font: string; // CSS font family
  elements: El[];
  /** Map area size the MapCraft frame must be set to (mm). Undefined: no map (tall poster). */
  mapMm?: { w: number; h: number };
  format: { dateStyle: 'short' | 'long'; padHours: boolean; distanceDp: number; unitCase: 'lower' | 'title' };
}

export const A4 = { w: 210, h: 297 };
export const TALL = { w: 135, h: 227 };

const A4_FONT = '"Arimo", "Helvetica Neue", Arial, sans-serif';
const TALL_FONT = '"Montserrat", "Helvetica Neue", Arial, sans-serif';

/** Shared A4 text block. o = theme colours, g = geometry differences between horizontal and vertical. */
function a4Text(
  o: { strong: string; label: string; sub: string },
  g: 'h' | 'v',
  footerTop: number
): El[] {
  const T = (x: number, y: number, w: number, size: number, weight: number, color: string, value: any, align: 'left' | 'right' = 'left', lineHeight = 1.4, extra: any = {}): El =>
    ({ kind: 'text', x: P(x), y: P(y), w: P(w), size: P(size), weight, color, align, lineHeight, value, ...extra });

  // Name block: label, name (up to 2 lines, fixed size), then BIB label + number below the name.
  // Label->value spacing matches Canva (20 px between tops); 12 px between name and BIB label.
  const nameBlock = (x: number, top: number, nameW: number): El[] => [
    T(x, top, 300, 11, 400, o.label, 'nameLabel', 'left', 1.4, { upper: true }),
    T(x, top + 20, nameW, 20, 700, o.strong, 'athlete', 'left', 1.2, { id: 'athlete', upper: true, maxLines: 2 }),
    T(x, 0, 200, 11, 400, o.label, { literal: 'BIB' }, 'left', 1.4, { id: 'bibLabel', below: { id: 'athlete', gap: P(12) } }),
    T(x, 0, 300, 20, 700, o.strong, 'bib', 'left', 1.2, { below: { id: 'bibLabel', gap: P(4.6) } })
  ];

  if (g === 'h') {
    return [
      T(76, 228.2, 260, 13, 700, o.sub, 'subtitle', 'left', 1.4, { upper: true, moveWithTitle: true }),
      // Title raised to make room for the name/bib stack. Container 72..360 x 218..330 px,
      // >= 20 px (5 mm) clear of the medal circle (leftmost point x = 380 at y = 227).
      { kind: 'title', x: P(72), y: P(218), w: P(288), h: P(112), refTop: P(250.2), maxSize: P(76), minSize: P(30), weight: 700, color: o.strong, lineHeight: 1.05 },
      // Name wraps within 400 px (clear of the medal's bottom tip); 2-line name ends 17 px above the map
      ...nameBlock(76, 350, 400),
      T(76, footerTop, 140, 11, 400, o.label, { literal: 'DATE' }),
      T(226, footerTop, 140, 11, 400, o.label, { literal: 'FINISH TIME' }),
      T(376, footerTop, 140, 11, 400, o.label, { literal: 'DISTANCE' }),
      T(526, footerTop, 140, 11, 400, o.label, { literal: 'AVG PACE' }),
      T(76, footerTop + 18, 140, 22, 700, o.strong, 'date', 'left', 1.2),
      T(226, footerTop + 18, 140, 22, 700, o.strong, 'finish', 'left', 1.2),
      T(376, footerTop + 18, 140, 22, 700, o.strong, 'distance', 'left', 1.2),
      T(526, footerTop + 18, 140, 22, 700, o.strong, 'pace', 'left', 1.2)
    ];
  }
  return [
    T(57, 478, 320, 13, 700, o.sub, 'subtitle', 'left', 1.4, { upper: true, moveWithTitle: true }),
    // Container below the medal (medal ends at 413 px; subtitle stays above it)
    { kind: 'title', x: P(53), y: P(452), w: P(320), h: P(119.4), refTop: P(500), maxSize: P(68), minSize: P(30), weight: 700, color: o.strong, lineHeight: 1.05 },
    ...nameBlock(57, 614, 320),
    T(57, 924, 160, 11, 400, o.label, { literal: 'DATE' }),
    T(217, 924, 160, 11, 400, o.label, { literal: 'FINISH TIME' }),
    T(57, 942, 160, 26, 700, o.strong, 'date', 'left', 1.2),
    T(217, 942, 160, 26, 700, o.strong, 'finish', 'left', 1.2),
    T(57, 1000, 160, 11, 400, o.label, { literal: 'DISTANCE' }),
    T(217, 1000, 160, 11, 400, o.label, { literal: 'AVG PACE' }),
    T(57, 1018, 160, 26, 700, o.strong, 'distance', 'left', 1.2),
    T(217, 1018, 160, 26, 700, o.strong, 'pace', 'left', 1.2)
  ];
}

/** Medal, ribbon strip and ribbon slot: on-screen guides only, never printed. */
/** Horizontal designs: medal, ribbon and slot moved right of the Canva position to clear long titles. */
export const H_MEDAL_SHIFT_PX = 40;

function medalGuides(g: 'h' | 'v', c: { ribbon: string; medal: string; slot: string; cut: string }): El[] {
  if (g === 'h') {
    const dx = H_MEDAL_SHIFT_PX;
    return [
      { kind: 'rect', x: P(431 + dx), y: 0, w: P(121), h: P(170), fill: c.ribbon, guide: true },
      { kind: 'circle', cx: P(340 + 151 + dx), cy: P(76 + 151), r: P(151), fill: c.medal, guide: true },
      { kind: 'rect', x: P(395.5 + dx), y: P(22), w: P(192), h: P(36), fill: c.slot, radius: P(18), guide: true, cutOutline: c.cut }
    ];
  }
  return [
    { kind: 'rect', x: P(161), y: 0, w: P(94), h: P(150), fill: c.ribbon, guide: true },
    { kind: 'circle', cx: P(66 + 141.5), cy: P(130 + 141.5), r: P(141.5), fill: c.medal, guide: true },
    { kind: 'rect', x: P(112), y: P(76), w: P(192), h: P(36), fill: c.slot, radius: P(18), guide: true, cutOutline: c.cut }
  ];
}

const A4_FMT = { dateStyle: 'short', padHours: true, distanceDp: 3, unitCase: 'lower' } as const;
const TALL_FMT = { dateStyle: 'long', padHours: false, distanceDp: 1, unitCase: 'title' } as const;

const DARK_A4 = { strong: '#ffffff', label: '#8a8a8a', sub: '#9a9a9a' };
const LIGHT_A4 = { strong: '#111111', label: '#777777', sub: '#777777' };

function tallElements(c: { title: string; strong: string; label: string; rule: string; bib: string; slotFill: string; slotStroke: string; cut: string }): El[] {
  const X = P(51.02), W = P(408.19);
  const cols = [51.02, 187.09, 323.15];
  const vals: Field[] = ['finish', 'distance', 'pace'];
  const labels = ['FINISH', 'DISTANCE', 'PACE'];
  return [
    { kind: 'rect', x: P(159.12), y: P(33.02), w: P(192), h: P(36), fill: c.slotFill, stroke: c.slotStroke, strokeW: P(1), radius: P(18), guide: true, cutOutline: c.cut },
    { kind: 'skyline', x: 0, y: P(352.5), w: TALL.w, h: P(287.01) },
    {
      kind: 'title', x: X, y: P(507.6), w: W, h: P(72.8), refTop: P(544), maxSize: P(28), minSize: P(14), weight: 800, color: c.title, lineHeight: 1.3, upper: true,
      second: { size: P(10.67), weight: 500, color: c.title, lineHeight: 1.3 }
    },
    { kind: 'rule', x: X, y: P(623.9), w: W, h: P(2), color: c.rule },
    ...cols.map((cx, i): El => ({ kind: 'text', x: P(cx), y: P(657), w: P(136.06), size: P(26), weight: 700, color: c.strong, align: 'left', lineHeight: 1.15, value: vals[i] })),
    ...cols.map((cx, i): El => ({ kind: 'text', x: P(cx), y: P(689), w: P(136.06), size: P(11), weight: 500, color: c.label, align: 'left', lineHeight: 1.4, letterSpacingEm: 0.25, value: { literal: labels[i] } })),
    { kind: 'rule', x: X, y: P(733.6), w: W, h: P(2), color: c.rule },
    { kind: 'text', x: X, y: P(764), w: W, size: P(24), weight: 700, color: c.strong, align: 'left', lineHeight: 1.15, upper: true, value: 'athlete', id: 'athlete', maxLines: 2 },
    { kind: 'text', x: X, y: P(795), w: W, size: P(12), weight: 500, color: c.bib, align: 'left', lineHeight: 1.4, letterSpacingEm: 0.25, value: 'tallBibLine', below: { id: 'athlete', gap: P(3.4) } }
  ];
}

export const TEMPLATES: Template[] = [
  {
    id: 'a4-h-dark', frame: 'a4', theme: 'dark', label: 'Horizontal map | Dark',
    pageW: A4.w, pageH: A4.h, background: '#262626', font: A4_FONT, format: A4_FMT,
    mapMm: { w: 210, h: 132 },
    elements: [
      ...medalGuides('h', { ribbon: '#1a1a1a', medal: '#333333', slot: '#0b0b0b', cut: '#5c5c5c' }),
      { kind: 'map', x: 0, y: P(491), w: 210, h: 132, placeholder: '#333333' },
      ...a4Text(DARK_A4, 'h', 1014)
    ]
  },
  {
    id: 'a4-h-light', frame: 'a4', theme: 'light', label: 'Horizontal map | Light',
    pageW: A4.w, pageH: A4.h, background: '#ffffff', font: A4_FONT, format: A4_FMT,
    mapMm: { w: 170, h: 125 },
    elements: [
      ...medalGuides('h', { ribbon: '#2b2b2b', medal: '#e6e6e6', slot: '#0b0b0b', cut: '#c4c4c4' }),
      { kind: 'map', x: P(76), y: P(491), w: 170, h: 125, placeholder: '#2b2b2b' },
      ...a4Text(LIGHT_A4, 'h', 1016)
    ]
  },
  {
    id: 'a4-v-dark', frame: 'a4', theme: 'dark', label: 'Vertical map | Dark',
    pageW: A4.w, pageH: A4.h, background: '#262626', font: A4_FONT, format: A4_FMT,
    mapMm: { w: 105, h: 297 },
    elements: [
      { kind: 'map', x: 105, y: 0, w: 105, h: 297, placeholder: '#333333' },
      ...medalGuides('v', { ribbon: '#1a1a1a', medal: '#333333', slot: '#0b0b0b', cut: '#5c5c5c' }),
      { kind: 'rule', x: P(57), y: P(899.2), w: P(320), h: P(1.6), color: '#555555' },
      ...a4Text(DARK_A4, 'v', 924)
    ]
  },
  {
    id: 'a4-v-light', frame: 'a4', theme: 'light', label: 'Vertical map | Light',
    pageW: A4.w, pageH: A4.h, background: '#ffffff', font: A4_FONT, format: A4_FMT,
    mapMm: { w: 80, h: 267 },
    elements: [
      { kind: 'map', x: P(412), y: P(57), w: 80, h: 267, placeholder: '#2b2b2b' },
      ...medalGuides('v', { ribbon: '#2b2b2b', medal: '#e6e6e6', slot: '#0b0b0b', cut: '#c4c4c4' }),
      { kind: 'rule', x: P(57), y: P(899.2), w: P(320), h: P(1.6), color: '#cccccc' },
      ...a4Text(LIGHT_A4, 'v', 924)
    ]
  },
  {
    id: 'tall-light', frame: 'tall', theme: 'light', label: '135 x 227 mm | Light',
    pageW: TALL.w, pageH: TALL.h, background: '#ffffff', font: TALL_FONT, format: TALL_FMT,
    elements: tallElements({ title: '#000000', strong: '#000000', label: '#8a8a8a', rule: '#db8e64', bib: '#c0764d', slotFill: '#ffffff', slotStroke: '#000000', cut: '#c4c4c4' })
  },
  {
    id: 'tall-dark', frame: 'tall', theme: 'dark', label: '135 x 227 mm | Dark',
    pageW: TALL.w, pageH: TALL.h, background: '#161616', font: TALL_FONT, format: TALL_FMT,
    elements: tallElements({ title: '#ffffff', strong: '#ffffff', label: '#8a8a8a', rule: '#db8e64', bib: '#db8e64', slotFill: '#161616', slotStroke: '#8a8a8a', cut: '#5c5c5c' })
  }
];

/** Where the tall poster sits on the A4 sheet (centred), and its cut line. */
export const TALL_ON_A4 = {
  x: (A4.w - TALL.w) / 2,
  y: (A4.h - TALL.h) / 2,
  cutLineColor: '#cfcfcf',
  cutLineMm: 0.2
};
