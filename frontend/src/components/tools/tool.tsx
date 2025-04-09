import React from 'react';
import './tool.css';
import { useCsrfToken } from '../../hooks/useCsrfToken';

interface ToolsMenuProps {
  onSave?: () => void;
  isSaveDisabled?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExport?: () => void;
}

export default function ToolsMenu({ onSave, isSaveDisabled, onUndo, onRedo, onExport }: ToolsMenuProps) {
  const csrfToken = useCsrfToken();

  const handleSave = () => {
    if (onSave && !isSaveDisabled) {
      onSave();
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  return (
    <div className="tools">
      <button className="tool-button" onClick={onUndo}>
        <img src="/assets/undo.png" alt="Undo" />
      </button>
      <button className="tool-button" onClick={onRedo}>
        <img src="/assets/redo.png" alt="Redo" />
      </button>
      <button className="menubtn">
        <img src="/assets/menu.png" alt="menu" />
      </button>
      <button 
        className={`tool-button ${isSaveDisabled ? 'disabled' : ''}`} 
        onClick={handleSave}
        disabled={isSaveDisabled}
      >
        <img src="/assets/save.png" alt="Save" />
      </button>
      <button className="tool-button" onClick={handleExport}>
        <img src="/assets/export.png" alt="Export" />
      </button>
    </div>
  );
}