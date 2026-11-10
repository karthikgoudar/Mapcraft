import React, { useState } from 'react';
import { 
  Search, 
  Layers, 
  Maximize2, 
  Upload, 
  Sliders, 
  Palette, 
  Lock, 
  Unlock, 
  RotateCw, 
  Eye, 
  EyeOff, 
  Sparkles,
  Trash2,
  CheckCircle2,
  Plus,
  Save,
  Frame,
  Check
} from 'lucide-react';
import { LayerStyle, MapFrame, RouteStyle, RouteTrack } from '../types';
import { FrameCoordinatesEditor, FrameEdges } from './FrameCoordinatesEditor';
import { TEMPLATES } from '../layout/templates';

/** Frame presets = the map areas of the A4 Layout Studio designs (single source of truth). */
const FRAME_PRESETS = TEMPLATES.filter((t) => t.mapMm).map((t) => ({
  label: `${t.label.replace(' map | ', ' ')} (${t.mapMm!.w}\u00d7${t.mapMm!.h})`,
  w: t.mapMm!.w,
  h: t.mapMm!.h
}));
import { 
  BUILTIN_STYLE_PRESETS, 
  StylePreset, 
  PRESET_DEFAULT_LAYERS,
  saveUserPreset,
  deleteUserPreset,
  loadUserPresets
} from '../utils/mapStyles';

/** Display names for Layers panel groups. */
const LAYER_NAMES: Record<string, { name: string; hint?: string }> = {
  paths: { name: 'Footpaths & Cycleways', hint: 'Paths, pedestrian streets & tracks' },
  railways: { name: 'Railways & Metro', hint: 'Rail, metro & tram lines' },
  water: { name: 'Water' },
  waterways: { name: 'Rivers & Canals' },
  parks: { name: 'Parks & Green Areas' },
  landuse: { name: 'Land Use' },
  buildings: { name: 'Buildings' },
  aeroways: { name: 'Airports & Runways' },
  boundaries: { name: 'Boundaries' },
  labels: { name: 'Labels' },
  background: { name: 'Background' }
};

