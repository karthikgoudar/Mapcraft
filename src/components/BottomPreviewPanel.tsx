import React, { useState } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Box, 
  Check, 
  Copy,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { MapFrame, RouteStyle } from '../types';
import { ProjectedSegment } from '../utils/geoAlignment';
import { generateSVG } from '../utils/svgGenerator';

interface BottomPreviewPanelProps {
  frame: MapFrame;
  routeStyle: RouteStyle;
  projectedSegments: ProjectedSegment[];
  mapCanvasDataUrl: string | null;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  onExportRouteSVG: () => void;
  onExportMapOnlyPoster: () => void;
  onExportCombinedPoster: () => void;
  onOpen3D: () => void;
  insidePercent: number;
}

export const BottomPreviewPanel: React.FC<BottomPreviewPanelProps> = ({
  frame,
  routeStyle,
  projectedSegments,
  mapCanvasDataUrl,
  isLeftPanelOpen,
  isRightPanelOpen,
  onExportRouteSVG,
  onExportMapOnlyPoster,
  onExportCombinedPoster,
  onOpen3D,
  insidePercent
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'route-only' | 'combined' | 'dimensions' | 'code'>('route-only');
  const [previewZoom, setPreviewZoom] = useState(1.0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Generate SVGs
  const routeOnlySvgString = generateSVG({
    frame,
    segments: projectedSegments,
    routeStyle,
    exportType: 'route-only'
  });

  const combinedSvgString = generateSVG({
    frame,
    segments: projectedSegments,
    routeStyle,
    includeMapRaster: mapCanvasDataUrl || undefined,
    exportType: 'combined'
  });

  const handleCopySvg = () => {
    navigator.clipboard.writeText(activeTab === 'combined' ? combinedSvgString : routeOnlySvgString);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isClipped = insidePercent < 99;

  return (
    <div
      style={{
        left: isLeftPanelOpen ? '20rem' : '0',
        right: isRightPanelOpen ? '20rem' : '0'
      }}
      className={`fixed bottom-0 z-20 bg-slate-900 border-t border-slate-800 transition-all duration-300 shadow-2xl flex flex-col ${
        isExpanded ? 'h-96' : 'h-10'
      }`}
    >
      {/* Top Header Bar / Toggle Tab */}
      <div className="h-10 px-3 flex items-center justify-between bg-slate-950/80 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Proofing & Preview</span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              ({frame.widthMm} × {frame.heightMm} mm)
            </span>
          </button>

          {isClipped && (
            <span className="hidden sm:flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/30">
              <AlertTriangle className="w-2.5 h-2.5" />
              Clipped ({insidePercent.toFixed(0)}%)
            </span>
          )}
        </div>

        {/* Tab Switchers (When Expanded) */}
        {isExpanded && (
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setActiveTab('route-only')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'route-only' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trail SVG
            </button>
            <button
              onClick={() => setActiveTab('combined')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'combined' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Combined
            </button>
            <button
              onClick={() => setActiveTab('dimensions')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'dimensions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Physical Proof
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                activeTab === 'code' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SVG Code
            </button>
          </div>
        )}

        {/* Quick Export Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onExportRouteSVG}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
            title="Download Route-Only SVG (exact mm for Blender & 3D Print)"
          >
            <Download className="w-3 h-3" />
            <span>Trail SVG</span>
          </button>

          <button
            onClick={onExportMapOnlyPoster}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Download Map-Only Poster for Canva"
          >
            <ImageIcon className="w-3 h-3 text-cyan-400" />
            <span>Map Poster</span>
          </button>
        </div>
      </div>

      {/* Expanded Body Content */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden p-3 flex gap-3">
          {/* Main Preview Canvas Area */}
          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex items-center justify-center">
            {/* Zoom Controls */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setPreviewZoom((z) => Math.min(4.0, z + 0.25))}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] text-slate-300 px-1">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                onClick={() => setPreviewZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPreviewZoom(1.0)}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TAB: ROUTE-ONLY */}
            {activeTab === 'route-only' && (
              <div
                className="relative overflow-auto max-w-full max-h-full p-4 flex items-center justify-center transition-transform"
                style={{
                  backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              >
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    width: `${frame.widthMm * 1.3}px`,
                    height: `${frame.heightMm * 1.3}px`
                  }}
                  className="border border-emerald-500/40 bg-slate-900/60 shadow-2xl relative rounded-sm"
                  dangerouslySetInnerHTML={{ __html: routeOnlySvgString }}
                />
              </div>
            )}

            {/* TAB: COMBINED */}
            {activeTab === 'combined' && (
              <div className="relative overflow-auto max-w-full max-h-full p-4 flex items-center justify-center">
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    width: `${frame.widthMm * 1.3}px`,
                    height: `${frame.heightMm * 1.3}px`
                  }}
                  className="border border-slate-700 bg-slate-900 shadow-2xl relative rounded-sm"
                  dangerouslySetInnerHTML={{ __html: combinedSvgString }}
                />
              </div>
            )}

            {/* TAB: PHYSICAL PROOF */}
            {activeTab === 'dimensions' && (
              <div className="relative overflow-auto max-w-full max-h-full p-6 flex items-center justify-center text-xs">
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'center center',
                    width: `${frame.widthMm * 1.5}px`,
                    height: `${frame.heightMm * 1.5}px`
                  }}
                  className="border-2 border-emerald-400 bg-slate-900/90 relative p-3 flex flex-col justify-between"
                >
                  <div className="flex justify-between text-[9px] font-mono text-emerald-400">
                    <span>NW: {frame.corners.nw[1].toFixed(3)}°</span>
                    <span>NE: {frame.corners.ne[1].toFixed(3)}°</span>
                  </div>
                  <div className="text-center font-mono text-white text-xs">
                    <div className="font-bold">{frame.widthMm} mm × {frame.heightMm} mm</div>
                    <div className="text-slate-400 text-[10px]">Trail Width: {routeStyle.strokeWidthMm} mm</div>
                    <div className="text-emerald-400 text-[10px] mt-1">Conformal Web Mercator</div>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-emerald-400">
                    <span>SW: {frame.corners.sw[1].toFixed(3)}°</span>
                    <span>SE: {frame.corners.se[1].toFixed(3)}°</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SVG CODE INSPECTOR */}
            {activeTab === 'code' && (
              <div className="w-full h-full p-3 flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-slate-400">Exact Millimeter SVG Source</span>
                  <button
                    onClick={handleCopySvg}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-mono transition"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="flex-1 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-auto select-text leading-tight">
                  {routeOnlySvgString}
                </pre>
              </div>
            )}
          </div>

          {/* Right Info Box */}
          <div className="w-56 bg-slate-950/60 rounded-xl border border-slate-800 p-2.5 flex flex-col justify-between text-xs">
            <div>
              <div className="font-semibold text-slate-200 mb-2">Proofing Details</div>
              <div className="space-y-1 text-[10px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Size:</span>
                  <span className="font-mono text-white font-semibold">{frame.widthMm} × {frame.heightMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trail Stroke:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{routeStyle.strokeWidthMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ViewBox:</span>
                  <span className="font-mono text-white">0 0 {frame.widthMm} {frame.heightMm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Segments:</span>
                  <span className="font-mono text-white">{projectedSegments.length} visible</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <button
                onClick={onExportRouteSVG}
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3 h-3" />
                <span>Save Trail SVG</span>
              </button>
              <button
                onClick={onExportMapOnlyPoster}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center justify-center gap-1 transition"
              >
                <ImageIcon className="w-3 h-3 text-cyan-400" />
                <span>Save Map Poster</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
