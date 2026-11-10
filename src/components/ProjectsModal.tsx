import React, { useState } from 'react';
import { 
  X, 
  FolderOpen, 
  Save, 
  Trash2, 
  Download, 
  Upload, 
  Calendar, 
  Layers, 
  CheckCircle,
  Plus
} from 'lucide-react';
import { ProjectData } from '../types';
import { exportProjectToFile } from '../utils/projectStorage';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectData[];
  onLoadProject: (project: ProjectData) => void;
  onDeleteProject: (id: string) => void;
  onSaveCurrentAsNew: (name: string) => void;
  onImportProject: (imported: ProjectData) => void;
  currentProjectName: string;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  onLoadProject,
  onDeleteProject,
  onSaveCurrentAsNew,
  onImportProject,
  currentProjectName
}) => {
  const [newProjectName, setNewProjectName] = useState('');

  if (!isOpen) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onSaveCurrentAsNew(newProjectName.trim());
    setNewProjectName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.frame && parsed.styleId) {
          onImportProject(parsed);
        } else {
          alert('Invalid MapCraft project file.');
        }
      } catch (err) {
        alert('Failed to parse project file JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Project Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {/* Save Current Project */}
          <form onSubmit={handleSaveSubmit} className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Save current state as new project..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </form>

          {/* Import / Export Controls */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-2 transition text-xs">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Import .mapcraft File</span>
              <input type="file" accept=".mapcraft,.json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Saved Projects List */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Saved Local Projects ({projects.length})
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No saved projects yet. Save your current map design above!
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition group"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 text-xs mb-0.5">{proj.name}</div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span>{proj.frame.widthMm} × {proj.frame.heightMm} mm</span>
                        <span>•</span>
                        <span className="capitalize">{proj.styleId} style</span>
                        <span>•</span>
                        <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onLoadProject(proj)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-medium transition"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => exportProjectToFile(proj)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                        title="Export project configuration file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteProject(proj.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
