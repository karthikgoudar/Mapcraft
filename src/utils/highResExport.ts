import maplibregl from 'maplibre-gl';
import { MapFrame, RouteStyle, LayerStyle, RouteTrack } from '../types';
import { applyCustomLayerStyles, classifyLayer } from './mapStyles';

/** OpenMapTiles only carries every road and path at zoom 14+; lower zooms are filtered. */
const FULL_DETAIL_TILE_ZOOM = 14;
const MAX_DETAIL_BOOST = 5; // at most 2^5 = 32x finer tiles per axis

/** Thinnest line (mm on paper) each group may print at. Thinner lines vanish on inkjet paper. */
const MIN_PRINT_WIDTH_MM: Record<string, number> = {
  localRoads: 0.15,
  roads: 0.15,
  paths: 0.12,
  railways: 0.1
};

/** Evaluate a numeric, zoom 'interpolate' or zoom 'step' value at a fixed zoom (null if data-driven). */
function evalAtZoom(v: any, zoom: number): number | null {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v[0] === 'step' && Array.isArray(v[1]) && v[1][0] === 'zoom') {
    let out = v[2];
    for (let i = 3; i + 1 < v.length; i += 2) if (zoom >= v[i]) out = v[i + 1];
    return typeof out === 'number' ? out : null;
  }
  if (!Array.isArray(v) || v[0] !== 'interpolate' || !Array.isArray(v[2]) || v[2][0] !== 'zoom') return null;
  const curve = v[1];
  const base = curve[0] === 'exponential' ? curve[1] : 1;
  const stops: [number, number][] = [];
  for (let i = 3; i + 1 < v.length; i += 2) {
    if (typeof v[i] !== 'number' || typeof v[i + 1] !== 'number') return null;
    stops.push([v[i], v[i + 1]]);
  }
  if (!stops.length) return null;
  if (zoom <= stops[0][0]) return stops[0][1];
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i + 1 < stops.length; i++) {
    const [z0, v0] = stops[i];
    const [z1, v1] = stops[i + 1];
    if (zoom >= z0 && zoom <= z1) {
      const d = z1 - z0;
      const prog = zoom - z0;
      const t = base === 1 ? prog / d : (Math.pow(base, prog) - 1) / (Math.pow(base, d) - 1);
      return v0 + (v1 - v0) * t;
    }
  }
  return null;
}

export interface PosterExportOptions {
  map: maplibregl.Map;
  frame: MapFrame;
  dpi?: number; // 150, 300 (default 300)
  includeRoute: boolean; // false for Map-Only (Canva), true for Combined
  routeStyle?: RouteStyle;
  layerStyles?: LayerStyle;
  tracks?: RouteTrack[];
  filename: string;
}

export function getDpiPixelDimensions(widthMm: number, heightMm: number, dpi: number = 300) {
  const mmPerInch = 25.4;
  const widthPx = Math.round((widthMm / mmPerInch) * dpi);
  const heightPx = Math.round((heightMm / mmPerInch) * dpi);
  return { widthPx, heightPx };
}

/**
 * Standard PNG CRC32 calculation for metadata chunk insertion
 */
function crc32(buf: Uint8Array): number {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Inserts the PNG pHYs chunk to embed 300 DPI physical print metadata.
 * Ensures Canva, Photoshop, Illustrator, and OS print preview recognize the exact physical millimeter size.
 */
export function addDpiToPngBlob(blob: Blob, dpi: number = 300): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);

        // Verify PNG magic header: \x89PNG\r\n\x1a\n
        if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
          return resolve(blob);
        }

        const ppm = Math.round((dpi / 25.4) * 1000); // Pixels per meter (11811 for 300 DPI)

        // pHYs chunk structure (21 bytes total):
        // 4 bytes: length (9)
        // 4 bytes: 'pHYs'
        // 4 bytes: X pixels per meter
        // 4 bytes: Y pixels per meter
        // 1 byte:  Unit specifier (1 = meter)
        // 4 bytes: CRC32 checksum
        const physChunk = new Uint8Array(21);
        const view = new DataView(physChunk.buffer);
        view.setUint32(0, 9);
        physChunk[4] = 0x70; // 'p'
        physChunk[5] = 0x48; // 'H'
        physChunk[6] = 0x59; // 'Y'
        physChunk[7] = 0x73; // 's' (chunk type is case-sensitive: pHYs)
        view.setUint32(8, ppm);
        view.setUint32(12, ppm);
        physChunk[16] = 1; // Unit: meter

        const crc = crc32(physChunk.subarray(4, 17));
        view.setUint32(17, crc);

        // Standard PNG IHDR end offset is 33 bytes
        const ihdrEnd = 33;
        const newBytes = new Uint8Array(bytes.length + physChunk.length);
        newBytes.set(bytes.subarray(0, ihdrEnd), 0);
        newBytes.set(physChunk, ihdrEnd);
        newBytes.set(bytes.subarray(ihdrEnd), ihdrEnd + physChunk.length);

        resolve(new Blob([newBytes], { type: 'image/png' }));
      } catch (err) {
        console.warn('Failed to embed DPI metadata, returning standard blob:', err);
        resolve(blob);
      }
    };
    reader.onerror = () => resolve(blob);
    reader.readAsArrayBuffer(blob);
  });
}

