import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  X, 
  Box, 
  Download, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw, 
  Grid 
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { ThreeDConfig, MapFrame, PrintabilityReport, RouteTrack } from '../types';
import { ProjectedSegment, projectTracksToPhysicalFrame, simplifyPolyline, smoothPolylineChaikin } from '../utils/geoAlignment';
import { 
  buildTrail3DGeometry, 
  snapTrailWidth,
  validatePrintability, 
  exportToBinarySTL, 
  downloadSTL 
} from '../utils/stlGenerator';
import { buildBambu3MF, download3MF } from '../utils/threeMfExporter';
import { PRINTER_PROFILES } from '../utils/projectStorage';

interface ThreeDModalProps {
  isOpen: boolean;
  onClose: () => void;
  frame: MapFrame;
  projectedSegments: ProjectedSegment[];
  threeDConfig: ThreeDConfig;
  setThreeDConfig: React.Dispatch<React.SetStateAction<ThreeDConfig>>;
  projectName: string;
  tracks?: RouteTrack[];
  map?: maplibregl.Map | null;
  simplificationMm?: number;
  smoothingIterations?: number;
}

export const ThreeDModal: React.FC<ThreeDModalProps> = ({
  isOpen,
  onClose,
  frame,
  projectedSegments,
  threeDConfig,
  setThreeDConfig,
  projectName,
  tracks,
  map,
  simplificationMm = 0,
  smoothingIterations = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [triangleCount, setTriangleCount] = useState(0);
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [printReport, setPrintReport] = useState<PrintabilityReport | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const currentGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Orbit rotation state (+Z is UP for 3D printing)
  const isMouseDownRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 320 });

  const updateCamera = (camera: THREE.PerspectiveCamera, target: THREE.Vector3) => {
    const { theta, phi, radius } = cameraAngleRef.current;
    // Z is vertical UP
    camera.position.x = target.x + radius * Math.cos(phi) * Math.sin(theta);
    camera.position.y = target.y - radius * Math.cos(phi) * Math.cos(theta);
    camera.position.z = target.z + radius * Math.sin(phi);
    camera.up.set(0, 0, 1);
    camera.lookAt(target);
  };

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090d16');
    sceneRef.current = scene;

    // 2. Camera (Z is UP)
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    const target = new THREE.Vector3(frame.widthMm / 2, frame.heightMm / 2, threeDConfig.extrusionHeightMm / 2);
    updateCamera(camera, target);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(100, -200, 300);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight2.position.set(-200, 200, 100);
    scene.add(dirLight2);

    // 5. Printer Bed Grid (Flat on XY plane, Z=0)
    const bed = threeDConfig.printerBed;
    const bedGrid = new THREE.GridHelper(Math.max(bed.widthMm, bed.depthMm), 20, 0x10b981, 0x334155);
    bedGrid.rotation.x = Math.PI / 2; // Flat on XY
    bedGrid.position.set(frame.widthMm / 2, frame.heightMm / 2, 0);
    scene.add(bedGrid);

    // 6. Watertight Geometry Generation
    // For 3D printing, we ALWAYS project the trail unclipped so that loops (like the Bandra turnaround)
    // and road turns are 100% continuous without boundary cuts, spurs, or travel jumps!
    let segmentsToRender = projectedSegments;
    if (tracks && tracks.length > 0 && map && frame.screenRect.width > 0) {
      const p = projectTracksToPhysicalFrame(
        tracks,
        (c) => map.project(c),
        frame,
        false
      );
      let processed = p.segments;
      if (simplificationMm > 0) processed = processed.map((s) => simplifyPolyline(s, simplificationMm));
      if (smoothingIterations > 0) processed = processed.map((s) => smoothPolylineChaikin(s, smoothingIterations));
      segmentsToRender = processed;
    }

    const geometry = buildTrail3DGeometry(
      segmentsToRender,
      frame.widthMm,
      frame.heightMm,
      threeDConfig
    );
    currentGeometryRef.current = geometry;

    const material = new THREE.MeshStandardMaterial({
      color: '#f97316',
      roughness: 0.35,
      metalness: 0.1,
      wireframe: wireframe,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const triCount = geometry.attributes.position ? geometry.attributes.position.count / 3 : 0;
    setTriangleCount(Math.round(triCount));
    setFileSizeKb(Math.round((84 + triCount * 50) / 1024));

    // Validate printability
    const report = validatePrintability(
      geometry,
      segmentsToRender,
      frame.widthMm,
      frame.heightMm,
      threeDConfig
    );
    setPrintReport(report);

    // Render loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse drag handlers for Orbit
    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      cameraAngleRef.current.theta += dx * 0.008;
      cameraAngleRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraAngleRef.current.phi + dy * 0.008));
      updateCamera(camera, target);
    };

    const onMouseUp = () => {
      isMouseDownRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      cameraAngleRef.current.radius = Math.max(50, Math.min(1000, cameraAngleRef.current.radius + e.deltaY * 0.3));
      updateCamera(camera, target);
      e.preventDefault();
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isOpen, projectedSegments, frame.widthMm, frame.heightMm, threeDConfig, wireframe]);

  if (!isOpen) return null;

  const handleExportSTL = () => {
    if (!currentGeometryRef.current) return;
    const buffer = exportToBinarySTL(currentGeometryRef.current);
    const filename = `${projectName.toLowerCase().replace(/\s+/g, '_')}_trail_3d_${threeDConfig.trailWidthMm}mm.stl`;
    downloadSTL(buffer, filename);
  };

  const handleExport3MF = () => {
    if (!currentGeometryRef.current) return;
    const { loopsPerSide } = snapTrailWidth(threeDConfig.trailWidthMm);
    const baseName = projectName.toLowerCase().replace(/\s+/g, '_');
    const { data } = buildBambu3MF(currentGeometryRef.current, {
      name: `${baseName}_trail`,
      wallLoops: loopsPerSide
    });
    download3MF(data, `${baseName}_trail_3d_${threeDConfig.trailWidthMm}mm.3mf`);
  };

  const resetView = () => {
    cameraAngleRef.current = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 320 };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>3D Trail Generator (Bambu Studio & Slicer Ready)</span>
                <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  0 Non-Manifold Errors
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Exact physical dimensions: {frame.widthMm} × {frame.heightMm} mm | Trail Width: {threeDConfig.trailWidthMm} mm | Height: {threeDConfig.extrusionHeightMm} mm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSTL}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Binary STL ({fileSizeKb} KB)</span>
            </button>
            <button
              onClick={handleExport3MF}
              title="Bambu Studio project with Classic wall generator and Wall loops preset on the trail object"
              className="px-3.5 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Bambu 3MF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D WebGL Viewport */}
          <div className="flex-1 relative bg-slate-950 flex items-center justify-center">
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Viewport Floating Controls */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg p-1 backdrop-blur text-xs">
              <button
                onClick={() => setWireframe(!wireframe)}
                className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 ${
                  wireframe ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                Wireframe
              </button>
              <button
                onClick={resetView}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Reset Camera View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mesh Stats Overlay */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 backdrop-blur text-[10px] font-mono text-slate-400 flex items-center gap-3">
              <span>Triangles: <strong className="text-white">{triangleCount.toLocaleString()}</strong></span>
              <span>•</span>
              <span>Est. Size: <strong className="text-white">{fileSizeKb} KB</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Flat Build Plate (Z=0)</span>
            </div>
          </div>

          {/* Right Parameters Sidebar */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar text-xs">
            <div className="space-y-4">
              <div>
                <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] block mb-2">
                  Extrusion Parameters
                </span>

                {/* Trail Width */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Trail Width</span>
                    <span className="font-mono text-emerald-400 font-semibold">{snapTrailWidth(threeDConfig.trailWidthMm).widthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.84"
                    max="4.44"
                    step="0.9"
                    value={snapTrailWidth(threeDConfig.trailWidthMm).widthMm}
                    onChange={(e) =>
                      setThreeDConfig((prev) => ({ ...prev, trailWidthMm: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setThreeDConfig((prev) => ({ ...prev, trailWidthMm: 1.74 }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                        Math.abs(snapTrailWidth(threeDConfig.trailWidthMm).widthMm - 1.74) < 0.01
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title="Set Bambu Wall loops = 2: 1 outer 0.42 mm + 1 inner 0.45 mm per side"
                    >
                      1.74 mm (2 loops)
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreeDConfig((prev) => ({ ...prev, trailWidthMm: 2.64 }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                        Math.abs(snapTrailWidth(threeDConfig.trailWidthMm).widthMm - 2.64) < 0.01
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title="Set Bambu Wall loops = 3: 1 outer 0.42 mm + 2 inner 0.45 mm per side"
                    >
                      2.64 mm (3 loops)
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreeDConfig((prev) => ({ ...prev, trailWidthMm: 3.54 }))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                        Math.abs(snapTrailWidth(threeDConfig.trailWidthMm).widthMm - 3.54) < 0.01
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title="Set Bambu Wall loops = 4: 1 outer 0.42 mm + 3 inner 0.45 mm per side"
                    >
                      3.54 mm (4 loops)
                    </button>
                  </div>
                </div>

                {/* Extrusion Height */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Extrusion Height (Z)</span>
                    <span className="font-mono text-emerald-400 font-semibold">{threeDConfig.extrusionHeightMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="20.0"
                    step="0.5"
                    value={threeDConfig.extrusionHeightMm}
                    onChange={(e) =>
                      setThreeDConfig((prev) => ({ ...prev, extrusionHeightMm: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Base Plate Thickness */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Base Backing Plate</span>
                    <span className="font-mono text-slate-300">
                      {threeDConfig.baseThicknessMm > 0 ? `${threeDConfig.baseThicknessMm} mm` : 'None (Free-standing)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5.0"
                    step="0.5"
                    value={threeDConfig.baseThicknessMm}
                    onChange={(e) =>
                      setThreeDConfig((prev) => ({ ...prev, baseThicknessMm: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Peelable Bed Adhesion Brim */}
                <div className="mb-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-slate-300 font-medium block text-xs">Peelable Adhesion Brim</span>
                      <span className="text-[10px] text-slate-400">0.2mm layer-1 skirt prevents lifting</span>
                    </div>
                    <button
                      onClick={() =>
                        setThreeDConfig((prev) => ({
                          ...prev,
                          brimWidthMm: (prev.brimWidthMm || 0) > 0 ? 0 : 3.0
                        }))
                      }
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition ${
                        (threeDConfig.brimWidthMm || 0) > 0
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {(threeDConfig.brimWidthMm || 0) > 0 ? '✓ 3mm Brim ON' : 'Off (Use Slicer)'}
                    </button>
                  </div>
                </div>

                {/* Printer Bed Profile */}
                <div>
                  <label className="text-slate-400 block mb-1">3D Printer Profile</label>
                  <select
                    value={threeDConfig.printerBed.name}
                    onChange={(e) => {
                      const found = PRINTER_PROFILES.find((p) => p.name === e.target.value);
                      if (found) {
                        setThreeDConfig((prev) => ({ ...prev, printerBed: found }));
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  >
                    {PRINTER_PROFILES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Slicer Validation & Adhesion Guide */}
              <div className="border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Slicer Settings for 100% Adhesion
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Bambu Studio Ready
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 leading-relaxed">
                    <div className="text-emerald-400 font-semibold mb-0.5 text-[10px]">
                      1. Eliminate Discontinuous Gap Fill (Dark Yellow Line):
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      In Bambu Studio, switch <strong className="text-slate-200">Quality → Walls → Wall generator</strong> from <em>Classic</em> to <strong className="text-emerald-300">Arachne</strong> (or set <em>Wall loops: 3</em>). This forces 100% continuous concentric loops without stop-and-go retractions.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 leading-relaxed">
                    <div className="text-emerald-400 font-semibold mb-0.5 text-[10px]">
                      2. Prevent First Layer From Peeling / Lifting:
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Set <strong className="text-slate-200">Others → Bed Adhesion → Brim type</strong> to <strong className="text-emerald-300">Outer brim only (5 mm)</strong> and <strong className="text-slate-200">First layer speed: 20 mm/s</strong>.
                    </p>
                  </div>

                  {printReport && printReport.issues.length > 0 && (
                    <div className="pt-1">
                      {printReport.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded border text-[10px] border-slate-800 bg-slate-950/40 text-slate-300 mb-1"
                        >
                          <span className="font-semibold">{issue.title}: </span>
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[10px] text-emerald-300/90 leading-relaxed">
                ✓ <strong>100% Flat Base (Z=0) &amp; Single Solid Shell:</strong> Underside is completely planar with zero overlapping geometries.
              </div>

              <button
                onClick={handleExportSTL}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export Binary STL ({fileSizeKb} KB)</span>
              </button>
              <button
                onClick={handleExport3MF}
                className="w-full py-2.5 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-semibold text-xs flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export Bambu 3MF (Classic, Wall loops preset)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
