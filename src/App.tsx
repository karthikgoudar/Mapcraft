import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import maplibregl from 'maplibre-gl';
import { 
  MapFrame, 
  MapStyleId, 
  LayerStyle, 
  RouteTrack, 
  RouteStyle, 
  ThreeDConfig, 
  RouteStats, 
  ProjectData, 
  PrintabilityReport 
} from './types';
import { 
  DEFAULT_FRAME, 
  DEFAULT_ROUTE_STYLE, 
  DEFAULT_3D_CONFIG, 
  loadProjectsList, 
  saveProjectsList 
} from './utils/projectStorage';
import { PRESET_DEFAULT_LAYERS } from './utils/mapStyles';
import { parseRouteFile, calculateRouteStats } from './utils/gpxParser';
import { 
  projectTracksToPhysicalFrame, 
  ProjectedSegment, 
  simplifyPolyline, 
  smoothPolylineChaikin 
} from './utils/geoAlignment';
import { generateSVG, downloadFile } from './utils/svgGenerator';
import { validatePrintability, buildTrail3DGeometry } from './utils/stlGenerator';
import { exportHighResPoster, renderPosterBlob } from './utils/highResExport';
import { exportToBinarySTL, downloadSTL } from './utils/stlGenerator';
import { LayoutStudio } from './components/LayoutStudio';

import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { FrameEdges } from './components/FrameCoordinatesEditor';
import { MapView } from './components/MapView';
import { RightSidebar } from './components/RightSidebar';
import { BottomPreviewPanel } from './components/BottomPreviewPanel';
import { ThreeDModal } from './components/ThreeDModal';
import { ProjectsModal } from './components/ProjectsModal';