/** Largest canvas side this GPU can render in one pass (capped to keep memory sane). */
function getGpuMaxCanvasSide(): number {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 4096;
    const rb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const tex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return Math.max(2048, Math.min(rb, tex, vp[0], vp[1], 8192));
  } catch {
    return 4096;
  }
}

/** Wait until every tile in view is fully loaded and drawn. Never returns a half-loaded frame. */
function waitForFullRender(map: maplibregl.Map, timeoutMs = 90000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let stableTicks = 0;
    const timer = setInterval(() => {
      if (map.loaded() && map.areTilesLoaded()) {
        // require a few consecutive ready checks so late-arriving tiles are painted
        if (++stableTicks >= 3) {
          clearInterval(timer);
          map.once('render', () => resolve());
          map.triggerRepaint();
        }
      } else {
        stableTicks = 0;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Map tiles did not finish loading within 90 s. Check your connection and try again.'));
      }
    }, 200);
  });
}

const worldSize = (zoom: number) => 512 * Math.pow(2, zoom);

/**
 * Exports a print-sharp poster PNG at the chosen DPI.
 *
 * Why this is sharp (and the old version was not):
 * - Renders at the SAME zoom as the on-screen frame and raises pixelRatio instead of zooming in,
 *   so road widths, which roads appear and every other style rule match the screen exactly,
 *   just drawn with more pixels (WYSIWYG). Zooming in made roads hairline-thin on paper.
 * - Overrides MapLibre's default 4096 px canvas cap, which silently downscaled large posters.
 * - Very large posters are rendered in GPU-sized tiles and stitched 1:1 (no resampling anywhere).
 * - Raster basemaps request higher-zoom tiles so imagery is not upscaled.
 * - Waits for every tile to load instead of a 7 s timeout, and never falls back to
 *   upscaling the screen canvas.
 * - Embeds the DPI in the PNG so print dialogs use the correct physical size.
 */