interface LeftSidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
  // Map styling
  currentStyleId: string;
  setCurrentStyleId: (id: string) => void;
  layerStyles: LayerStyle;
  setLayerStyles: React.Dispatch<React.SetStateAction<LayerStyle>>;
  onSearchLocation: (query: string) => Promise<void>;
  // Frame
  frame: MapFrame;
  setFrame: React.Dispatch<React.SetStateAction<MapFrame>>;
  isFrameVisible: boolean;
  setIsFrameVisible: React.Dispatch<React.SetStateAction<boolean>>;
  onResetFrameToCenter: () => void;
  onPlaceFrameByEdges: (edges: FrameEdges) => void;
  onPlaceFrameByCenter: (lat: number, lon: number) => void;
  onSetFrameSize?: (widthMm: number, heightMm: number) => void;
  // GPX
  tracks: RouteTrack[];
  onFileUpload: (file: File) => void;
  onClearRoute: () => void;
  onLoadSample: () => void;
  activeSegmentIndex: number | null;
  setActiveSegmentIndex: (idx: number | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  // Route styling
  routeStyle: RouteStyle;
  setRouteStyle: React.Dispatch<React.SetStateAction<RouteStyle>>;
  // Geometry edits
  simplificationMm: number;
  setSimplificationMm: (val: number) => void;
  smoothingIterations: number;
  setSmoothingIterations: (val: number) => void;
  onResetEdits: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onToggleOpen,
  activeStep,
  setActiveStep,
  currentStyleId,
  setCurrentStyleId,
  layerStyles,
  setLayerStyles,
  onSearchLocation,
  frame,
  setFrame,
  isFrameVisible,
  setIsFrameVisible,
  onResetFrameToCenter,
  onPlaceFrameByEdges,
  onPlaceFrameByCenter,
  onSetFrameSize,
  tracks,
  onFileUpload,
  onClearRoute,
  onLoadSample,
  activeSegmentIndex,
  setActiveSegmentIndex,
  fileInputRef,
  routeStyle,
  setRouteStyle,
  simplificationMm,
  setSimplificationMm,
  smoothingIterations,
  setSmoothingIterations,
  onResetEdits
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showLayerCustomizer, setShowLayerCustomizer] = useState(false);

  // Preset management state
  const [userPresets, setUserPresets] = useState<StylePreset[]>(() => loadUserPresets());
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Route style save state (Requirement #3)
  const [savedRouteStyleSuccess, setSavedRouteStyleSuccess] = useState(false);

  // Controlled string inputs for frame dimensions (allowing backspace & free typing)
  const [widthInput, setWidthInput] = useState<string>(() => String(frame.widthMm));
  const [heightInput, setHeightInput] = useState<string>(() => String(frame.heightMm));

  React.useEffect(() => {
    setWidthInput(String(frame.widthMm));
  }, [frame.widthMm]);

  React.useEffect(() => {
    setHeightInput(String(frame.heightMm));
  }, [frame.heightMm]);

  if (!isOpen) return null;

  const allPresets: StylePreset[] = [...BUILTIN_STYLE_PRESETS, ...userPresets];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      await onSearchLocation(searchQuery);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPreset = (preset: StylePreset) => {
    setCurrentStyleId(preset.id);
    const baseline = preset.defaultLayers || PRESET_DEFAULT_LAYERS[preset.id] || PRESET_DEFAULT_LAYERS.dark;
    setLayerStyles({ ...baseline });
  };

  const handleSaveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: StylePreset = {
      id: `custom-preset-${Date.now()}`,
      name: newPresetName.trim(),
      description: 'Custom user defined palette',
      styleUrlOrSpec: 'https://tiles.openfreemap.org/styles/liberty',
      previewColor: layerStyles.water.color || '#0ea5e9',
      isCustom: true,
      defaultLayers: { ...layerStyles }
    };
    const updated = saveUserPreset(newPreset);
    setUserPresets(updated.filter((p) => p.isCustom));
    setCurrentStyleId(newPreset.id);
    setNewPresetName('');
    setIsCreatingPreset(false);
  };

  const handleDeleteUserPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteUserPreset(id);
    setUserPresets(updated.filter((p) => p.isCustom));
    if (currentStyleId === id) {
      setCurrentStyleId('race-dark');
      setLayerStyles(PRESET_DEFAULT_LAYERS['race-dark']);
    }
  };

  const handleSaveRouteStyle = () => {
    try {
      localStorage.setItem('mapcraft_saved_route_style_v1', JSON.stringify(routeStyle));
      setSavedRouteStyleSuccess(true);
      setTimeout(() => setSavedRouteStyleSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to save route style:', e);
    }
  };

  const updateFrameDimension = (dimension: 'width' | 'height', val: number) => {
    const safeVal = Math.max(10, Math.min(2000, val));
    if (frame.aspectLocked && frame.widthMm > 0 && frame.heightMm > 0) {
      const currentRatio = frame.widthMm / frame.heightMm;
      if (dimension === 'width') {
        const computedH = Math.max(10, Math.min(2000, Math.round(safeVal / currentRatio)));
        setHeightInput(String(computedH));
        setFrame((prev) => ({
          ...prev,
          widthMm: safeVal,
          heightMm: computedH
        }));
      } else {
        const computedW = Math.max(10, Math.min(2000, Math.round(safeVal * currentRatio)));
        setWidthInput(String(computedW));
        setFrame((prev) => ({
          ...prev,
          heightMm: safeVal,
          widthMm: computedW
        }));
      }
    } else {
      setFrame((prev) => ({
        ...prev,
        [dimension === 'width' ? 'widthMm' : 'heightMm']: safeVal
      }));
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWidthInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 2000) {
      if (!frame.aspectLocked) {
        setFrame((prev) => ({
          ...prev,
          widthMm: Math.round(parsed)
        }));
      }
    }
  };

  const handleWidthBlur = () => {
    const parsed = parseFloat(widthInput);
    const safeW = isNaN(parsed) || parsed < 10 ? 10 : Math.min(2000, Math.round(parsed));
    setWidthInput(String(safeW));
    updateFrameDimension('width', safeW);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHeightInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 2000) {
      if (!frame.aspectLocked) {
        setFrame((prev) => ({
          ...prev,
          heightMm: Math.round(parsed)
        }));
      }
    }
  };

  const handleHeightBlur = () => {
    const parsed = parseFloat(heightInput);
    const safeH = isNaN(parsed) || parsed < 10 ? 10 : Math.min(2000, Math.round(parsed));
    setHeightInput(String(safeH));
    updateFrameDimension('height', safeH);
  };

  const toggleAspectLock = () => {
    setFrame((prev) => ({ ...prev, aspectLocked: !prev.aspectLocked }));
  };

  const swapOrientation = () => {
    setFrame((prev) => ({
      ...prev,
      widthMm: prev.heightMm,
      heightMm: prev.widthMm
    }));
  };

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-[calc(100vh-3.5rem)] select-none overflow-hidden z-20 transition-all duration-200">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search city, address or landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          {isSearching && (
            <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
          )}
        </form>
      </div>

      {/* Accordion / Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar text-xs pb-32">
        {/* SECTION 1: MAP STYLES & PRESET CREATOR */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              1. Map Styles
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreatingPreset(!isCreatingPreset)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
                title="Save current styling as a new preset"
              >
                <Plus className="w-3 h-3" />
                <span>Save Preset</span>
              </button>
              <button
                onClick={() => setShowLayerCustomizer(!showLayerCustomizer)}
                className="text-[10px] text-slate-300 hover:text-white font-medium flex items-center gap-1"
              >
                <Palette className="w-3 h-3 text-cyan-400" />
                <span>{showLayerCustomizer ? 'Hide' : 'Layers'}</span>
              </button>
            </div>
          </div>

          {/* New Preset Creator Form */}
          {isCreatingPreset && (
            <div className="mb-2.5 p-2 bg-slate-950/80 border border-emerald-500/40 rounded-lg space-y-2">
              <div className="text-[10px] font-semibold text-emerald-300">Save Current Style as New Preset</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Preset name (e.g. Vintage Dark, Sea Green)..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentAsPreset}
                  disabled={!newPresetName.trim()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded text-[11px] flex items-center gap-1 transition"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          )}

          {/* Style Picker (dropdown) */}
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-slate-600 shrink-0"
                style={{ backgroundColor: allPresets.find((p) => p.id === currentStyleId)?.previewColor || '#2b2b2b' }}
              />
              <select
                id="map-style-select"
                value={currentStyleId}
                onChange={(e) => {
                  const next = allPresets.find((p) => p.id === e.target.value);
                  if (next) handleSelectPreset(next);
                }}
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <optgroup label="Built-in styles">
                  {BUILTIN_STYLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
                {userPresets.length > 0 && (
                  <optgroup label="My presets">
                    {userPresets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {allPresets.find((p) => p.id === currentStyleId)?.isCustom && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteUserPreset(currentStyleId, e)}
                  className="text-slate-500 hover:text-red-400 p-1"
                  title="Delete this saved preset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-tight">
              {allPresets.find((p) => p.id === currentStyleId)?.description}
            </p>
          </div>

          {/* Granular Layer Customizer (Requirement #2: Arterial, Local, Highway controls) */}
          {showLayerCustomizer && (
            <div className="mt-2 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-300">Road Network Hierarchy</div>

              {/* Force Detail / Dense Roads Toggle */}
              <label className="flex items-center justify-between p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-300 cursor-pointer">
                <div>
                  <div className="text-[11px] font-semibold text-emerald-400">High Road Density</div>
                  <div className="text-[9px] text-slate-400">Force all streets, footpaths & rail visible at low zoom</div>
                </div>
                <input
                  type="checkbox"
                  checked={layerStyles.showDenseRoadsAtZoomOut}
                  onChange={(e) =>
                    setLayerStyles((prev) => ({ ...prev, showDenseRoadsAtZoomOut: e.target.checked }))
                  }
                  className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              {/* Highways & Freeways */}
              <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                <div>
                  <span className="text-slate-300 text-[11px] font-medium block">Highways & Expressways</span>
                  <span className="text-[9px] text-slate-500">Motorways & state routes</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layerStyles.highways?.color || layerStyles.roads.color}
                    onChange={(e) =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        editedColors: Array.from(new Set([...(prev.editedColors || []), 'highways'])),
                        highways: { ...prev.highways, color: e.target.value }
                      }))
                    }
                    className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <button
                    onClick={() =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        highways: { ...prev.highways, visible: !prev.highways.visible }
                      }))
                    }
                    className="text-slate-400 hover:text-slate-200"
                    title={layerStyles.highways?.visible ? 'Hide' : 'Show'}
                  >
                    {layerStyles.highways?.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                </div>
              </div>

              {/* Arterial & Secondary Roads */}
              <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                <div>
                  <span className="text-slate-300 text-[11px] font-medium block">Arterials & Secondary</span>
                  <span className="text-[9px] text-slate-500">Major thoroughfares</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layerStyles.arterial?.color || layerStyles.roads.color}
                    onChange={(e) =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        editedColors: Array.from(new Set([...(prev.editedColors || []), 'arterial'])),
                        arterial: { ...prev.arterial, color: e.target.value }
                      }))
                    }
                    className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <button
                    onClick={() =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        arterial: { ...prev.arterial, visible: !prev.arterial.visible }
                      }))
                    }
                    className="text-slate-400 hover:text-slate-200"
                    title={layerStyles.arterial?.visible ? 'Hide' : 'Show'}
                  >
                    {layerStyles.arterial?.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                </div>
              </div>

              {/* Local & Residential Streets */}
              <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                <div>
                  <span className="text-slate-300 text-[11px] font-medium block">Local Streets & Alleys</span>
                  <span className="text-[9px] text-slate-500">Residential & minor paths</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layerStyles.localRoads?.color || layerStyles.roads.color}
                    onChange={(e) =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        editedColors: Array.from(new Set([...(prev.editedColors || []), 'localRoads'])),
                        localRoads: { ...prev.localRoads, color: e.target.value }
                      }))
                    }
                    className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <button
                    onClick={() =>
                      setLayerStyles((prev) => ({
                        ...prev,
                        localRoads: { ...prev.localRoads, visible: !prev.localRoads.visible }
                      }))
                    }
                    className="text-slate-400 hover:text-slate-200"
                    title={layerStyles.localRoads?.visible ? 'Hide' : 'Show'}
                  >
                    {layerStyles.localRoads?.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                </div>
              </div>

              {/* Paths & Railways */}
              {(['paths', 'railways'] as const).map((layer) => {
                const layerData = layerStyles[layer] || { color: '#555555', visible: true };
                return (
                  <div key={layer} className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-300 text-[11px] font-medium block">{LAYER_NAMES[layer].name}</span>
                      <span className="text-[9px] text-slate-500">{LAYER_NAMES[layer].hint}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={layerData.color}
                        onChange={(e) =>
                          setLayerStyles((prev) => ({
                            ...prev,
                            editedColors: Array.from(new Set([...(prev.editedColors || []), layer])),
                            [layer]: { visible: true, ...prev[layer], color: e.target.value }
                          }))
                        }
                        className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                      />
                      <button
                        onClick={() =>
                          setLayerStyles((prev) => ({
                            ...prev,
                            [layer]: { color: layerData.color, ...prev[layer], visible: !(prev[layer]?.visible ?? true) }
                          }))
                        }
                        className="text-slate-400 hover:text-slate-200"
                        title={layerData.visible ? 'Hide' : 'Show'}
                      >
                        {layerData.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Other Layers */}
              <div className="text-[11px] font-semibold text-slate-300 pt-1">Landscape & Structures</div>
              {(['water', 'waterways', 'parks', 'landuse', 'buildings', 'aeroways', 'boundaries', 'labels', 'background'] as const).map((layer) => {
                const layerData = layerStyles[layer] || { color: '#ffffff', visible: true };
                return (
                  <div key={layer} className="flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
                    <span className="text-slate-300 text-[11px]">{LAYER_NAMES[layer]?.name || layer}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={layerData.color}
                        onChange={(e) =>
                          setLayerStyles((prev) => ({
                            ...prev,
                            editedColors: Array.from(new Set([...(prev.editedColors || []), String(layer)])),
                            [layer]: { visible: true, ...prev[layer], color: e.target.value }
                          }))
                        }
                        className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                      />
                      <button
                        onClick={() =>
                          setLayerStyles((prev) => ({
                            ...prev,
                            [layer]: { color: layerData.color, ...prev[layer], visible: !(prev[layer]?.visible ?? true) }
                          }))
                        }
                        className="text-slate-400 hover:text-slate-200"
                        title={layerData.visible ? 'Hide layer' : 'Show layer'}
                      >
                        {layerData.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: MAP FRAMING */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              2. Print Frame
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFrameVisible((prev) => !prev)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  isFrameVisible
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Toggle frame overlay visibility on map"
              >
                <Frame className="w-3 h-3" />
                <span>{isFrameVisible ? 'Frame Visible' : 'Frame Hidden'}</span>
              </button>
              <button
                onClick={onResetFrameToCenter}
                className="text-[10px] text-slate-400 hover:text-slate-200"
                title="Center frame on current map view"
              >
                Center
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Width ({frame.unit})</label>
              <input
                type="text"
                inputMode="numeric"
                value={widthInput}
                onChange={handleWidthChange}
                onBlur={handleWidthBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleWidthBlur();
                }}
                placeholder="Width in mm"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Height ({frame.unit})</label>
              <input
                type="text"
                inputMode="numeric"
                value={heightInput}
                onChange={handleHeightChange}
                onBlur={handleHeightBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleHeightBlur();
                }}
                placeholder="Height in mm"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-1.5">
            <button
              onClick={toggleAspectLock}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition ${
                frame.aspectLocked
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              }`}
              title={
                frame.aspectLocked
                  ? 'Aspect ratio locked: Width and Height change together proportionally. Click to unlock.'
                  : 'Aspect ratio free: Width and Height can be typed independently. Click to lock.'
              }
            >
              {frame.aspectLocked ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Unlock className="w-3.5 h-3.5 text-amber-400" />}
              <span>{frame.aspectLocked ? 'Aspect Locked' : 'Aspect Free (Independent)'}</span>
            </button>

            <button
              onClick={swapOrientation}
              className="py-1.5 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1"
              title="Swap Portrait / Landscape"
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-400 mb-2 px-0.5 leading-tight">
            {frame.aspectLocked ? (
              <span>🔒 Proportional lock is ON. Click to edit Width &amp; Height independently.</span>
            ) : (
              <span className="text-amber-300/90 font-medium">🔓 Independent mode: Type custom Width &amp; Height to match Canva.</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 pb-1">
            <span className="text-slate-500 shrink-0">Presets:</span>
            <select
              value={FRAME_PRESETS.find((p) => p.w === frame.widthMm && p.h === frame.heightMm)?.label ?? ''}
              onChange={(e) => {
                const p = FRAME_PRESETS.find((x) => x.label === e.target.value);
                if (!p) return;
                if (onSetFrameSize) onSetFrameSize(p.w, p.h);
                else setFrame((prev) => ({ ...prev, widthMm: p.w, heightMm: p.h }));
              }}
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="" disabled>
                Custom ({frame.widthMm}{'\u00d7'}{frame.heightMm})
              </option>
              {FRAME_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>

          <FrameCoordinatesEditor
            frame={frame}
            onPlaceByEdges={onPlaceFrameByEdges}
            onPlaceByCenter={onPlaceFrameByCenter}
          />
        </div>

        {/* SECTION 3: GPX IMPORT */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              3. Route Import
            </span>
            {tracks.length > 0 && (
              <button
                onClick={onClearRoute}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition text-center group">
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,.kml,.geojson,.json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onFileUpload(e.target.files[0]);
                }
              }}
            />
            <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 mb-1 transition" />
            <span className="text-[11px] font-medium text-slate-200 group-hover:text-emerald-300">
              Upload GPX, KML or GeoJSON
            </span>
            <span className="text-[10px] text-slate-400">
              Drag file here or click to browse
            </span>
          </label>

          {tracks.length > 0 ? (
            <div className="mt-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">{tracks[0].name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">
                  {tracks.reduce((acc, t) => acc + t.segments.length, 0)} segs
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={onLoadSample}
              className="mt-2 w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Sample Route</span>
            </button>
          )}
        </div>

        {/* SECTION 4: ROUTE STYLING (Requirement #3: Save route styling option) */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              4. Route Styling & Geometry
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSaveRouteStyle}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                title="Save current route style as default"
              >
                {savedRouteStyleSuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Save className="w-3 h-3" />}
                <span>{savedRouteStyleSuccess ? 'Saved!' : 'Save Style'}</span>
              </button>
              <button
                onClick={onResetEdits}
                className="text-[10px] text-slate-400 hover:text-slate-200"
                title="Reset geometry smoothing and simplification"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Color & Stroke Width */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Route Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={routeStyle.color}
                    onChange={(e) => setRouteStyle((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <span className="font-mono text-slate-300 text-[11px] uppercase">{routeStyle.color}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400">Trail Width</label>
                  <span className="font-mono text-emerald-400 font-semibold">{routeStyle.strokeWidthMm} mm</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8.0"
                  step="0.1"
                  value={routeStyle.strokeWidthMm}
                  onChange={(e) => setRouteStyle((prev) => ({ ...prev, strokeWidthMm: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400">Route Opacity</label>
                <span className="font-mono text-slate-300">{Math.round(routeStyle.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={routeStyle.opacity}
                onChange={(e) => setRouteStyle((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Markers & Arrows */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routeStyle.showStartMarker}
                  onChange={(e) => setRouteStyle((prev) => ({ ...prev, showStartMarker: e.target.checked }))}
                  className="rounded accent-emerald-500"
                />
                <span>Start Point</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routeStyle.showFinishMarker}
                  onChange={(e) => setRouteStyle((prev) => ({ ...prev, showFinishMarker: e.target.checked }))}
                  className="rounded accent-emerald-500"
                />
                <span>Finish Point</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routeStyle.showDirectionArrows}
                  onChange={(e) => setRouteStyle((prev) => ({ ...prev, showDirectionArrows: e.target.checked }))}
                  className="rounded accent-emerald-500"
                />
                <span>Direction Arrows</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routeStyle.glow}
                  onChange={(e) => setRouteStyle((prev) => ({ ...prev, glow: e.target.checked }))}
                  className="rounded accent-emerald-500"
                />
                <span>Glow Halo</span>
              </label>
            </div>

            {/* GPS Simplification & Smoothing */}
            <div className="pt-2 border-t border-slate-800/60 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">GPS Simplification (RDP)</span>
                  <span className="font-mono text-slate-300">{simplificationMm} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3.0"
                  step="0.1"
                  value={simplificationMm}
                  onChange={(e) => setSimplificationMm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">Curve Smoothing (Chaikin)</span>
                  <span className="font-mono text-slate-300">{smoothingIterations} passes</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={smoothingIterations}
                  onChange={(e) => setSmoothingIterations(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
