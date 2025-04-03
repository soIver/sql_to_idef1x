import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import './sqledit.css';

interface SQLEditorProps {
  initialValue?: string;
}

const SQLEditor: React.FC<SQLEditorProps> = ({ initialValue = '' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const initEditor = () => {
      editorInstance.current = monaco.editor.create(editorRef.current!, {
        value: initialValue || 'SELECT * FROM table;',
        language: 'sql',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 16,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
      });
    };

    initEditor();

    return () => {
      editorInstance.current?.dispose();
    };
  }, [initialValue]);

  return (
    <div className="code-editor">
      <div className="code-editor-content">
        <div ref={editorRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default SQLEditor;