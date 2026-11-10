import { ProjectData, MapFrame, RouteStyle, ThreeDConfig, LayerStyle } from '../types';
import { DEFAULT_LAYER_STYLES } from './mapStyles';

const STORAGE_KEY = 'mapcraft_saved_projects_v1';
const CURRENT_PROJECT_KEY = 'mapcraft_current_project_v1';

export const DEFAULT_FRAME: MapFrame = {
  widthMm: 119,
  heightMm: 243,
  unit: 'mm',
  aspectLocked: true,
  center: [72.825, 18.985], // Center of Mumbai Marathon course
  zoom: 12.2,
  bearing: 0,
  pitch: 0,
  bounds: {
    minLon: 72.80,
    minLat: 18.91,
    maxLon: 72.86,
    maxLat: 19.05
  },
  corners: {
    nw: [72.80, 19.05],
    ne: [72.86, 19.05],
    se: [72.86, 18.91],
    sw: [72.80, 18.91]
  },
  screenRect: {
    x: 0,
    y: 0,
    width: 300,
    height: 612
  }
};

export const DEFAULT_ROUTE_STYLE: RouteStyle = {
  color: '#f97316', // Vibrant safety orange
  strokeWidthMm: 2.0, // default 2 mm
  opacity: 1.0,
  showStartMarker: true,
  showFinishMarker: true,
  showDirectionArrows: false,
  arrowSpacingMm: 20,
  startMarkerColor: '#22c55e',
  finishMarkerColor: '#ef4444',
  glow: true,
  glowColor: '#ea580c'
};

export const DEFAULT_3D_CONFIG: ThreeDConfig = {
  trailWidthMm: 1.74,
  extrusionHeightMm: 7.0,
  baseThicknessMm: 0, // default 0 mm (free-standing trail) or user can toggle base plate
  baseMarginMm: 4.0,
  brimWidthMm: 0, // 0 = standard, 3 = peelable bed adhesion brim
  cornerStyle: 'round',
  endCapStyle: 'round',
  upperEdge: 'rounded',
  printerBed: {
    name: 'Bambu Lab X1 / P1 / A1',
    widthMm: 256,
    depthMm: 256,
    heightMm: 256
  }
};

export const PRINTER_PROFILES = [
  { name: 'Bambu Lab X1 / P1 / A1 (256 × 256 × 256 mm)', widthMm: 256, depthMm: 256, heightMm: 256 },
  { name: 'Bambu Lab A1 Mini (180 × 180 × 180 mm)', widthMm: 180, depthMm: 180, heightMm: 180 },
  { name: 'Prusa MK3 / MK4 (250 × 210 × 220 mm)', widthMm: 250, depthMm: 210, heightMm: 220 },
  { name: 'Creality Ender 3 / V2 (220 × 220 × 250 mm)', widthMm: 220, depthMm: 220, heightMm: 250 },
  { name: 'Elegoo Neptune 4 Plus (320 × 320 × 385 mm)', widthMm: 320, depthMm: 320, heightMm: 385 },
  { name: 'Custom Large Format (400 × 400 × 400 mm)', widthMm: 400, depthMm: 400, heightMm: 400 }
];

export function saveProjectsList(projects: ProjectData[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save projects to localStorage:', err);
  }
}

export function loadProjectsList(): ProjectData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load projects:', err);
    return [];
  }
}

export function exportProjectToFile(project: ProjectData) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_project.mapcraft`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
