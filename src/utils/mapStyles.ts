import { LayerStyle } from '../types';

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  styleUrlOrSpec: string | object;
  previewColor: string;
  isCustom?: boolean;
  defaultLayers: LayerStyle;
}

export const PRESET_DEFAULT_LAYERS: Record<string, LayerStyle> = {
  'race-dark': {
    background: { color: '#2b2b2b', visible: true },
    roads: { color: '#707070', visible: true },
    highways: { color: '#bcbcbc', visible: true },
    arterial: { color: '#8d8d8d', visible: true },
    localRoads: { color: '#5f5f5f', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#1a1a1a', visible: true },
    buildings: { color: '#313131', visible: false },
    parks: { color: '#2f2f2f', visible: true },
    boundaries: { color: '#3d3d3d', visible: false },
    labels: { color: '#8a8a8a', visible: false },
    railways: { color: '#505050', visible: true },
    paths: { color: '#535353', visible: true },
    waterways: { color: '#1a1a1a', visible: true },
    landuse: { color: '#2d2d2d', visible: true },
    aeroways: { color: '#3a3a3a', visible: true }
  },
  dark: {
    background: { color: '#0f172a', visible: true },
    roads: { color: '#334155', visible: true },
    highways: { color: '#475569', visible: true },
    arterial: { color: '#334155', visible: true },
    localRoads: { color: '#1e293b', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#090d16', visible: true },
    buildings: { color: '#1e293b', visible: true },
    parks: { color: '#14232e', visible: true },
    boundaries: { color: '#475569', visible: true },
    labels: { color: '#94a3b8', visible: true },
    railways: { color: '#475569', visible: true },
    paths: { color: '#1e293b', visible: true },
    waterways: { color: '#090d16', visible: true },
    landuse: { color: '#111a2e', visible: true },
    aeroways: { color: '#1e293b', visible: true }
  },
  light: {
    background: { color: '#f8fafc', visible: true },
    roads: { color: '#ffffff', visible: true },
    highways: { color: '#cbd5e1', visible: true },
    arterial: { color: '#e2e8f0', visible: true },
    localRoads: { color: '#f1f5f9', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#cbd5e1', visible: true },
    buildings: { color: '#e2e8f0', visible: true },
    parks: { color: '#e2e8f0', visible: true },
    boundaries: { color: '#94a3b8', visible: true },
    labels: { color: '#475569', visible: true },
    railways: { color: '#cbd5e1', visible: true },
    paths: { color: '#e2e8f0', visible: true },
    waterways: { color: '#cbd5e1', visible: true },
    landuse: { color: '#f1f5f9', visible: true },
    aeroways: { color: '#e2e8f0', visible: true }
  },
  minimal: {
    background: { color: '#f1f5f9', visible: true },
    roads: { color: '#ffffff', visible: true },
    highways: { color: '#cbd5e1', visible: true },
    arterial: { color: '#e2e8f0', visible: true },
    localRoads: { color: '#ffffff', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#bae6fd', visible: true },
    buildings: { color: '#e2e8f0', visible: true },
    parks: { color: '#d1fae5', visible: true },
    boundaries: { color: '#cbd5e1', visible: true },
    labels: { color: '#334155', visible: true },
    railways: { color: '#cbd5e1', visible: true },
    paths: { color: '#f1f5f9', visible: true },
    waterways: { color: '#bae6fd', visible: true },
    landuse: { color: '#eef2f7', visible: true },
    aeroways: { color: '#e2e8f0', visible: true }
  },
  terrain: {
    background: { color: '#f4f1ea', visible: true },
    roads: { color: '#e5e7eb', visible: true },
    highways: { color: '#f59e0b', visible: true },
    arterial: { color: '#cbd5e1', visible: true },
    localRoads: { color: '#f3f4f6', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#38bdf8', visible: true },
    buildings: { color: '#cbd5e1', visible: true },
    parks: { color: '#86efac', visible: true },
    boundaries: { color: '#f87171', visible: true },
    labels: { color: '#1e293b', visible: true },
    railways: { color: '#94a3b8', visible: true },
    paths: { color: '#d6d3d1', visible: true },
    waterways: { color: '#38bdf8', visible: true },
    landuse: { color: '#ede9df', visible: true },
    aeroways: { color: '#e5e7eb', visible: true }
  },
  satellite: {
    background: { color: '#022c22', visible: true },
    roads: { color: '#fbbf24', visible: true },
    highways: { color: '#f59e0b', visible: true },
    arterial: { color: '#fbbf24', visible: true },
    localRoads: { color: '#fef08a', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#0369a1', visible: true },
    buildings: { color: '#94a3b8', visible: true },
    parks: { color: '#047857', visible: true },
    boundaries: { color: '#ef4444', visible: true },
    labels: { color: '#ffffff', visible: true },
    railways: { color: '#e5e7eb', visible: true },
    paths: { color: '#fde68a', visible: true },
    waterways: { color: '#0ea5e9', visible: true },
    landuse: { color: '#064e3b', visible: true },
    aeroways: { color: '#d1d5db', visible: true }
  },
  custom: {
    background: { color: '#0f172a', visible: true },
    roads: { color: '#f59e0b', visible: true },
    highways: { color: '#f97316', visible: true },
    arterial: { color: '#eab308', visible: true },
    localRoads: { color: '#64748b', visible: true },
    showDenseRoadsAtZoomOut: true,
    water: { color: '#0ea5e9', visible: true },
    buildings: { color: '#64748b', visible: true },
    parks: { color: '#10b981', visible: true },
    boundaries: { color: '#ef4444', visible: true },
    labels: { color: '#f8fafc', visible: true },
    railways: { color: '#94a3b8', visible: true },
    paths: { color: '#475569', visible: true },
    waterways: { color: '#0ea5e9', visible: true },
    landuse: { color: '#1e293b', visible: true },
    aeroways: { color: '#334155', visible: true }
  }
};


/**
 * Race Poster Dark: charcoal land, near-black water, grey road hierarchy, no labels.
 * Built on OpenFreeMap vector tiles (OpenStreetMap data, free for commercial use with credit).
 * Layer ids and source-layers let the Layers panel recolour and toggle every group.
 */
const lineW = (stops: [number, number][]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()];
const isClass = (classes: string[]) => ['match', ['get', 'class'], classes, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const roundLine = { 'line-cap': 'round', 'line-join': 'round' };
const OMT = { source: 'openmaptiles' };

export const RACE_DARK_STYLE = {
  version: 8,
  name: 'Race Poster Dark',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '&copy; OpenFreeMap &copy; OpenStreetMap contributors'
    }
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#2b2b2b' } },
    { ...OMT, id: 'landuse', type: 'fill', 'source-layer': 'landuse', paint: { 'fill-color': '#2d2d2d' } },
    { ...OMT, id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': '#2f2f2f' } },
    { ...OMT, id: 'landcover-wood', type: 'fill', 'source-layer': 'landcover', filter: isClass(['wood', 'grass']), paint: { 'fill-color': '#2f2f2f' } },
    { ...OMT, id: 'aeroway-area', type: 'fill', 'source-layer': 'aeroway', filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false], paint: { 'fill-color': '#3a3a3a' } },
    { ...OMT, id: 'aeroway-runway', type: 'line', 'source-layer': 'aeroway', filter: isClass(['runway', 'taxiway']), paint: { 'line-color': '#3a3a3a', 'line-width': lineW([[10, 1], [14, 8], [16, 30]]) } },
    { ...OMT, id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#1a1a1a' } },
    { ...OMT, id: 'waterway', type: 'line', 'source-layer': 'waterway', paint: { 'line-color': '#1a1a1a', 'line-width': lineW([[8, 0.5], [12, 1.5], [16, 5]]) } },
    { ...OMT, id: 'building', type: 'fill', 'source-layer': 'building', minzoom: 13, layout: { visibility: 'none' }, paint: { 'fill-color': '#313131' } },
    { ...OMT, id: 'path-pedestrian', type: 'line', 'source-layer': 'transportation', minzoom: 13, filter: ['all', notTunnel, isClass(['path', 'pedestrian', 'track'])], layout: roundLine, paint: { 'line-color': '#535353', 'line-width': lineW([[13, 0.3], [16, 1.2]]) } },
    { ...OMT, id: 'rail', type: 'line', 'source-layer': 'transportation', minzoom: 9, filter: ['all', notTunnel, isClass(['rail', 'transit'])], paint: { 'line-color': '#505050', 'line-width': lineW([[9, 0.4], [13, 1], [16, 2]]) } },
    { ...OMT, id: 'road-minor', type: 'line', 'source-layer': 'transportation', minzoom: 11, filter: ['all', notTunnel, isClass(['minor', 'service', 'busway'])], layout: roundLine, paint: { 'line-color': '#5f5f5f', 'line-width': lineW([[11, 0.25], [13, 0.6], [15, 1.6], [17, 5]]) } },
    { ...OMT, id: 'road-secondary-tertiary', type: 'line', 'source-layer': 'transportation', minzoom: 8, filter: ['all', notTunnel, isClass(['secondary', 'tertiary'])], layout: roundLine, paint: { 'line-color': '#8d8d8d', 'line-width': lineW([[8, 0.3], [11, 0.7], [13, 1.4], [16, 4.5]]) } },
    { ...OMT, id: 'road-primary', type: 'line', 'source-layer': 'transportation', minzoom: 6, filter: ['all', notTunnel, isClass(['primary'])], layout: roundLine, paint: { 'line-color': '#8d8d8d', 'line-width': lineW([[6, 0.4], [10, 0.9], [13, 1.9], [16, 6]]) } },
    { ...OMT, id: 'road-motorway-trunk', type: 'line', 'source-layer': 'transportation', minzoom: 5, filter: ['all', notTunnel, isClass(['motorway', 'trunk'])], layout: roundLine, paint: { 'line-color': '#bcbcbc', 'line-width': lineW([[5, 0.5], [9, 1], [12, 2], [16, 7]]) } },
    { ...OMT, id: 'boundary', type: 'line', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4], layout: { visibility: 'none' }, paint: { 'line-color': '#3d3d3d', 'line-dasharray': [2, 2] } }
  ]
};

export const BUILTIN_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'race-dark',
    name: 'Race Poster Dark',
    description: 'Charcoal land, black water and grey road hierarchy with no labels (default)',
    styleUrlOrSpec: RACE_DARK_STYLE,
    previewColor: '#2b2b2b',
    defaultLayers: PRESET_DEFAULT_LAYERS['race-dark']
  },
  {
    id: 'dark',
    name: 'Dark Monochrome',
    description: 'Sleek dark high-contrast style for modern wall art and 3D prints',
    styleUrlOrSpec: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    previewColor: '#1e293b',
    defaultLayers: PRESET_DEFAULT_LAYERS.dark
  },
  {
    id: 'light',
    name: 'Light Monochrome',
    description: 'Crisp, clean neutral minimalist architectural aesthetic',
    styleUrlOrSpec: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    previewColor: '#f8fafc',
    defaultLayers: PRESET_DEFAULT_LAYERS.light
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Ultra-clean roads and geography with muted soft accents',
    styleUrlOrSpec: 'https://tiles.openfreemap.org/styles/positron',
    previewColor: '#e2e8f0',
    defaultLayers: PRESET_DEFAULT_LAYERS.minimal
  },
  {
    id: 'terrain',
    name: 'Topographic Terrain',
    description: 'Detailed elevation contours, hillshading and natural topography',
    styleUrlOrSpec: {
      version: 8,
      sources: {
        'topo-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri, USGS'
        }
      },
      layers: [
        {
          id: 'topo-layer',
          type: 'raster',
          source: 'topo-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    },
    previewColor: '#dcfce7',
    defaultLayers: PRESET_DEFAULT_LAYERS.terrain
  },
  {
    id: 'satellite',
    name: 'Satellite Imagery',
    description: 'High-resolution global satellite photography',
    styleUrlOrSpec: {
      version: 8,
      sources: {
        'sat-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Imagery &copy; Esri, Maxar'
        }
      },
      layers: [
        {
          id: 'sat-layer',
          type: 'raster',
          source: 'sat-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    },
    previewColor: '#064e3b',
    defaultLayers: PRESET_DEFAULT_LAYERS.satellite
  },
  {
    id: 'custom',
    name: 'Custom Palette',
    description: 'Fully customizable colors and layer toggles for roads, water, buildings & parks',
    styleUrlOrSpec: 'https://tiles.openfreemap.org/styles/liberty',
    previewColor: '#8b5cf6',
    defaultLayers: PRESET_DEFAULT_LAYERS.custom
  }
];

export const DEFAULT_LAYER_STYLES: LayerStyle = PRESET_DEFAULT_LAYERS['race-dark'];

const USER_PRESETS_STORAGE_KEY = 'mapcraft_user_style_presets_v1';

export function loadUserPresets(): StylePreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load user presets:', e);
    return [];
  }
}

export function saveUserPreset(preset: StylePreset) {
  const current = loadUserPresets();
  const existingIdx = current.findIndex((p) => p.id === preset.id);
  let updated: StylePreset[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = preset;
  } else {
    updated = [...current, preset];
  }
  try {
    localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save user presets:', e);
  }
  return updated;
}

export function deleteUserPreset(presetId: string): StylePreset[] {
  const current = loadUserPresets();
  const updated = current.filter((p) => p.id !== presetId);
  try {
    localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete user preset:', e);
  }
  return updated;
}

type LayerCategory =
  | 'labels' | 'background' | 'railways' | 'paths' | 'highways' | 'arterial' | 'localRoads' | 'roads'
  | 'aeroways' | 'waterways' | 'water' | 'buildings' | 'parks' | 'landuse' | 'boundaries';

const ROAD_SUBS: LayerCategory[] = ['highways', 'arterial', 'localRoads', 'roads'];
/** Groups the High Road Density toggle forces visible when zoomed out. */
const DENSE_CATS: LayerCategory[] = [...ROAD_SUBS, 'paths', 'railways'];

/** Decides which Layers-panel group a base-map layer belongs to (source-layer first, then id words). */
export function classifyLayer(layer: any): LayerCategory | null {
  const id = String(layer.id || '').toLowerCase();
  const type = layer.type;
  const sl = String(layer['source-layer'] || '').toLowerCase();
  const has = (...w: string[]) => w.some((x) => id.includes(x));

  if (id.startsWith('gpx-') || type === 'raster' || type === 'hillshade') return null;
  if (type === 'symbol' || has('label', 'place', 'name', 'shield', 'poi', 'housenumber')) return 'labels';
  if (type === 'background') return 'background';

  const isTransport = sl === 'transportation' || has('road', 'street', 'highway', 'motorway', 'trunk', 'bridge', 'tunnel', 'rail', 'transit', 'path');
  if (isTransport && has('rail', 'transit', 'subway', 'tram', 'metro')) return 'railways';
  if (isTransport && has('path', 'pedestrian', 'footway', 'cycleway', 'steps', 'track', 'bridleway')) return 'paths';
  if (sl === 'aeroway' || has('aeroway', 'runway', 'taxiway', 'airport')) return 'aeroways';
  if (sl === 'waterway' || has('waterway', 'river', 'stream', 'canal')) return 'waterways';
  if (sl === 'water' || has('water', 'ocean', 'lake', 'sea')) return 'water';
  if (sl === 'building' || has('building', 'structure')) return 'buildings';
  if (sl === 'park' || sl === 'landcover' || has('park', 'forest', 'green', 'landcover', 'wood', 'grass')) return 'parks';
  if (sl === 'landuse' || has('landuse')) return 'landuse';
  if (sl === 'boundary' || has('boundary', 'admin', 'border')) return 'boundaries';

  if (isTransport || has('primary', 'secondary', 'tertiary', 'minor', 'service', 'residential')) {
    if (has('motorway', 'trunk', 'highway', 'freeway')) return 'highways';
    if (has('primary', 'secondary', 'arterial', 'tertiary')) return 'arterial';
    if (has('minor', 'street', 'residential', 'living', 'service', 'unclassified')) return 'localRoads';
    return 'roads';
  }
  return null;
}

/**
 * Applies the Layers panel (visibility + colour per group) to the current base map.
 * Groups missing from an older saved style are left as the base map draws them.
 */
export function applyCustomLayerStyles(map: any, styles: LayerStyle) {
  if (!map) return;

  let layers: any[] = [];
  try {
    layers = map.getStyle()?.layers || [];
  } catch (e) {
    return; // style still loading; the caller re-applies once it is ready
  }

  const canPaint = (cat: string) => !styles.nativeColors || (styles.editedColors || []).includes(cat);
  const setVis = (layerId: string, on: boolean) => {
    try { map.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none'); } catch (e) { /* ignore */ }
  };
  const setColor = (layer: any, color: string) => {
    const prop =
      layer.type === 'line' ? 'line-color'
      : layer.type === 'fill' ? 'fill-color'
      : layer.type === 'fill-extrusion' ? 'fill-extrusion-color'
      : layer.type === 'background' ? 'background-color'
      : layer.type === 'circle' ? 'circle-color'
      : layer.type === 'symbol' ? 'text-color'
      : null;
    if (!prop) return;
    if (prop === 'text-color' && map.getPaintProperty(layer.id, 'text-color') === undefined) return;
    try { map.setPaintProperty(layer.id, prop, color); } catch (e) { /* ignore */ }
  };

  if (!map.__mapcraftOrigMinzoom) map.__mapcraftOrigMinzoom = {};
  const origMin: Record<string, number> = map.__mapcraftOrigMinzoom;

  layers.forEach((layer: any) => {
    const cat = classifyLayer(layer);
    if (!cat) return;

    const group = (styles as any)[cat] as { color: string; visible: boolean } | undefined;
    const roadsMaster = styles.roads;

    let visible: boolean;
    let color: string | undefined;
    if (ROAD_SUBS.includes(cat)) {
      const sub = group || roadsMaster;
      visible = (roadsMaster?.visible ?? true) && (sub?.visible ?? true);
      color = sub?.color || roadsMaster?.color;
    } else {
      if (!group) return; // older saved style without this group: leave the base map as drawn
      visible = group.visible;
      color = group.color;
    }

    setVis(layer.id, visible);
    if (visible && color && canPaint(cat)) setColor(layer, color);

    // High Road Density: let all roads, footpaths and rail draw when zoomed out
    if (DENSE_CATS.includes(cat)) {
      if (origMin[layer.id] === undefined) origMin[layer.id] = layer.minzoom ?? 0;
      const target = styles.showDenseRoadsAtZoomOut ? Math.min(origMin[layer.id], 8) : origMin[layer.id];
      try { map.setLayerZoomRange(layer.id, target, layer.maxzoom ?? 24); } catch (e) { /* ignore */ }
    }
  });
}
