import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Header from './components/header/header.jsx';
import Modal from './components/modal/modal.jsx';
import SQLEditor from './components/sqleditor/sqledit.tsx';
import VisualEditor from './components/visual/visualedit.tsx';
import ToolsMenu from './components/tools/tool.tsx';
import Projects from './components/projects/projects.tsx';

function App() {
  const [activeModal, setActiveModal] = useState(null);
  const [switching, setSwitching] = useState(false);
  const editorContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState('100%');

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

  return (
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

      <div className="content-wrapper" ref={editorContainerRef}>
        <div className="menu-container">
          <ToolsMenu />
        </div>
        <div className="editors-container">
          <div className="code-editor-container">
            <div className="projects-container">
              <Projects />
            </div>
            <SQLEditor initialValue="SELECT * FROM table;" />
          </div>
          <div className="visual-editor-container">
            <VisualEditor />
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;