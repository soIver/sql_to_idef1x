import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import './sqledit.css';

interface SQLEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export interface SQLEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
  undo: () => void;
  redo: () => void;
  hasUndo: () => boolean; 
  hasRedo: () => boolean;
}

const SQLEditor = forwardRef<SQLEditorRef, SQLEditorProps>(({ initialValue = '', onChange }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const onChangeRef = useRef(onChange);
  const valueRef = useRef(initialValue);

  // референс при изменении onChange
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = initialValue;
    // если редактор уже инициализирован, обновляем его значение
    if (isEditorReady && editorInstance.current) {
      const currentValue = editorInstance.current.getValue();
      if (currentValue !== initialValue) {
        editorInstance.current.setValue(initialValue);
      }
    }
  }, [initialValue, isEditorReady]);

  useImperativeHandle(ref, () => ({
    getValue: () => editorInstance.current?.getValue() || '',
    setValue: (value: string) => {
      if (editorInstance.current) {
        const currentValue = editorInstance.current.getValue();
        if (currentValue !== value) {
          editorInstance.current.setValue(value);
        }
      }
    },
    undo: () => editorInstance.current?.trigger('keyboard', 'undo', null),
    redo: () => editorInstance.current?.trigger('keyboard', 'redo', null),
    hasUndo: () => {
      const model = editorInstance.current?.getModel();
      return model ? (model as any).canUndo() : false;
    },
    hasRedo: () => {
      const model = editorInstance.current?.getModel();
      return model ? (model as any).canRedo() : false;
    }
  }), []);

  useEffect(() => {
    if (!editorRef.current) return;

    if (!editorInstance.current) {

      editorInstance.current = monaco.editor.create(editorRef.current!, {
        value: valueRef.current || '--введите SQL запрос',
        language: 'sql',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 16,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        mouseWheelZoom: true,
        renderWhitespace: 'boundary',
        wordWrap: 'on',
        rulers: [80],
        links: true,
        accessibilitySupport: 'off'
      });

      editorInstance.current.onDidChangeModelContent(() => {
        const value = editorInstance.current?.getValue() || '';
        onChangeRef.current?.(value);
      });
      
      setIsEditorReady(true);
    }

    return () => {
      editorInstance.current?.dispose();
      editorInstance.current = null;
      setIsEditorReady(false);
    };
  }, []);

  return (
    <div className="sql-editor-container">
      <div className="code-editor">
        <div className="code-editor-content">
          <div ref={editorRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
});

export default SQLEditor;