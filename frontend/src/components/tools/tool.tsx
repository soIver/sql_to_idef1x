import React from 'react';
import './tool.css';
import { useCsrfToken } from '../../hooks/useCsrfToken';

interface ToolsMenuProps {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canSave?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onExport?: () => void;
}

export default function ToolsMenu({ 
  onSave, 
  onUndo, 
  onRedo, 
  canSave, 
  canUndo = false,
  canRedo = false, 
  onExport 
}: ToolsMenuProps) {
  const csrfToken = useCsrfToken();

  const handleSave = () => {
    if (onSave && canSave) {
      onSave();
    }
  };

  const handleUndo = () => {
    if (onUndo && canUndo) {
      onUndo();
    }
  };

  const handleRedo = () => {
    if (onRedo && canRedo) {
      onRedo();
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  return (
    <div className="tools">
      <button 
        className={`tool-button ${!canUndo ? 'disabled' : ''}`} 
        onClick={handleUndo}
        disabled={!canUndo}
      >
        <img src="/assets/undo.png" alt="Undo" />
      </button>
      <button 
        className={`tool-button ${!canRedo ? 'disabled' : ''}`} 
        onClick={handleRedo}
        disabled={!canRedo}
      >
        <img src="/assets/redo.png" alt="Redo" />
      </button>
      <button className="menubtn">
        <img src="/assets/menu.png" alt="menu" />
      </button>
      <button 
        className={`tool-button ${!canSave ? 'disabled' : ''}`} 
        onClick={handleSave}
        disabled={!canSave}
      >
        <img src="/assets/save.png" alt="Save" />
      </button>
      <button className="tool-button" onClick={handleExport}>
        <img src="/assets/export.png" alt="Export" />
      </button>
    </div>
  );
}