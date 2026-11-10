export interface RoutePoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  distFromStartKm?: number;
}

export interface RouteTrack {
  id: string;
  name: string;
  segments: RoutePoint[][];
  color?: string;
}

export interface RouteStats {
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  pointsCount: number;
  segmentsCount: number;
  clippedPointsCount?: number;
  percentInFrame?: number;
}

export type MapStyleId = 'dark' | 'light' | 'minimal' | 'terrain' | 'satellite' | 'custom';

export interface LayerStyle {
  roads: { color: string; visible: boolean };
  highways: { color: string; visible: boolean };
  arterial: { color: string; visible: boolean };
  localRoads: { color: string; visible: boolean };
  showDenseRoadsAtZoomOut: boolean;
  water: { color: string; visible: boolean };
  buildings: { color: string; visible: boolean };
  parks: { color: string; visible: boolean };
  boundaries: { color: string; visible: boolean };
  labels: { color: string; visible: boolean };
  background: { color: string; visible: boolean };
  /** Extra layer groups (optional so older saved projects still load). */
  railways?: { color: string; visible: boolean };
  paths?: { color: string; visible: boolean };
  waterways?: { color: string; visible: boolean };
  landuse?: { color: string; visible: boolean };
  aeroways?: { color: string; visible: boolean };
  /** Keep the base map's own colours; only categories listed in editedColors are repainted. */
  nativeColors?: boolean;
  /** Layer categories whose colour the user changed in the Layers panel. */
  editedColors?: string[];
}

export interface MapFrame {
  widthMm: number;
  heightMm: number;
  unit: 'mm' | 'cm';
  aspectLocked: boolean;
  center: [number, number]; // [lon, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
  corners: {
    nw: [number, number];
    ne: [number, number];
    se: [number, number];
    sw: [number, number];
  };
  screenRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RouteStyle {
  color: string;
  strokeWidthMm: number; // in physical mm (default 2 mm)
  opacity: number;
  showStartMarker: boolean;
  showFinishMarker: boolean;
  showDirectionArrows: boolean;
  arrowSpacingMm: number;
  startMarkerColor: string;
  finishMarkerColor: string;
  glow: boolean;
  glowColor: string;
}

export interface ThreeDConfig {
  trailWidthMm: number; // default 2
  extrusionHeightMm: number; // default 7
  baseThicknessMm: number; // default 0 (no base) or >0
  baseMarginMm: number;
  brimWidthMm?: number; // 0 = none, 3 = peelable 0.2mm first-layer bed adhesion brim
  cornerStyle: 'round' | 'miter' | 'bevel';
  endCapStyle: 'round' | 'flat' | 'arrow';
  upperEdge: 'flat' | 'rounded' | 'chamfer';
  printerBed: {
    name: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
}

export interface PrintabilityIssue {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  fix?: string;
}

export interface PrintabilityReport {
  isPrintable: boolean;
  minWidthMm: number;
  isWatertight: boolean;
  hasFlatBottom: boolean;
  componentCount: number;
  dimensionsMm: {
    width: number;
    height: number;
    depth: number;
  };
  fitsBuildVolume: boolean;
  issues: PrintabilityIssue[];
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  frame: {
    widthMm: number;
    heightMm: number;
    unit: 'mm' | 'cm';
    aspectLocked: boolean;
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  styleId: string;
  layerStyles: LayerStyle;
  routeStyle: RouteStyle;
  threeDConfig: ThreeDConfig;
  rawGpx?: string;
  fileName?: string;
}