export const App: React.FC = () => {
  // Navigation & Project metadata
  const [activeStep, setActiveStep] = useState(1);
  const [projectName, setProjectName] = useState('Untitled Map Project');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [isLayoutStudioOpen, setIsLayoutStudioOpen] = useState(false);

  // Panel Collapsible States
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Frame Minimizable / Visibility State
  const [isFrameVisible, setIsFrameVisible] = useState(true);

  // File input ref for top navbar trigger
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map & Frame state
  const [currentStyleId, setCurrentStyleId] = useState<string>('race-dark');
  const [layerStyles, setLayerStyles] = useState<LayerStyle>(PRESET_DEFAULT_LAYERS['race-dark']);
  const [frame, setFrame] = useState<MapFrame>(DEFAULT_FRAME);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  // GPX Track state
  const [tracks, setTracks] = useState<RouteTrack[]>([]);
  const [originalTracks, setOriginalTracks] = useState<RouteTrack[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [stats, setStats] = useState<RouteStats | null>(null);

  // Route styling state (Load saved style if present)
  const [routeStyle, setRouteStyle] = useState<RouteStyle>(() => {
    try {
      const saved = localStorage.getItem('mapcraft_saved_route_style_v1');
      return saved ? JSON.parse(saved) : DEFAULT_ROUTE_STYLE;
    } catch {
      return DEFAULT_ROUTE_STYLE;
    }
  });

  const [simplificationMm, setSimplificationMm] = useState(0);
  const [smoothingIterations, setSmoothingIterations] = useState(0);

  // 3D Config state
  const [threeDConfig, setThreeDConfig] = useState<ThreeDConfig>(DEFAULT_3D_CONFIG);

  // Computed projections
  const [projectedSegments, setProjectedSegments] = useState<ProjectedSegment[]>([]);
  const [insidePercent, setInsidePercent] = useState<number>(100);
  const [printReport, setPrintReport] = useState<PrintabilityReport | null>(null);
  const [mapCanvasDataUrl, setMapCanvasDataUrl] = useState<string | null>(null);

  // History stack
  const historyRef = useRef<Array<{ frame: MapFrame; routeStyle: RouteStyle; tracks: RouteTrack[] }>>([]);
  const historyIndexRef = useRef<number>(-1);

  // Load saved projects list on startup
  useEffect(() => {
    const loaded = loadProjectsList();
    setProjects(loaded);
  }, []);

  // Helper to recenter map and frame over any track geometry (Requirement #8)
  const centerMapAndFrameOnTracks = useCallback((newTracks: RouteTrack[]) => {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    newTracks.forEach((t) => {
      t.segments.forEach((s) => {
        s.forEach((pt) => {
          if (pt.lon < minLon) minLon = pt.lon;
          if (pt.lon > maxLon) maxLon = pt.lon;
          if (pt.lat < minLat) minLat = pt.lat;
          if (pt.lat > maxLat) maxLat = pt.lat;
        });
      });
    });

    if (minLon === Infinity || maxLon === -Infinity) return;

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    setFrame((prev) => ({
      ...prev,
      center: [centerLon, centerLat],
      bounds: { minLon, minLat, maxLon, maxLat },
      corners: {
        nw: [minLon, maxLat],
        ne: [maxLon, maxLat],
        se: [maxLon, minLat],
        sw: [minLon, minLat]
      }
    }));

    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat]
        ],
        { padding: 80, duration: 800 }
      );
    }
  }, []);

  // Load sample route helper
  const loadSampleRoute = async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/mumbai_marathon.gpx`);
      if (!response.ok) throw new Error('Sample GPX not found');
      const text = await response.text();
      const parsed = parseRouteFile(text, 'mumbai_marathon.gpx');
      setOriginalTracks(parsed);
      setTracks(parsed);
      setProjectName('Tata Mumbai Marathon 42.2k');

      const s = calculateRouteStats(parsed);
      setStats(s);

      centerMapAndFrameOnTracks(parsed);
      setIsFrameVisible(true);
    } catch (err) {
      console.warn('Could not load sample route:', err);
    }
  };

  // Universal File Upload Handler (Requirement #8: Centers on Berlin, London, etc.)
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseRouteFile(text, file.name);
        setOriginalTracks(parsed);
        setTracks(parsed);
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));

        const s = calculateRouteStats(parsed);
        setStats(s);

        // Center map & frame on the newly uploaded route
        centerMapAndFrameOnTracks(parsed);
        setIsFrameVisible(true);

        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      } catch (err: any) {
        alert('Error parsing route file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearRoute = () => {
    setTracks([]);
    setOriginalTracks([]);
    setStats(null);
    setProjectedSegments([]);
    setInsidePercent(100);
  };

  // Recompute projected physical millimeters whenever map viewport, frame, or tracks change
  const computeProjection = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || tracks.length === 0 || frame.screenRect.width === 0) {
      setProjectedSegments([]);
      setInsidePercent(100);
      return;
    }

    const projector = (coord: [number, number]) => {
      const p = map.project(coord);
      return { x: p.x, y: p.y };
    };

    const projected = projectTracksToPhysicalFrame(tracks, projector, frame, false);

    let processed = projected.segments;
    if (simplificationMm > 0) {
      processed = processed.map((seg) => simplifyPolyline(seg, simplificationMm));
    }
    if (smoothingIterations > 0) {
      processed = processed.map((seg) => smoothPolylineChaikin(seg, smoothingIterations));
    }

    setProjectedSegments(processed);

    const percent =
      projected.allPointsCount > 0
        ? (projected.insidePointsCount / projected.allPointsCount) * 100
        : 100;
    setInsidePercent(percent);
  }, [tracks, frame.screenRect.x, frame.screenRect.y, frame.screenRect.width, frame.screenRect.height, frame.widthMm, frame.heightMm, simplificationMm, smoothingIterations]);

  useEffect(() => {
    computeProjection();
  }, [computeProjection]);

  // Debounced 3D print validation to avoid lag during continuous map pan
  useEffect(() => {
    if (projectedSegments.length === 0) {
      setPrintReport(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        const geom = buildTrail3DGeometry(projectedSegments, frame.widthMm, frame.heightMm, threeDConfig);
        const rep = validatePrintability(geom, projectedSegments, frame.widthMm, frame.heightMm, threeDConfig);
        setPrintReport(rep);
      } catch (err) {
        console.warn('3D validation error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [projectedSegments, frame.widthMm, frame.heightMm, threeDConfig]);

  // Geocoding Search
  const handleSearchLocation = async (query: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [lon, lat],
            zoom: 12.5,
            duration: 1200
          });
        }
        setFrame((prev) => ({
          ...prev,
          center: [lon, lat]
        }));
      } else {
        alert(`Location "${query}" not found.`);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  const handleResetFrameToCenter = () => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    const mapCanvas = mapInstanceRef.current.getCanvas();
    const cWidth = mapCanvas ? mapCanvas.clientWidth : window.innerWidth;
    const cHeight = mapCanvas ? mapCanvas.clientHeight : window.innerHeight;

    setFrame((prev) => {
      const rectX = Math.round((cWidth - prev.screenRect.width) / 2);
      const rectY = Math.round((cHeight - prev.screenRect.height) / 2);
      return {
        ...prev,
        center: [center.lng, center.lat],
        screenRect: {
          ...prev.screenRect,
          x: Math.max(10, rectX),
          y: Math.max(10, rectY)
        }
      };
    });
  };

  // Manual coordinate entry: place the frame so its edges sit on the typed lat/lon
  const mercY = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
  };
  const mercYToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

  const handlePlaceFrameByEdges = ({ north, south, west, east }: FrameEdges) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const cw = map.getContainer().clientWidth;
    const ch = map.getContainer().clientHeight;
    const dx = (east - west) / 360; // normalised Mercator width
    const dy = mercY(south) - mercY(north); // normalised Mercator height

    let { x, y, width: rw, height: rh } = frame.screenRect;
    let heightMm = frame.heightMm;

    // Unlocked aspect: reshape the frame so all four corners land exactly.
    // Locked aspect: keep print size and fit the area inside the frame (one pair of edges extends).
    if (!frame.aspectLocked) {
      heightMm = Math.max(10, Math.min(2000, Math.round((frame.widthMm * dy) / dx)));
      rh = Math.round(rw * (heightMm / frame.widthMm));
      const maxW = cw - 20;
      const maxH = ch - 20;
      if (rw > maxW || rh > maxH) {
        const k = Math.min(maxW / rw, maxH / rh);
        rw = Math.round(rw * k);
        rh = Math.round(rh * k);
      }
      if (x + rw > cw - 10 || y + rh > ch - 10) {
        x = Math.max(10, Math.round((cw - rw) / 2));
        y = Math.max(10, Math.round((ch - rh) / 2));
      }
    }
    const rect = { x, y, width: rw, height: rh };

    const scale = Math.min(rw / dx, rh / dy); // world size in px
    const zoom = Math.log2(scale / 512);
    const center: [number, number] = [(west + east) / 2, mercYToLat((mercY(north) + mercY(south)) / 2)];

    setFrame((prev) => ({ ...prev, heightMm, screenRect: rect }));
    map.easeTo({
      center,
      zoom,
      bearing: 0,
      pitch: 0,
      offset: [x + rw / 2 - cw / 2, y + rh / 2 - ch / 2],
      duration: 700
    });
  };

  const handlePlaceFrameByCenter = (lat: number, lon: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const cw = map.getContainer().clientWidth;
    const ch = map.getContainer().clientHeight;
    const { x, y, width, height } = frame.screenRect;
    map.easeTo({
      center: [lon, lat],
      offset: [x + width / 2 - cw / 2, y + height / 2 - ch / 2],
      duration: 700
    });
  };

  const handleResetEdits = () => {
    setSimplificationMm(0);
    setSmoothingIterations(0);
    setTracks(originalTracks);
  };

  // SVG Export (Trail-only vector for Blender & 3D Print)
  const handleExportRouteSVG = () => {
    // For 3D printing and CAD vector export, use the unclipped continuous trail.
    // This guarantees the runner's course is 100% complete and uninterrupted,
    // with ZERO artificial boundary cuts, ZERO gaps, and ZERO spurs.
    let segmentsToExport = projectedSegments;
    if (tracks.length > 0 && mapInstanceRef.current) {
      const p = projectTracksToPhysicalFrame(
        tracks,
        (c) => mapInstanceRef.current!.project(c),
        frame,
        false
      );
      segmentsToExport = p.segments;
    }

    if (simplificationMm > 0) segmentsToExport = segmentsToExport.map((s) => simplifyPolyline(s, simplificationMm));
    if (smoothingIterations > 0) segmentsToExport = segmentsToExport.map((s) => smoothPolylineChaikin(s, smoothingIterations));

    const svg = generateSVG({
      frame,
      segments: segmentsToExport,
      routeStyle,
      exportType: 'route-only'
    });
    const filename = `${projectName.toLowerCase().replace(/\s+/g, '_')}_trail_vector_${frame.widthMm}x${frame.heightMm}mm.svg`;
    downloadFile(svg, filename, 'image/svg+xml');
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
  };

  // ---- Layout Studio hooks ----
  // Resize the frame to a layout's map area and fit it on screen, centred on the current map view
  const handleSetFrameSizeForLayout = (wMm: number, hMm: number) => {
    const map = mapInstanceRef.current;
    const cw = map ? map.getContainer().clientWidth : window.innerWidth;
    const ch = map ? map.getContainer().clientHeight : window.innerHeight;
    const k = Math.min((cw * 0.7) / wMm, (ch * 0.8) / hMm);
    const rw = Math.round(wMm * k);
    const rh = Math.round(hMm * k);
    setFrame((prev) => ({
      ...prev,
      widthMm: wMm,
      heightMm: hMm,
      aspectLocked: true,
      screenRect: { x: Math.round((cw - rw) / 2), y: Math.round((ch - rh) / 2), width: rw, height: rh }
    }));
    setIsFrameVisible(true);
    // nudge the map so the frame's geographic centre/corners are recalculated for the new rect
    if (map) setTimeout(() => map.jumpTo({ center: map.getCenter() }), 60);
  };

  const renderMapForLayout = (dpi: number) => {
    if (!mapInstanceRef.current) return Promise.reject(new Error('Map is not ready yet'));
    return renderPosterBlob({ map: mapInstanceRef.current, frame, dpi, includeRoute: false, layerStyles, filename: '' });
  };

  // Same trail geometry as the 3D modal (unclipped, with simplify/smooth edits), straight to STL
  const handleExportTrailSTL = () => {
    let segs = projectedSegments;
    if (tracks.length > 0 && mapInstanceRef.current && frame.screenRect.width > 0) {
      segs = projectTracksToPhysicalFrame(tracks, (c) => mapInstanceRef.current!.project(c), frame, false).segments;
      if (simplificationMm > 0) segs = segs.map((s) => simplifyPolyline(s, simplificationMm));
      if (smoothingIterations > 0) segs = segs.map((s) => smoothPolylineChaikin(s, smoothingIterations));
    }
    if (segs.length === 0) return;
    const geom = buildTrail3DGeometry(segs, frame.widthMm, frame.heightMm, threeDConfig);
    const buffer = exportToBinarySTL(geom);
    downloadSTL(buffer, `${projectName.toLowerCase().replace(/\s+/g, '_')}_trail_3d_${threeDConfig.trailWidthMm}mm.stl`);
    geom.dispose();
  };

  // 3D Modal Open Handler with On-The-Fly Projection Guarantee
  const handleOpen3D = () => {
    if (tracks.length > 0 && mapInstanceRef.current && frame.screenRect.width > 0) {
      const p = projectTracksToPhysicalFrame(
        tracks,
        (c) => mapInstanceRef.current!.project(c),
        frame,
        false
      );
      let processed = p.segments;
      if (simplificationMm > 0) processed = processed.map((s) => simplifyPolyline(s, simplificationMm));
      if (smoothingIterations > 0) processed = processed.map((s) => smoothPolylineChaikin(s, smoothingIterations));
      setProjectedSegments(processed);
    }
    setIs3DModalOpen(true);
  };

  // High-Resolution Map-Only Poster Export (True 300 DPI Offscreen Vector Rendering)
  const handleExportMapOnlyPoster = async (dpi: number = 300) => {
    if (!mapInstanceRef.current) return;
    const filename = `${projectName.toLowerCase().replace(/\s+/g, '_')}_map_poster_${dpi}dpi.png`;
    await exportHighResPoster({
      map: mapInstanceRef.current,
      frame,
      dpi,
      includeRoute: false,
      layerStyles,
      filename
    });
    confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 } });
  };

  // High-Resolution Combined Poster Export
  const handleExportCombinedPoster = async (dpi: number = 300) => {
    if (!mapInstanceRef.current) return;
    const filename = `${projectName.toLowerCase().replace(/\s+/g, '_')}_combined_poster_${dpi}dpi.png`;
    await exportHighResPoster({
      map: mapInstanceRef.current,
      frame,
      dpi,
      includeRoute: true,
      routeStyle,
      tracks,
      layerStyles,
      filename
    });
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
  };

  // Project management handlers
  const handleSaveCurrentProject = (name?: string) => {
    const finalName = name || projectName;
    const newProj: ProjectData = {
      id: `proj-${Date.now()}`,
      name: finalName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      frame: {
        widthMm: frame.widthMm,
        heightMm: frame.heightMm,
        unit: frame.unit,
        aspectLocked: frame.aspectLocked,
        center: frame.center,
        zoom: frame.zoom,
        bearing: frame.bearing,
        pitch: frame.pitch
      },
      styleId: currentStyleId,
      layerStyles,
      routeStyle,
      threeDConfig
    };
    const updated = [newProj, ...projects.filter((p) => p.name !== finalName)];
    setProjects(updated);
    saveProjectsList(updated);
    setProjectName(finalName);
    confetti({ particleCount: 30, spread: 45, origin: { y: 0.2 } });
  };

  const handleLoadProject = (proj: ProjectData) => {
    setProjectName(proj.name);
    setCurrentStyleId(proj.styleId);
    setLayerStyles(proj.layerStyles);
    setRouteStyle(proj.routeStyle);
    setThreeDConfig(proj.threeDConfig);
    setFrame((prev) => ({
      ...prev,
      widthMm: proj.frame.widthMm,
      heightMm: proj.frame.heightMm,
      unit: proj.frame.unit,
      aspectLocked: proj.frame.aspectLocked,
      center: proj.frame.center,
      zoom: proj.frame.zoom,
      bearing: proj.frame.bearing,
      pitch: proj.frame.pitch
    }));
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: proj.frame.center,
        zoom: proj.frame.zoom,
        bearing: proj.frame.bearing,
        pitch: proj.frame.pitch,
        duration: 800
      });
    }
    setIsProjectsModalOpen(false);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveProjectsList(updated);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        projectName={projectName}
        setProjectName={setProjectName}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        onSaveProject={() => handleSaveCurrentProject()}
        onOpenProjects={() => setIsProjectsModalOpen(true)}
        canUndo={historyIndexRef.current > 0}
        canRedo={historyIndexRef.current < historyRef.current.length - 1}
        onUndo={() => {}}
        onRedo={() => {}}
        onOpen3D={() => setIs3DModalOpen(true)}
        hasRoute={tracks.length > 0}
        isLeftPanelOpen={isLeftPanelOpen}
        setIsLeftPanelOpen={setIsLeftPanelOpen}
        isRightPanelOpen={isRightPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        isFrameVisible={isFrameVisible}
        setIsFrameVisible={setIsFrameVisible}
        onTriggerFileUpload={() => fileInputRef.current?.click()}
        onOpenLayoutStudio={() => setIsLayoutStudioOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar
          isOpen={isLeftPanelOpen}
          onToggleOpen={() => setIsLeftPanelOpen((v) => !v)}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          currentStyleId={currentStyleId}
          setCurrentStyleId={setCurrentStyleId}
          layerStyles={layerStyles}
          setLayerStyles={setLayerStyles}
          onSearchLocation={handleSearchLocation}
          frame={frame}
          setFrame={setFrame}
          isFrameVisible={isFrameVisible}
          setIsFrameVisible={setIsFrameVisible}
          onResetFrameToCenter={handleResetFrameToCenter}
          onPlaceFrameByEdges={handlePlaceFrameByEdges}
          onPlaceFrameByCenter={handlePlaceFrameByCenter}
          onSetFrameSize={handleSetFrameSizeForLayout}
          tracks={tracks}
          onFileUpload={handleFileUpload}
          onClearRoute={handleClearRoute}
          onLoadSample={loadSampleRoute}
          activeSegmentIndex={activeSegmentIndex}
          setActiveSegmentIndex={setActiveSegmentIndex}
          fileInputRef={fileInputRef}
          routeStyle={routeStyle}
          setRouteStyle={setRouteStyle}
          simplificationMm={simplificationMm}
          setSimplificationMm={setSimplificationMm}
          smoothingIterations={smoothingIterations}
          setSmoothingIterations={setSmoothingIterations}
          onResetEdits={handleResetEdits}
        />

        <MapView
          currentStyleId={currentStyleId}
          layerStyles={layerStyles}
          frame={frame}
          setFrame={setFrame}
          isFrameVisible={isFrameVisible}
          setIsFrameVisible={setIsFrameVisible}
          isLeftPanelOpen={isLeftPanelOpen}
          setIsLeftPanelOpen={setIsLeftPanelOpen}
          isRightPanelOpen={isRightPanelOpen}
          setIsRightPanelOpen={setIsRightPanelOpen}
          tracks={tracks}
          routeStyle={routeStyle}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
            computeProjection();
            map.on('move', () => computeProjection());
            map.on('moveend', () => {
              computeProjection();
              try {
                setMapCanvasDataUrl(map.getCanvas().toDataURL('image/png'));
              } catch (e) {
                // Ignore if context is tainted
              }
            });
          }}
        />

        <RightSidebar
          isOpen={isRightPanelOpen}
          onToggleOpen={() => setIsRightPanelOpen((v) => !v)}
          stats={stats}
          frame={frame}
          routeStyle={routeStyle}
          printReport={printReport}
          insidePercent={insidePercent}
          onExportRouteSVG={handleExportRouteSVG}
          onExportMapOnlyPoster={handleExportMapOnlyPoster}
          onExportCombinedPoster={handleExportCombinedPoster}
          onOpen3D={handleOpen3D}
          hasRoute={tracks.length > 0}
        />
      </div>

      {/* Bottom Proofing & Preview Drawer */}
      <BottomPreviewPanel
        frame={frame}
        routeStyle={routeStyle}
        projectedSegments={projectedSegments}
        mapCanvasDataUrl={mapCanvasDataUrl}
        isLeftPanelOpen={isLeftPanelOpen}
        isRightPanelOpen={isRightPanelOpen}
        onExportRouteSVG={handleExportRouteSVG}
        onExportMapOnlyPoster={() => handleExportMapOnlyPoster(300)}
        onExportCombinedPoster={() => handleExportCombinedPoster(300)}
        onOpen3D={handleOpen3D}
        insidePercent={insidePercent}
      />

      {/* 3D Trail Generator Modal */}
      <ThreeDModal
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        frame={frame}
        projectedSegments={projectedSegments}
        threeDConfig={threeDConfig}
        setThreeDConfig={setThreeDConfig}
        projectName={projectName}
        tracks={tracks}
        map={mapInstanceRef.current}
        simplificationMm={simplificationMm}
        smoothingIterations={smoothingIterations}
      />

      {/* Layout Studio: final poster layout + print PDF */}
      <LayoutStudio
        isOpen={isLayoutStudioOpen}
        onClose={() => setIsLayoutStudioOpen(false)}
        frame={frame}
        onSetFrameSize={handleSetFrameSizeForLayout}
        renderMap={renderMapForLayout}
        onExportTrailSVG={handleExportRouteSVG}
        onExportSTL={handleExportTrailSTL}
        hasRoute={tracks.length > 0}
        waterColor={layerStyles.water?.color}
      />

      {/* Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        onSaveCurrentAsNew={(name) => handleSaveCurrentProject(name)}
        onImportProject={(proj) => handleLoadProject(proj)}
        currentProjectName={projectName}
      />
    </div>
  );
};
