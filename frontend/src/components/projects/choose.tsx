import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './choose.css';
import { useCsrfToken } from '../../hooks/useCsrfToken';

interface ChooseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (projectId: string) => void;
}

const ChooseModal: React.FC<ChooseModalProps> = ({ isOpen, onClose, onProjectCreated }) => {
  const [uploadType, setUploadType] = useState<'sql' | 'png' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const csrfToken = useCsrfToken();


    useEffect(() => {
      const modal = modalRef.current;
      const content = contentRef.current;

      if (!modal || !content) return;

      if (isOpen) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
          modal.classList.add('active');
          content.classList.add('active');
        });
      } else {
        modal.classList.remove('active');
        content.classList.remove('active');
        const timer = setTimeout(() => {
          if (modalRef.current) {
            modalRef.current.style.display = 'none';
            document.body.style.overflow = '';
          }
        }, 300); 
        
        return () => clearTimeout(timer);
      }
    }, [isOpen]);

  if (!isOpen) return null;

  const handleButton1Click = () => {
    setUploadType('sql');
    setError(null);
  };

  const handleButton2Click = () => {
    setUploadType('png');
    setError(null);
  };

  const handleButton3Click = () => {
    createEmptyProject();
  };

  const handleBackClick = () => {
    setUploadType(null);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (uploadType === 'sql' && !file.name.endsWith('.sql')) {
      setError('Пожалуйста, выберите файл с расширением .sql');
      return;
    }

    if (uploadType === 'png' && !file.name.endsWith('.png')) {
      setError('Пожалуйста, выберите файл с расширением .png');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType || '');

      const response = await fetch('/api/projects/upload/', {
        method: 'POST',
        headers: {
          'X-Csrftoken': csrfToken
        },
        credentials: 'include',
        body: formData
      });

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Ошибка при парсинге JSON:', e);
        console.error('Текст ответа:', responseText);
        throw new Error('Сервер вернул некорректный ответ');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при загрузке файла');
      }

      if (onProjectCreated && data.projectId) {
        console.log('Вызываем onProjectCreated с ID:', data.projectId);
        onProjectCreated(data.projectId);
      } else {
        console.error('onProjectCreated не определен или data.projectId отсутствует');
      }

      onClose();
    } catch (err) {
      console.error('Ошибка при загрузке файла:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
    }
  };

  const createEmptyProject = async () => {
    try {
      const response = await fetch('/api/projects/save/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrftoken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title: 'Новый проект'
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка при создании проекта');
      }

      const data = await response.json();

      if (onProjectCreated && data.project && data.project.id) {
        console.log('Вызываем onProjectCreated с ID:', data.project.id);
        onProjectCreated(data.project.id);
      } else {
        console.error('onProjectCreated не определен или data.project.id отсутствует');
      }

      onClose();
    } catch (err) {
      console.error('Ошибка при создании проекта:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при создании проекта');
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (!isOpen && modalRef.current?.style.display === 'none') return null;

  return ReactDOM.createPortal(
    <div className="choose-modal-overlay" 
    ref={modalRef}
    onClick={onClose}>
      <div className="choose-modal-content" 
      ref={contentRef}
      onClick={e => e.stopPropagation()}>
        <button className="choose-modal-close-btn" onClick={onClose}>
          <img src="/assets/close.png" alt="Close" className="choose-close-icon" />
        </button>

        {uploadType && (
          <button className="choose-modal-back-btn" onClick={handleBackClick}>
            <img src="/assets/back.svg" alt="Back" className="choose-back-icon" />
          </button>
        )}

        <h2 className="choose-modal-title">
          {uploadType ? 'Выберите или перетащите файл' : 'Выберите тип загрузки проекта'}
        </h2>

        {!uploadType ? (
          <div className="choose-modal-buttons-row">
            <div className="button-block-wrapper">
              <div className="button-top-text">SQL</div>
              <div className="choose-button-with-panel">
                <button className="choose-modal-action-btn" onClick={handleButton1Click}>
                  <img src="/assets/add.svg" alt="add" className="choose-btn-icon" />
                </button>
                <div className="choose-button-panel">Создать проект на основе SQL-файла</div>
              </div>
            </div>

            <div className="button-block-wrapper">
              <div className="button-top-text">PNG</div>
              <div className="choose-button-with-panel">
                <button className="choose-modal-action-btn" onClick={handleButton2Click}>
                  <img src="/assets/add.svg" alt="add" className="choose-btn-icon" />
                </button>
                <div className="choose-button-panel">Загрузить ранее созданный на сайте PNG</div>
              </div>
            </div>

            <div className="button-block-wrapper">
              <div className="button-top-text">NEW</div>
              <div className="choose-button-with-panel">
                <button className="choose-modal-action-btn" onClick={handleButton3Click}>
                  <img src="/assets/add.svg" alt="add" className="choose-btn-icon" />
                </button>
                <div className="choose-button-panel">Cоздать новый пустой проект</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="choose-upload-container">
            <div
              className={`choose-drop-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="choose-drop-content">
                <img src="/assets/upload.svg" alt="Upload" className="choose-upload-icon" />
                <p className="choose-drop-text">
                  Перетащите файл сюда или нажмите кнопку для выбора
                </p>
                <p className="choose-file-type">
                  {uploadType === 'sql' ? 'Поддерживаемый формат: .sql' : 'Поддерживаемый формат: .png'}
                </p>
                <button
                  className="choose-file-button"
                  onClick={handleFileButtonClick}
                  disabled={isUploading}
                >
                  {isUploading ? 'Загрузка...' : 'Выбрать файл'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept={uploadType === 'sql' ? '.sql' : '.png'}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            {error && <div className="choose-error-message">{error}</div>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ChooseModal;