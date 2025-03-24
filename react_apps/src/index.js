import React from 'react';
import ReactDOM from 'react-dom/client';
import VisualEditor from './VisualEditor';

const rootElement = document.getElementById('visual');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<VisualEditor />);
} else {
  console.error('Элемент с id="drawio-editor" не найден в DOM.');
}