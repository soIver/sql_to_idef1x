import React from 'react';
import './tool.css';

export default function ToolsMenu() {
  return (

    <div className="tools">
      <button className="tool-button">
        <img src="/assets/undo.png" alt="Undo" />
      </button>
      <button className="tool-button">
        <img src="/assets/redo.png" alt="Redo" />
      </button>
      <button className="menubtn">
        <img src="/assets/menu.png" alt="menu" />
      </button>
      <button className="tool-button">
        <img src="/assets/save.png" alt="Save" />
      </button>
      <button className="tool-button">
        <img src="/assets/export.png" alt="Export" />
      </button>
    </div>
  );
};