import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, RefreshCw, Upload, Trash2, AlertTriangle, CheckCircle2, LayoutTemplate, Loader2 } from 'lucide-react';
import { MapFrame } from '../types';
import { TEMPLATES, Template, FrameKind, A4 } from '../layout/templates';
import { resolveLayout, drawLayout, buildPdf } from '../layout/layoutEngine';
import {
  RaceDetails, DEFAULT_RACE_DETAILS, DISTANCE_PRESETS, DistancePreset, Unit,
  autoPace, parseDuration, resolveTitle
} from '../layout/raceDetails';

interface LayoutStudioProps {
  isOpen: boolean;
  onClose: () => void;
  frame: MapFrame;
  /** Resize the MapCraft frame to the template's map area (mm). */
  onSetFrameSize: (widthMm: number, heightMm: number) => void;
  /** Render the framed map (no route) to a PNG at the given DPI. */
  renderMap: (dpi: number) => Promise<Blob>;
  onExportTrailSVG: () => void;
  onExportSTL: () => void;
  hasRoute: boolean;
  /** Map water colour; dark designs use it as the page background. */
  waterColor?: string;
}

const LS_DETAILS = 'mapcraft_race_details_v1';
const LS_TEMPLATE = 'mapcraft_layout_template_v1';
const LS_SKYLINE = (theme: string) => `mapcraft_skyline_${theme}_v1`;

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const loadStr = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const save = (key: string, value: string) => {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });

const dataUrlToBytes = (dataUrl: string) => {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: (head.includes('png') ? 'png' : 'jpg') as 'png' | 'jpg' };
};

