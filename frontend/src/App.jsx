import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Header from './components/header/header.jsx';
import Modal from './components/modal/modal.jsx';
import SQLEditor from './components/sqleditor/sqledit.tsx';
import VisualEditor from './components/visual/visualedit.tsx';
import ToolsMenu from './components/tools/tool.tsx';
import Projects from './components/projects/projects.tsx';
import { AuthProvider } from './components/auth/AuthProvider';
import { useCsrfToken } from './hooks/useCsrfToken';
import Notification from './components/notification/notification.tsx';

function App() {
  const [activeModal, setActiveModal] = useState(null);
  const [switching, setSwitching] = useState(false);
  const editorContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState('100%');
  const sqlEditorRef = useRef(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [sqlContent, setSqlContent] = useState('-- введите SQL запрос');
  const [savingStatus, setSavingStatus] = useState(null);
  const csrfToken = useCsrfToken();
  const projectsLoadedRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState({});
  const visualEditorRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const handleOpenModal = useCallback((type) => {
    if (activeModal && activeModal !== type) {
      setSwitching(true);
      setTimeout(() => {
        setActiveModal(type);
        setSwitching(false);
      }, 300);
    } else if (!activeModal) {
      setActiveModal(type);
    }
  }, [activeModal]);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleProjectChange = useCallback((projectId) => {
    if (projectId === activeProjectId) {
      return;
    }

    setActiveProjectId(projectId);

    if (projectId) {
      loadProjectContent(projectId);
    } else {
      const defaultSql = '-- введите SQL запрос';
      if (sqlContent !== defaultSql) {
        setSqlContent(defaultSql);
        if (sqlEditorRef.current) {
          sqlEditorRef.current.setValue(defaultSql);
        }
      }
    }
  }, [activeProjectId, sqlContent]);

  // Загрузка содержимого проекта
  const loadProjectContent = async (projectId) => {
    try {
      const activeElement = document.activeElement;
      setSqlContent('');
      const localKey = `project_content_${projectId}`;
      const localContent = localStorage.getItem(localKey);

      const response = await fetch(`/api/projects/${projectId}/get/`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Ошибка при загрузке проекта:', response.status);
        if (localContent) {
          setSqlContent(localContent);
          if (sqlEditorRef.current) {
            sqlEditorRef.current.setValue(localContent);
            
            setTimeout(() => {
              if (sqlEditorRef.current) {
                console.log("Проверка undo/redo после загрузки проекта");
                setCanUndo(sqlEditorRef.current.hasUndo());
                setCanRedo(sqlEditorRef.current.hasRedo());
                console.log(`Undo: ${sqlEditorRef.current.hasUndo()}, Redo: ${sqlEditorRef.current.hasRedo()}`);
              }
            }, 100);
          }

          const savedContent = lastSavedContent[projectId] || '';
          setHasUnsavedChanges(localContent !== savedContent);
        } else {
          const defaultSql = '-- введите SQL запрос';
          setSqlContent(defaultSql);
          if (sqlEditorRef.current) {
            sqlEditorRef.current.setValue(defaultSql);
            
            setTimeout(() => {
              if (sqlEditorRef.current) {
                console.log("Проверка undo/redo после загрузки проекта");
                setCanUndo(sqlEditorRef.current.hasUndo());
                setCanRedo(sqlEditorRef.current.hasRedo());
                console.log(`Undo: ${sqlEditorRef.current.hasUndo()}, Redo: ${sqlEditorRef.current.hasRedo()}`);
              }
            }, 100);
          }
          setHasUnsavedChanges(false);
        }

        setTimeout(() => {
          if (activeElement && activeElement instanceof HTMLElement) {
            activeElement.focus();
          }
        }, 50);

        return;
      }

      const data = await response.json();
      const serverContent = data.sql_content || '-- введите SQL запрос';

      setLastSavedContent(prev => ({
        ...prev,
        [projectId]: serverContent
      }));

      let content = serverContent;
      if (localContent) {
        if (localContent !== serverContent) {
          content = localContent;
          setHasUnsavedChanges(true);
        } else {
          setHasUnsavedChanges(false);
        }
      } else {
        setHasUnsavedChanges(false);
      }

      setSqlContent(content);

      if (sqlEditorRef.current) {
        sqlEditorRef.current.setValue(content);
        
        setTimeout(() => {
          if (sqlEditorRef.current) {
            setCanUndo(sqlEditorRef.current.hasUndo());
            setCanRedo(sqlEditorRef.current.hasRedo());
          }
        }, 100);
      }

      setTimeout(() => {
        if (activeElement && activeElement instanceof HTMLElement) {
          activeElement.focus();
        }
      }, 50);

    } catch (error) {
      console.error('Ошибка при загрузке содержимого проекта:', error);
      const localKey = `project_content_${projectId}`;
      const localContent = localStorage.getItem(localKey);
      if (localContent) {
        setSqlContent(localContent);
        if (sqlEditorRef.current) {
          sqlEditorRef.current.setValue(localContent);
        }

        setHasUnsavedChanges(true);
      } else {
        const defaultSql = '-- введите SQL запрос';
        setSqlContent(defaultSql);
        if (sqlEditorRef.current) {
          sqlEditorRef.current.setValue(defaultSql);
        }
        setHasUnsavedChanges(false);
      }

      if (sqlEditorRef.current) {
        sqlEditorRef.current.setValue(localContent || defaultSql);
        
        // Также проверяем состояние undo/redo при обработке ошибок
        setTimeout(() => {
          if (sqlEditorRef.current) {
            setCanUndo(sqlEditorRef.current.hasUndo());
            setCanRedo(sqlEditorRef.current.hasRedo());
          }
        }, 100);
      }
    }
  };

  const handleEditorChange = useCallback((value) => {
    if (value !== sqlContent) {
      setSqlContent(value);

      // Обновляем состояние undo/redo после изменения контента
      setTimeout(() => {
        if (sqlEditorRef.current) {
          const hasUndoNow = sqlEditorRef.current.hasUndo();
          const hasRedoNow = sqlEditorRef.current.hasRedo();
          setCanUndo(hasUndoNow);
          setCanRedo(hasRedoNow);
        }
      }, 10);

      if (activeProjectId) {
        const localKey = `project_content_${activeProjectId}`;
        localStorage.setItem(localKey, value);

        const savedContent = lastSavedContent[activeProjectId] || '';
        setHasUnsavedChanges(value !== savedContent);
      }
    }
  }, [sqlContent, activeProjectId, lastSavedContent]);

  const handleSave = async () => {
    if (!activeProjectId || !sqlEditorRef.current) {
      console.error('Нет активного проекта или редактора');
      return;
    }

    if (!hasUnsavedChanges) {
      return;
    }

    const content = sqlEditorRef.current.getValue();

    try {
      setSavingStatus('saving');

      // Получаем свежий CSRF токен из куки для предотвращения ошибок
      const csrfCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='));
      const freshCsrfToken = csrfCookie ? csrfCookie.split('=')[1] : csrfToken;

      const response = await fetch(`/api/projects/${activeProjectId}/update/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrftoken': freshCsrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          sql_content: content
        })
      });

      if (response.ok) {
        setSavingStatus('success');
        setTimeout(() => setSavingStatus(null), 3000);

        if (activeProjectId) {
          const localKey = `project_content_${activeProjectId}`;
          localStorage.setItem(localKey, content);

          setLastSavedContent(prev => ({
            ...prev,
            [activeProjectId]: content
          }));
          setHasUnsavedChanges(false);
        }
      } else {
        setSavingStatus('error');
        console.error('Ошибка при сохранении проекта:', await response.text());
      }
    } catch (error) {
      setSavingStatus('error');
      console.error('Исключение при сохранении проекта:', error);
    }
  };

  const handleUndo = () => {
    if (sqlEditorRef.current) {
      sqlEditorRef.current.undo();
      setTimeout(() => {
        setCanUndo(sqlEditorRef.current.hasUndo());
        setCanRedo(sqlEditorRef.current.hasRedo());
      }, 0);
    }
  };
  
  const handleRedo = () => {
    if (sqlEditorRef.current) {
      sqlEditorRef.current.redo();
      setTimeout(() => {
        setCanUndo(sqlEditorRef.current.hasUndo());
        setCanRedo(sqlEditorRef.current.hasRedo());
      }, 0);
    }
  };

  const handleExportPng = () => {
    console.log('Вызвана функция handleExportPng в App.jsx');
    if (visualEditorRef.current) {
      visualEditorRef.current.exportDiagram();
    }
  };

  const handleInitialProjectsLoad = useCallback((projectId) => {
    if (projectsLoadedRef.current) {
      setActiveProjectId(projectId);
      return;
    }

    projectsLoadedRef.current = true;
    handleProjectChange(projectId);
  }, [handleProjectChange]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.modal) {
        handleOpenModal(event.state.modal);
      } else {
        handleCloseModal();
      }
    };

    const updateWidth = () => {
      if (editorContainerRef.current && editorContainerRef.current.offsetWidth > 0) {
        setContainerWidth(`${editorContainerRef.current.offsetWidth}px`);
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    const currentRef = editorContainerRef.current;

    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      resizeObserver.disconnect();
    };
  }, [handleCloseModal, handleOpenModal]);

  useEffect(() => {
    fetch('/api/csrf-token/', { credentials: 'include' });

    // активный проект из localStorage
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (storedProjectId) {
      setActiveProjectId(storedProjectId);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadProjectContent(activeProjectId);
    }
  }, [activeProjectId]);

  return (
    <AuthProvider>
      <div className="App">
        <Header onOpenModal={handleOpenModal} />

        <Modal
          type="login"
          isOpen={activeModal === 'login'}
          onClose={handleCloseModal}
          onSwitchModal={handleOpenModal}
          isSwitching={switching}
        />

        <Modal
          type="register"
          isOpen={activeModal === 'register'}
          onClose={handleCloseModal}
          onSwitchModal={handleOpenModal}
          isSwitching={switching}
        />

        {savingStatus === 'saving' && (
          <Notification 
            message="Сохранение проекта..."
            type="info"
            onClose={() => {}}
          />
        )}
        {savingStatus === 'success' && (
          <Notification 
            message="Проект сохранён!"
            type="success"
            onClose={() => setSavingStatus(null)}
          />
        )}
        {savingStatus === 'error' && (
          <Notification 
            message="Ошибка сохранения"
            type="error"
            onClose={() => setSavingStatus(null)}
          />
        )}

        <div className="content-wrapper" ref={editorContainerRef}>
          <div className="menu-container">
            <ToolsMenu
              onSave={handleSave}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canSave={hasUnsavedChanges}
              canUndo={canUndo}
              canRedo={canRedo}
              onExport={handleExportPng}
            />
          </div>
          <div className="editors-container">
            <div className="code-editor-container">
              <div className="projects-container">
                <Projects
                  onProjectChange={handleInitialProjectsLoad}
                />
              </div>
              <SQLEditor
                ref={sqlEditorRef}
                initialValue={sqlContent}
                onChange={handleEditorChange}
              />
            </div>
            <div className="visual-editor-container">
              <VisualEditor
                ref={visualEditorRef}
                sqlContent={sqlContent}
              />
            </div>
          </div>
        </div>

      </div>
    </AuthProvider>
  );
}

export default App;