export async function exportHighResPoster(options: PosterExportOptions): Promise<void> {
  try {
    const printBlob = await renderPosterBlob(options);
    const url = URL.createObjectURL(printBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = options.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (error: any) {
    console.error('Poster export failed:', error);
    // Deliberately no low-res fallback: a blurry print is worse than a clear error
    alert(`Export failed: ${error?.message || error}`);
  }
}

/** Renders the framed map to a print-sharp PNG Blob (with DPI metadata). Throws on failure. */
export async function renderPosterBlob(options: PosterExportOptions): Promise<Blob> {
  const { map, frame, dpi = 300, includeRoute, tracks, routeStyle, layerStyles } = options;
  const { widthMm, heightMm, screenRect, center, zoom, bearing, pitch } = frame;
  const { widthPx: W, heightPx: H } = getDpiPixelDimensions(widthMm, heightMm, dpi);

  // 2D canvas limits (Chrome/Safari): ~16384 px per side, ~268 MP area
  if (W > 16384 || H > 16384 || W * H > 268_000_000) {
    throw new Error(
      `This poster would be ${W} x ${H} px at ${dpi} DPI, larger than a browser can save as one PNG. ` +
        `Choose a lower DPI or a smaller frame.`
    );
  }

  const cap = getGpuMaxCanvasSide();
  const singlePass = W + 8 <= cap && H + 8 <= cap;
  const rotated = Math.abs(bearing) > 0.01 || Math.abs(pitch) > 0.01;
  if (!singlePass && rotated) {
    throw new Error('This poster is too large for one GPU pass and needs tiling, which requires a north-up, untilted map. Reset rotation/tilt or lower the DPI.');
  }

  // Square render tile: S device px, M px margin cropped away on every side
  const M = singlePass ? 4 : 128;
  const S = singlePass ? Math.max(W, H) + 2 * M : cap;
  const inner = S - 2 * M;
  const nx = Math.ceil(W / inner);
  const ny = Math.ceil(H / inner);

  // Target scale: output px per CSS px at the screen zoom
  const pTarget = W / Math.max(1, screenRect.width);

  // Full-detail data: with High Road Density on, render k zoom levels deeper so tiles come from z14
  // (where every street and footpath exists), and freeze widths/zoom ranges at the screen zoom
  // so the poster still looks like the screen. MapLibre forbids non-512 vector tiles, so we
  // change the render zoom instead of the tile size.
  const detailBoost =
    layerStyles?.showDenseRoadsAtZoomOut !== false
      ? Math.min(MAX_DETAIL_BOOST, Math.max(0, Math.ceil(FULL_DETAIL_TILE_ZOOM - zoom)))
      : 0;
  const pRender = pTarget / Math.pow(2, detailBoost); // device px per CSS px at the deeper zoom
  const cssS = Math.max(1, Math.round(S / pRender));
  const requestedRatio = (S + 0.5) / cssS; // floor(ratio * cssS) === S exactly

  const hiddenContainer = document.createElement('div');
  Object.assign(hiddenContainer.style, {
    position: 'fixed',
    left: '-200000px',
    top: '0',
    width: `${cssS}px`,
    height: `${cssS}px`,
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-99999'
  });
  document.body.appendChild(hiddenContainer);

  let exportMap: maplibregl.Map | null = null;
  try {
    const style = JSON.parse(JSON.stringify(map.getStyle()));
    // Screen route layers use screen widths; the export draws its own route at physical size
    style.layers = (style.layers || []).filter((l: any) => !l.id?.startsWith('gpx-'));
    if (style.sources) {
      for (const k of Object.keys(style.sources)) if (k.startsWith('gpx-')) delete style.sources[k];
    }

    // Raster basemaps: shrink tileSize so MapLibre fetches higher-zoom imagery instead of upscaling
    const rasterBoost = Math.min(3, Math.max(0, Math.floor(Math.log2(pTarget)) - detailBoost));
    for (const src of Object.values<any>(style.sources || {})) {
      if (src.type === 'raster' || src.type === 'raster-dem') {
        if (src.type === 'raster') src.tileSize = Math.max(32, (src.tileSize || 512) / Math.pow(2, rasterBoost));
      }
    }

    exportMap = new maplibregl.Map({
      container: hiddenContainer,
      style,
      center,
      zoom,
      bearing,
      pitch,
      pixelRatio: requestedRatio,
      maxCanvasSize: [S + 1, S + 1], // requested ratio gives S + 0.5; headroom stops MapLibre clamping to S - 1
      preserveDrawingBuffer: true,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      maxTileCacheSize: 4000,
    } as any);

    await new Promise<void>((resolve) => {
      if (exportMap!.isStyleLoaded()) resolve();
      else exportMap!.once('load', () => resolve());
    });

    const canvas = exportMap.getCanvas();
    if (canvas.width !== S || canvas.height !== S) {
      throw new Error(`GPU could only allocate ${canvas.width} x ${canvas.height} px (needed ${S} x ${S}). Lower the DPI.`);
    }
    // Effective device px per CSS px, then set zoom so output scale is exactly pTarget per screen px
    const pEff = S / cssS;
    const renderZoom = zoom + Math.log2(pTarget / pEff); // = zoom + detailBoost (+ rounding nudge)
    const sizeMul = pTarget / pEff; // screen CSS px -> export CSS px
    const pxPerWorld = pEff; // output px per world px at renderZoom

    if (layerStyles) applyCustomLayerStyles(exportMap, layerStyles);
    freezeStyleAtScreenZoom(exportMap, zoom, renderZoom - zoom, sizeMul);

    // Minimum printable line widths (evaluated at the export zoom, converted mm -> CSS px)
    for (const layer of exportMap.getStyle().layers || []) {
      if (layer.type !== 'line') continue;
      const cat = classifyLayer(layer);
      const minMm = cat ? MIN_PRINT_WIDTH_MM[cat] : undefined;
      if (!minMm) continue;
      const minCss = ((minMm / 25.4) * dpi) / pEff;
      const current = evalAtZoom((layer as any).paint?.['line-width'] ?? sizeMul, renderZoom);
      if (current !== null && current < minCss) {
        try { exportMap.setPaintProperty(layer.id, 'line-width', minCss); } catch { /* ignore */ }
      }
    }

    if (includeRoute && tracks && tracks.length > 0) {
      addExportRoute(exportMap, tracks, routeStyle, dpi, pEff);
    }

    // Frame centre in world px at renderZoom
    const ws = worldSize(renderZoom);
    const cMerc = maplibregl.MercatorCoordinate.fromLngLat({ lng: center[0], lat: center[1] });
    const cwx = cMerc.x * ws;
    const cwy = cMerc.y * ws;

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Could not create output canvas');
    ctx.imageSmoothingEnabled = false;

    for (let ty = 0; ty < ny; ty++) {
      for (let tx = 0; tx < nx; tx++) {
        const ox = tx * inner;
        const oy = ty * inner;
        const rw = Math.min(inner, W - ox);
        const rh = Math.min(inner, H - oy);

        if (singlePass) {
          // Output pixel (u, v) sits at canvas pixel (u + offX, v + offY); integer offsets, canvas centre = frame centre
          exportMap.jumpTo({ center, zoom: renderZoom, bearing, pitch });
        } else {
          // Canvas pixel i maps to output pixel ox - M + i, so canvas centre is at output ox - M + S/2
          const cu = ox - M + S / 2;
          const cv = oy - M + S / 2;
          const wx = cwx + (cu - W / 2) / pxPerWorld;
          const wy = cwy + (cv - H / 2) / pxPerWorld;
          const ll = new maplibregl.MercatorCoordinate(wx / ws, wy / ws).toLngLat();
          exportMap.jumpTo({ center: ll, zoom: renderZoom, bearing: 0, pitch: 0 });
        }

        await waitForFullRender(exportMap);

        if (singlePass) {
          // Centre of S x S canvas = centre of W x H poster. Offsets are integers when (S - W) is even.
          const offX = (S - W) / 2;
          const offY = (S - H) / 2;
          if (Number.isInteger(offX) && Number.isInteger(offY)) {
            ctx.drawImage(canvas, offX, offY, W, H, 0, 0, W, H);
          } else {
            // Shift by half a pixel so the crop stays on whole pixels (no resampling)
            const sx = Math.floor(offX);
            const sy = Math.floor(offY);
            const dx = offX - sx; // 0 or 0.5
            const dy = offY - sy;
            const ll = exportMap.unproject([(S / 2 + dx) / pEff, (S / 2 + dy) / pEff]);
            exportMap.jumpTo({ center: ll, zoom: renderZoom, bearing, pitch });
            await waitForFullRender(exportMap);
            ctx.drawImage(canvas, sx, sy, W, H, 0, 0, W, H);
          }
        } else {
          ctx.drawImage(canvas, M, M, rw, rh, ox, oy, rw, rh);
        }
      }
    }

    const raw = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
    if (!raw) throw new Error('Failed to encode PNG');
    return await addDpiToPngBlob(raw, dpi);
  } finally {
    exportMap?.remove();
    if (document.body.contains(hiddenContainer)) document.body.removeChild(hiddenContainer);
  }
}

/** Paint props measured in screen px: scaled when the export renders at a deeper zoom. */
const SIZE_PAINT = [
  'line-width', 'line-gap-width', 'line-offset', 'line-blur',
  'circle-radius', 'circle-stroke-width', 'circle-blur',
  'text-halo-width', 'text-halo-blur', 'icon-halo-width', 'icon-halo-blur'
];
const SIZE_LAYOUT = ['text-size', 'icon-size'];
const PLAIN_PAINT = [
  'line-opacity', 'fill-opacity', 'circle-opacity', 'text-opacity', 'icon-opacity',
  'raster-opacity', 'fill-extrusion-opacity', 'background-opacity'
];

/**
 * Makes the export look like the screen even though it renders zoomDelta levels deeper:
 * zoom-based sizes/opacities are evaluated at the screen zoom (sizes scaled by sizeMul) and
 * every layer's zoom range is shifted by zoomDelta, so the same layers show as on screen.
 */
function freezeStyleAtScreenZoom(m: maplibregl.Map, screenZoom: number, zoomDelta: number, sizeMul: number) {
  if (zoomDelta < 0.001 && Math.abs(sizeMul - 1) < 0.001) return;
  const set = (fn: () => void) => { try { fn(); } catch { /* ignore */ } };
  for (const layer of (m.getStyle().layers || []) as any[]) {
    const id = layer.id;
    if (layer.type !== 'background') {
      const min = layer.minzoom ?? 0;
      const max = layer.maxzoom ?? 24;
      set(() => m.setLayerZoomRange(id, Math.min(24, min > 0 ? min + zoomDelta : 0), Math.min(24, max + zoomDelta)));
    }
    const paint = layer.paint || {};
    const layout = layer.layout || {};
    for (const prop of SIZE_PAINT) {
      const isLineW = prop === 'line-width' && layer.type === 'line';
      const raw = paint[prop] ?? (isLineW ? 1 : undefined);
      if (raw === undefined) continue;
      const v = evalAtZoom(raw, screenZoom);
      if (v !== null) set(() => m.setPaintProperty(id, prop, v * sizeMul));
    }
    for (const prop of SIZE_LAYOUT) {
      const raw = layout[prop] ?? (prop === 'text-size' && layer.type === 'symbol' && layout['text-field'] ? 16 : undefined);
      if (raw === undefined) continue;
      const v = evalAtZoom(raw, screenZoom);
      if (v !== null) set(() => m.setLayoutProperty(id, prop, v * sizeMul));
    }
    for (const prop of PLAIN_PAINT) {
      const raw = paint[prop];
      if (raw === undefined || typeof raw === 'number') continue;
      const v = evalAtZoom(raw, screenZoom);
      if (v !== null) set(() => m.setPaintProperty(id, prop, v));
    }
  }
}

/** Route + markers at true physical size. Widths are CSS px, so divide device px by the pixel ratio. */
function addExportRoute(
  exportMap: maplibregl.Map,
  tracks: RouteTrack[],
  routeStyle: RouteStyle | undefined,
  dpi: number,
  pixelRatio: number
) {
  const lineFeatures: any[] = [];
  const markerFeatures: any[] = [];

  tracks.forEach((track) => {
    track.segments.forEach((segment) => {
      if (segment.length >= 2) {
        lineFeatures.push({
          type: 'Feature',
          properties: { name: track.name },
          geometry: { type: 'LineString', coordinates: segment.map((p) => [p.lon, p.lat]) }
        });
      }
    });
    if (track.segments.length > 0 && track.segments[0].length > 0) {
      const first = track.segments[0][0];
      const lastSeg = track.segments[track.segments.length - 1];
      const last = lastSeg[lastSeg.length - 1];
      if (routeStyle?.showStartMarker) {
        markerFeatures.push({
          type: 'Feature',
          properties: { color: routeStyle.startMarkerColor || '#22c55e' },
          geometry: { type: 'Point', coordinates: [first.lon, first.lat] }
        });
      }
      if (routeStyle?.showFinishMarker) {
        markerFeatures.push({
          type: 'Feature',
          properties: { color: routeStyle.finishMarkerColor || '#ef4444' },
          geometry: { type: 'Point', coordinates: [last.lon, last.lat] }
        });
      }
    }
  });

  const mmToCss = (mm: number) => ((mm / 25.4) * dpi) / pixelRatio;
  const lineW = mmToCss(routeStyle?.strokeWidthMm || 2);

  exportMap.addSource('export-gpx-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: lineFeatures }
  });

  if (routeStyle?.glow) {
    exportMap.addLayer({
      id: 'export-gpx-glow',
      type: 'line',
      source: 'export-gpx-source',
      paint: {
        'line-color': routeStyle.glowColor || '#ea580c',
        'line-width': lineW * 2.2,
        'line-opacity': 0.45,
        'line-blur': lineW * 0.8 // intentional soft glow, not export blur
      }
    });
  }

  exportMap.addLayer({
    id: 'export-gpx-line',
    type: 'line',
    source: 'export-gpx-source',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': routeStyle?.color || '#ea580c',
      'line-width': lineW,
      'line-opacity': routeStyle?.opacity ?? 1
    }
  });

  if (markerFeatures.length > 0) {
    exportMap.addSource('export-markers-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: markerFeatures }
    });
    exportMap.addLayer({
      id: 'export-markers-circle',
      type: 'circle',
      source: 'export-markers-source',
      paint: {
        'circle-radius': mmToCss(3.5),
        'circle-color': ['get', 'color'],
        'circle-stroke-width': mmToCss(0.8),
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}
