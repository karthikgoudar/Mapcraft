import React from 'react';
import { 
  Compass, 
  Layers, 
  Maximize2, 
  Upload, 
  Sliders, 
  Eye, 
  Download, 
  Save, 
  RotateCcw, 
  RotateCw, 
  Box,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Frame,
  LayoutTemplate
} from 'lucide-react';

interface HeaderProps {
  projectName: string;
  setProjectName: (name: string) => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
  onSaveProject: () => void;
  onOpenProjects: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpen3D: () => void;
  hasRoute: boolean;
  // Panel toggles
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  // Frame toggle
  isFrameVisible: boolean;
  setIsFrameVisible: (val: boolean | ((prev: boolean) => boolean)) => void;
  // Trigger file upload directly
  onTriggerFileUpload?: () => void;
  onTogglePreviewDrawer?: () => void;
  onOpenLayoutStudio?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  setProjectName,
  activeStep,
  setActiveStep,
  onSaveProject,
  onOpenProjects,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpen3D,
  hasRoute,
  isLeftPanelOpen,
  setIsLeftPanelOpen,
  isRightPanelOpen,
  setIsRightPanelOpen,
  isFrameVisible,
  setIsFrameVisible,
  onTriggerFileUpload,
  onTogglePreviewDrawer,
  onOpenLayoutStudio
}) => {
  const steps = [
    { num: 1, label: 'Design Map', icon: Layers, action: () => { setActiveStep(1); setIsLeftPanelOpen(true); } },
    { num: 2, label: 'Set Frame', icon: Maximize2, action: () => { setActiveStep(2); setIsLeftPanelOpen(true); setIsFrameVisible(true); } },
    { num: 3, label: 'Upload GPX', icon: Upload, action: () => { setActiveStep(3); setIsLeftPanelOpen(true); if (onTriggerFileUpload) onTriggerFileUpload(); } },
    { num: 4, label: 'Style Route', icon: Sliders, action: () => { setActiveStep(4); setIsLeftPanelOpen(true); } },
    { num: 5, label: 'Preview', icon: Eye, action: () => { setActiveStep(5); if (onTogglePreviewDrawer) onTogglePreviewDrawer(); } },
    { num: 6, label: 'Export & 3D', icon: Download, action: () => { setActiveStep(6); setIsRightPanelOpen(true); } },
    { num: 7, label: 'Layout & PDF', icon: LayoutTemplate, action: () => { setActiveStep(7); if (onOpenLayoutStudio) onOpenLayoutStudio(); } }
  ];

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between select-none z-30 relative">
      {/* Left Area: Panel Toggle + Brand + Project Title */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setIsLeftPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-lg border text-xs transition ${
            isLeftPanelOpen
              ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
          }`}
          title={isLeftPanelOpen ? 'Collapse Left Sidebar' : 'Expand Left Sidebar'}
        >
          {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
          <Compass className="w-5 h-5 text-white" />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              MapCraft
            </span>
            <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              v1.0
            </span>
          </div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-[11px] text-slate-400 hover:text-slate-200 bg-transparent hover:bg-slate-800/80 focus:bg-slate-800 focus:text-slate-100 rounded px-1 py-0.5 border border-transparent focus:border-slate-700 outline-none transition w-44 font-medium truncate"
            title="Click to rename project"
          />
        </div>
      </div>

      {/* Center: Interactive Workflow Steps Navigation */}
      <nav className="hidden md:flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = activeStep === s.num;
          return (
            <button
              key={s.num}
              onClick={s.action}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={`Switch to ${s.label}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{s.num}. {s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Area: Frame Toggle, 3D Modal, Undo/Redo, Projects, Right Panel Toggle */}
      <div className="flex items-center gap-2">
        {/* Frame Show / Hide Toggle Button */}
        <button
          onClick={() => setIsFrameVisible((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            isFrameVisible
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title={isFrameVisible ? 'Hide Print Frame (Clean Map View)' : 'Show Print Frame'}
        >
          <Frame className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{isFrameVisible ? 'Frame On' : 'Frame Off'}</span>
        </button>

        {/* 3D Trail Generator Modal Trigger */}
        {hasRoute && (
          <button
            onClick={onOpen3D}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/40 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-900/50 transition shadow-sm"
            title="Generate 3D Printable STL Trail"
          >
            <Box className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">3D Mesh</span>
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Undo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Redo"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save & Projects */}
        <button
          onClick={onSaveProject}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          title="Save Project Locally"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenProjects}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
        >
          Projects
        </button>

        {/* Right Sidebar Toggle */}
        <button
          onClick={() => setIsRightPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-lg border text-xs transition ${
            isRightPanelOpen
              ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
          }`}
          title={isRightPanelOpen ? 'Collapse Right Sidebar' : 'Expand Right Sidebar'}
        >
          {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