const downloadBytes = (bytes: Uint8Array, filename: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'poster';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FONT_LOADS = [
  '400 20px "Arimo"', '700 20px "Arimo"',
  '500 20px "Montserrat"', '700 20px "Montserrat"', '800 20px "Montserrat"'
];

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500';
const labelCls = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block';

export const LayoutStudio: React.FC<LayoutStudioProps> = ({
  isOpen, onClose, frame, onSetFrameSize, renderMap, onExportTrailSVG, onExportSTL, hasRoute, waterColor
}) => {
  /** Dark designs: page background = map water colour, so the sea runs seamlessly into the page. */
  const themed = (t: Template): Template =>
    t.theme === 'dark' && waterColor ? { ...t, background: waterColor } : t;
  const [details, setDetails] = useState<RaceDetails>(() => load(LS_DETAILS, DEFAULT_RACE_DETAILS));
  const [templateId, setTemplateId] = useState<string>(() => loadStr(LS_TEMPLATE) || 'a4-h-dark');
  const [showGuides, setShowGuides] = useState(true);
  const [mapDpi, setMapDpi] = useState(300);
  const [fontsReady, setFontsReady] = useState(0);
  const [mapPreview, setMapPreview] = useState<HTMLImageElement | null>(null);
  const [mapPreviewState, setMapPreviewState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [skylineUrl, setSkylineUrl] = useState<Record<string, string | null>>(() => ({
    light: loadStr(LS_SKYLINE('light')),
    dark: loadStr(LS_SKYLINE('dark'))
  }));
  const [skylineImg, setSkylineImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 600, h: 800 });

  const renderMapRef = useRef(renderMap);
  renderMapRef.current = renderMap;

  const template: Template = useMemo(
    () => themed(TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templateId, waterColor]
  );
  const frameKind: FrameKind = template.frame;

  useEffect(() => { save(LS_DETAILS, JSON.stringify(details)); }, [details]);
  useEffect(() => { save(LS_TEMPLATE, templateId); }, [templateId]);

  // Web fonts must be loaded before measuring/drawing text
  useEffect(() => {
    if (!isOpen) return;
    Promise.all(FONT_LOADS.map((f) => document.fonts.load(f).catch(() => null))).then(() => setFontsReady((n) => n + 1));
  }, [isOpen]);

  // Track preview area size
  useEffect(() => {
    if (!isOpen || !previewWrapRef.current) return;
    const el = previewWrapRef.current;
    const ro = new ResizeObserver(() => setWrapSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [isOpen]);

  const frameMatches = !template.mapMm ||
    (Math.abs(frame.widthMm - template.mapMm.w) < 0.5 && Math.abs(frame.heightMm - template.mapMm.h) < 0.5);

  // Map preview (96 DPI render of the real map, same pipeline as the print)
  const refreshMapPreview = async () => {
    if (!template.mapMm || !frameMatches) return;
    setMapPreviewState('loading');
    try {
      const blob = await renderMapRef.current(96);
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      setMapPreview(img);
      setMapPreviewState('idle');
    } catch (e) {
      console.error(e);
      setMapPreviewState('error');
    }
  };
  useEffect(() => {
    if (!(isOpen && template.mapMm && frameMatches)) return;
    // short delay so a just-resized frame has updated its map centre before rendering
    const id = setTimeout(() => refreshMapPreview(), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, templateId, frameMatches]);

  // Skyline image for the current theme
  useEffect(() => {
    const url = skylineUrl[template.theme] || (template.theme === 'dark' ? skylineUrl.light : null);
    if (!url || template.frame !== 'tall') { setSkylineImg(null); return; }
    loadImage(url).then(setSkylineImg).catch(() => setSkylineImg(null));
  }, [skylineUrl, template.theme, template.frame]);

  const layout = useMemo(() => resolveLayout(template, details),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, details, fontsReady]);

  // Draw preview
  useEffect(() => {
    const c = canvasRef.current;
    if (!isOpen || !c) return;
    const sheetW = A4.w, sheetH = A4.h; // both frames preview as the printed A4 sheet
    const pad = 24;
    const k = Math.max(0.5, Math.min((wrapSize.w - pad * 2) / sheetW, (wrapSize.h - pad * 2) / sheetH));
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(sheetW * k * dpr);
    c.height = Math.round(sheetH * k * dpr);
    c.style.width = `${sheetW * k}px`;
    c.style.height = `${sheetH * k}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sheetW * k, sheetH * k);
    drawLayout(ctx, template, layout, { map: frameMatches ? mapPreview : null, skyline: skylineImg }, k, { showGuides, onSheet: true });
  }, [isOpen, template, layout, mapPreview, skylineImg, showGuides, wrapSize, frameMatches]);

  if (!isOpen) return null;

  const set = <K extends keyof RaceDetails>(key: K, value: RaceDetails[K]) => setDetails((d) => ({ ...d, [key]: value }));

  const { title } = resolveTitle(details);
  const bothTitleFields = !!details.raceName.trim() && !!details.city.trim();
  const timeValid = !details.finishTime.trim() || parseDuration(details.finishTime) !== null;
  const computedPace = autoPace(details);

  const chooseTemplate = (t: Template) => {
    setTemplateId(t.id);
    setNote(null);
    if (t.mapMm && (Math.abs(frame.widthMm - t.mapMm.w) >= 0.5 || Math.abs(frame.heightMm - t.mapMm.h) >= 0.5)) {
      onSetFrameSize(t.mapMm.w, t.mapMm.h);
      setMapPreview(null);
    }
  };

  const chooseFrame = (f: FrameKind) => {
    if (f === frameKind) return;
    const same = TEMPLATES.find((t) => t.frame === f && t.theme === template.theme) || TEMPLATES.find((t) => t.frame === f)!;
    chooseTemplate(same);
  };

  const onSkylineFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const stored = save(LS_SKYLINE(template.theme), url);
      setSkylineUrl((s) => ({ ...s, [template.theme]: url }));
      if (!stored) setNote('Skyline is too large to remember after a reload, but it is used for this session.');
    };
    reader.readAsDataURL(file);
  };

  const removeSkyline = () => {
    try { localStorage.removeItem(LS_SKYLINE(template.theme)); } catch { /* ignore */ }
    setSkylineUrl((s) => ({ ...s, [template.theme]: null }));
  };

  const handleDownload = async () => {
    setNote(null);
    if (template.mapMm && !frameMatches) {
      setNote(`Set the map frame to ${template.mapMm.w} x ${template.mapMm.h} mm first.`);
      return;
    }
    const base = `${slug(title || details.raceName || 'poster')}_${template.id}`;
    try {
      let mapPng: Uint8Array | null = null;
      if (template.mapMm) {
        setBusy(`Rendering map at ${mapDpi} DPI...`);
        const blob = await renderMapRef.current(mapDpi);
        mapPng = new Uint8Array(await blob.arrayBuffer());
      }
      setBusy('Building PDF...');
      const skyUrl = skylineUrl[template.theme] || (template.theme === 'dark' ? skylineUrl.light : null);
      const skyline = template.frame === 'tall' && skyUrl ? dataUrlToBytes(skyUrl) : null;
      const bytes = await buildPdf(template, layout, { mapPng, skyline }, { title: title || 'MapCraft poster' });
      downloadBytes(bytes, `${base}.pdf`, 'application/pdf');

      if (template.frame === 'a4') {
        if (hasRoute) {
          setBusy('Exporting trail SVG and STL...');
          await wait(500);
          onExportTrailSVG();
          await wait(500);
          onExportSTL();
          await wait(300);
          setNote('Downloaded: PDF, trail SVG and trail STL. If your browser asks to allow multiple downloads, allow it.');
        } else {
          setNote('Downloaded the PDF. No route is loaded, so the trail SVG and STL were skipped.');
        }
      } else {
        setNote('Downloaded the PDF (135 x 227 mm poster on an A4 sheet with a cut line).');
      }
    } catch (e: any) {
      console.error(e);
      setNote(`Download failed: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const unitToggle = (value: Unit, onChange: (u: Unit) => void, labels: [string, string]) => (
    <div className="flex bg-slate-950 rounded-md p-0.5 border border-slate-800 shrink-0">
      {(['km', 'mi'] as Unit[]).map((u, i) => (
        <button key={u} onClick={() => onChange(u)}
          className={`px-2 py-1 rounded text-[10px] font-mono ${value === u ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
          {labels[i]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex select-text">
      {/* Controls */}
      <aside className="w-[340px] shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="h-12 px-3 flex items-center justify-between border-b border-slate-800">
          <span className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-emerald-400" /> Layout Studio
          </span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white" title="Close (back to map)">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {/* 1. Frame */}
          <section>
            <span className={labelCls}>1. Frame</span>
            <div className="grid grid-cols-2 gap-1.5">
              {([['a4', 'A4 medal frame'], ['tall', '135 x 227 mm']] as [FrameKind, string][]).map(([f, l]) => (
                <button key={f} onClick={() => chooseFrame(f)}
                  className={`px-2 py-2 rounded-md border text-[11px] font-medium ${frameKind === f ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                  {l}
                </button>
              ))}
            </div>
            {frameKind === 'tall' && <p className="text-[10px] text-slate-500 mt-1">Prints centred on A4 with a light cut line. No map or trail; the map is printed in 3D separately.</p>}
          </section>

          {/* 2. Design */}
          <section>
            <span className={labelCls}>2. Design</span>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATES.filter((t) => t.frame === frameKind).map((t) => (
                <button key={t.id} onClick={() => chooseTemplate(t)}
                  className={`p-1.5 rounded-md border text-left ${t.id === template.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                  <div className="h-10 rounded mb-1 border border-slate-700 flex" style={{ background: themed(t).background }}>
                    {t.mapMm && (
                      <div className="m-auto rounded-sm" style={{
                        background: t.theme === 'dark' ? '#444' : '#2b2b2b',
                        width: `${(t.mapMm.w / 210) * 100}%`, height: `${Math.min(100, (t.mapMm.h / 297) * 100)}%`
                      }} />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-300">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 3. Map / skyline */}
          {template.mapMm ? (
            <section>
              <span className={labelCls}>3. Map</span>
              {frameMatches ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Map frame is {template.mapMm.w} x {template.mapMm.h} mm
                </div>
              ) : (
                <div className="p-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Map frame is {frame.widthMm} x {frame.heightMm} mm; this design needs {template.mapMm.w} x {template.mapMm.h} mm.</div>
                  <button onClick={() => onSetFrameSize(template.mapMm!.w, template.mapMm!.h)}
                    className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-semibold text-[10px]">Set map frame to {template.mapMm.w} x {template.mapMm.h} mm</button>
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Close the studio to pan or zoom the map inside the frame, then reopen and refresh.</p>
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={refreshMapPreview} disabled={!frameMatches || mapPreviewState === 'loading'}
                  className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:border-slate-500 disabled:opacity-40 flex items-center gap-1 text-[10px]">
                  <RefreshCw className={`w-3 h-3 ${mapPreviewState === 'loading' ? 'animate-spin' : ''}`} /> Refresh map preview
                </button>
                <span className="text-[10px] text-slate-500">Print DPI</span>
                <div className="flex bg-slate-950 rounded p-0.5 border border-slate-800">
                  {[300, 600].map((d) => (
                    <button key={d} onClick={() => setMapDpi(d)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${mapDpi === d ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}>{d}</button>
                  ))}
                </div>
              </div>
              {mapPreviewState === 'error' && <p className="text-[10px] text-red-400 mt-1">Map preview failed. Check the connection and refresh.</p>}
            </section>
          ) : (
            <section>
              <span className={labelCls}>3. Skyline ({template.theme})</span>
              <div className="flex items-center gap-2">
                <label className="px-2 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500 cursor-pointer flex items-center gap-1 text-[11px]">
                  <Upload className="w-3.5 h-3.5" /> Upload skyline PNG
                  <input type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onSkylineFile(f); e.target.value = ''; }} />
                </label>
                {skylineUrl[template.theme] && (
                  <button onClick={removeSkyline} className="p-1.5 rounded border border-slate-700 text-slate-400 hover:text-red-400" title="Remove skyline">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {skylineUrl[template.theme]
                  ? 'Saved in this browser for this theme.'
                  : template.theme === 'dark' && skylineUrl.light
                    ? 'Using the light skyline. Upload a transparent PNG made for dark backgrounds for best results.'
                    : 'Download it from Canva (Share > Download > PNG) and upload it here. Fills a 135 x 76 mm band.'}
              </p>
            </section>
          )}

          {/* 4. Race details */}
          <section className="space-y-2">
            <span className={labelCls}>4. Race details</span>
            <div>
              <span className="text-[10px] text-slate-500">Race name</span>
              <input className={inputCls} value={details.raceName} onChange={(e) => set('raceName', e.target.value)} placeholder="Tata Mumbai Marathon" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">City / State</span>
              <input className={inputCls} value={details.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" />
            </div>
            <label className={`flex items-center gap-2 ${bothTitleFields ? 'text-slate-300' : 'text-slate-600'}`}>
              <input type="checkbox" disabled={!bothTitleFields} checked={details.raceNameAsTitle}
                onChange={(e) => set('raceNameAsTitle', e.target.checked)} className="accent-emerald-500" />
              Use race name as the title (default: city)
            </label>
            <p className="text-[10px] text-slate-500">Title: <span className="text-slate-200">{title || '(empty)'}</span>{layout.title.lines.length > 1 ? ' (2 lines)' : ''}</p>

            <div className="grid grid-cols-[1fr_90px] gap-1.5">
              <div>
                <span className="text-[10px] text-slate-500">Athlete's name</span>
                <input className={inputCls} value={details.athleteName} onChange={(e) => set('athleteName', e.target.value)} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Bib</span>
                <input className={inputCls} value={details.bib} onChange={(e) => set('bib', e.target.value)} />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500">Label above the name{frameKind === 'tall' ? ' (A4 designs only)' : ''}</span>
              <div className="flex gap-1.5">
                <select className={`${inputCls} ${details.nameLabel === 'custom' ? 'w-28 shrink-0' : ''}`} value={details.nameLabel}
                  onChange={(e) => set('nameLabel', e.target.value as RaceDetails['nameLabel'])}>
                  <option value="runner">Runner</option>
                  <option value="athlete">Athlete</option>
                  <option value="custom">Custom</option>
                </select>
                {details.nameLabel === 'custom' && (
                  <input className={inputCls} value={details.nameLabelCustom} placeholder="e.g. Finisher"
                    onChange={(e) => set('nameLabelCustom', e.target.value)} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] text-slate-500">Race month</span>
                <input type="month" className={inputCls} value={details.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Finish time (h:mm:ss)</span>
                <input className={`${inputCls} ${timeValid ? '' : 'border-red-500'}`} value={details.finishTime}
                  onChange={(e) => set('finishTime', e.target.value)} placeholder="3:40:18" />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500">Distance</span>
              <div className="flex gap-1.5">
                <select className={inputCls} value={details.distancePreset} onChange={(e) => set('distancePreset', e.target.value as DistancePreset)}>
                  {DISTANCE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {unitToggle(details.distanceUnit, (u) => set('distanceUnit', u), ['km', 'mi'])}
              </div>
              {details.distancePreset === 'custom' && (
                <input className={`${inputCls} mt-1.5`} value={details.customDistance} inputMode="decimal"
                  onChange={(e) => set('customDistance', e.target.value)} placeholder={`Distance in ${details.distanceUnit}`} />
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-500">Pace</span>
              <div className="flex gap-1.5 items-center">
                {details.paceManual ? (
                  <input className={inputCls} value={details.paceText} onChange={(e) => set('paceText', e.target.value)} placeholder="5:13" />
                ) : (
                  <div className="flex-1 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-slate-200">
                    {computedPace ?? 'enter time and distance'}
                  </div>
                )}
                {unitToggle(details.paceUnit, (u) => set('paceUnit', u), ['/km', '/mi'])}
              </div>
              <label className="flex items-center gap-2 mt-1 text-slate-300">
                <input type="checkbox" checked={details.paceManual} className="accent-emerald-500"
                  onChange={(e) => setDetails((d) => ({ ...d, paceManual: e.target.checked, paceText: e.target.checked && !d.paceText ? (autoPace(d) ?? '') : d.paceText }))} />
                Enter pace manually
              </label>
            </div>
          </section>

          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="accent-emerald-500" />
            Show medal / ribbon / slot guides (never printed)
          </label>
        </div>

        {/* Download */}
        <div className="p-3 border-t border-slate-800 space-y-1.5">
          {note && <p className="text-[10px] text-slate-300">{note}</p>}
          <button onClick={handleDownload} disabled={!!busy}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ?? (template.frame === 'a4' ? 'Download PDF + trail SVG + STL' : 'Download PDF (A4 sheet)')}
          </button>
        </div>
      </aside>

      {/* Preview */}
      <main ref={previewWrapRef} className="flex-1 flex items-center justify-center overflow-hidden relative bg-slate-950">
        <canvas ref={canvasRef} className="shadow-2xl shadow-black/60" />
        {template.mapMm && !frameMatches && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-amber-500/90 text-slate-950 text-[11px] font-semibold">
            Map hidden: frame size does not match this design
          </div>
        )}
        {mapPreviewState === 'loading' && (
          <div className="absolute top-4 right-4 px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Rendering map preview
          </div>
        )}
      </main>
    </div>
  );
};
