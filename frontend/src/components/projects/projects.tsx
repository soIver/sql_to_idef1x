import React, { useState, useRef, useEffect, useContext } from 'react';
import './projects.css';
import { useCsrfToken } from '../../hooks/useCsrfToken.ts';
import { AuthContext } from '../auth/AuthProvider.jsx';
import ChooseModal from './choose.tsx';
import './choose.css';

interface Project {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ProjectsProps {
  width?: string;
  onProjectChange?: (projectId: string | null) => void;
}

const Projects: React.FC<ProjectsProps> = ({ width = '100%', onProjectChange }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const projectsContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectsLoadedRef = useRef(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isChooseModalOpen, setIsChooseModalOpen] = useState(false);

  // CSRF токен
  const csrfToken = useCsrfToken();

  // Функция для обработки создания нового проекта
  const handleProjectCreated = (projectId: string) => {
    
    fetch(`/api/projects/${projectId}/get/`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при получении данных проекта');
        }
        return response.json();
      })
      .then(data => {
        // Добавляем новый проект в конец списка
        const newProject = {
          id: projectId,
          name: data.title,
          isActive: false
        };
        
        setProjects(prevProjects => [...prevProjects, newProject]);
        
        // Активируем новый проект
        handleProjectClick(projectId);
      })
      .catch(error => {
        console.error('Ошибка при получении данных нового проекта:', error);
      });
  };

  const fetchProjects = async () => {
    if (projectsLoadedRef.current && projects.length > 0) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/projects/', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка при загрузке проектов:', response.status, errorText);
        setIsLoading(false);
        return;
      }

      try {
        const data = await response.json();

        if (!data.projects || !Array.isArray(data.projects)) {
          console.error('Некорректный формат данных:', data);
          setIsLoading(false);
          return;
        }

        const activeProjectId = localStorage.getItem('activeProjectId');

        const activeProjectExists = activeProjectId &&
          data.projects.some(project => project.id.toString() === activeProjectId);

        const projectsList = data.projects.map((project: any) => ({
          id: project.id.toString(),
          name: project.title,
          isActive: project.id.toString() === activeProjectId
        }));

        setProjects(projectsList.reverse());

        projectsLoadedRef.current = true;

        if (projectsList.length > 0 && !activeProjectExists) {
          console.log('Активируем первый проект, так как нет активного:', projectsList[0].id);
          handleProjectClick(projectsList[0].id);
        } else if (activeProjectExists && onProjectChange) {
          onProjectChange(activeProjectId);
        }
        setIsLoading(false);
      } catch (e) {
        console.error('Ошибка при парсинге JSON:', e);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Ошибка при загрузке проектов:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !projectsLoadedRef.current) {
      fetchProjects();
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeProjectId') {
        console.log('Обнаружено изменение activeProjectId в localStorage:', e.newValue);
        if (e.newValue && onProjectChange) {
          onProjectChange(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, onProjectChange, fetchProjects]);

  // отслеживание изменения состояния аутентификации
  useEffect(() => {
    if (!isAuthenticated) {
      // если пользователь вышел из системы
      setProjects([]);
      setActiveProject(null);
      projectsLoadedRef.current = false;

      if (onProjectChange) {
        onProjectChange(null);
      }
    }
  }, [isAuthenticated, onProjectChange]);

  const handleProjectClick = (projectId: string) => {
    localStorage.setItem('activeProjectId', projectId);
    
    // Сохраняем имя проекта в localStorage
    const project = projects.find(p => p.id === projectId);
    if (project && project.name) {
      localStorage.setItem('activeProjectName', project.name);
    }

    if (onProjectChange) {
      onProjectChange(projectId);
    }

    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(project => ({
        ...project,
        isActive: project.id === projectId
      }));

      return updatedProjects;
    });
  };

  const handleCloseProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Запрос на удаление проекта с ID:', projectId);

    // Устанавливаем ID проекта для удаления, что активирует панель подтверждения
    setDeletingProjectId(projectId);

    // Прокручиваем к панели подтверждения, если она не видна
    setTimeout(() => {
      if (projectsContainerRef.current) {
        const container = projectsContainerRef.current;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;

        if (scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth) {
          container.scrollBy({
            left: 150,
            behavior: 'smooth'
          });
        }
      }
    }, 100);
  };

  const confirmProjectDeletion = async (projectId: string) => {
    setDeletingProjectId(null);

    const currentProjects = [...projects];
    const projectToDelete = projects.find(p => p.id === projectId);

    if (!projectToDelete) {
      console.error('Проект для удаления не найден:', projectId);
      return;
    }

    const wasActive = projectToDelete.isActive;
    const projectIndex = projects.findIndex(p => p.id === projectId);

    const newProjects = projects.filter(project => project.id !== projectId);
    setProjects(newProjects);

    if (wasActive && newProjects.length > 0) {
      const indexToActivate = Math.max(0, projectIndex - 1);
      const nextActiveProject = newProjects[indexToActivate];
      handleProjectClick(nextActiveProject.id);
    } else if (newProjects.length === 0) {
      localStorage.removeItem('activeProjectId');
    }

    // Проверяем, что projectId является строкой перед вызовом startsWith
    const isTemporaryProject = typeof projectId === 'string' && projectId.startsWith('temp-');

    if (isTemporaryProject) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/delete/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrftoken': csrfToken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Ошибка при удалении проекта на сервере, восстанавливаем состояние');
        setProjects(currentProjects);
        const errorText = await response.text();
        console.error('Текст ошибки:', errorText);
      } else {
        localStorage.removeItem(`project_content_${projectId}`);
      }
    } catch (error) {
      console.error('Исключение при удалении проекта:', error);
      setProjects(currentProjects);
    }
  };

  const cancelProjectDeletion = () => {
    console.log('Отмена удаления проекта');
    setDeletingProjectId(null);
  };

  const handleNameSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingProjectId) {
      e.preventDefault();

      const oldName = projects.find(p => p.id === editingProjectId)?.name || '';
      const currentProjects = [...projects];

      setProjects(projects.map(project =>
        project.id === editingProjectId
          ? { ...project, name: editingProjectName }
          : project
      ));
      setEditingProjectId(null);
      
      // Если это активный проект, обновляем имя в localStorage
      const activeProjectId = localStorage.getItem('activeProjectId');
      if (editingProjectId === activeProjectId) {
        localStorage.setItem('activeProjectName', editingProjectName);
      }

      // Проверяем, что editingProjectId является строкой перед вызовом startsWith
      const isTemporaryProject = typeof editingProjectId === 'string' && editingProjectId.startsWith('temp-');
      if (isTemporaryProject) {
        return;
      }

      try {
        const response = await fetch(`/api/projects/${editingProjectId}/update/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Csrftoken': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            title: editingProjectName
          })
        });

        console.log('Статус ответа:', response.status);

        if (!response.ok) {
          console.error('Ошибка при переименовании проекта, восстанавливаем состояние');
          setProjects(currentProjects);
          const errorText = await response.text();
          console.error('Текст ошибки:', errorText);
        } else {
        }
      } catch (error) {
        console.error('Исключение при переименовании проекта:', error);
        setProjects(currentProjects);
      }
    } else if (e.key === 'Escape') {
      setEditingProjectId(null);
    }
  };

  const handleDoubleClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project && project.isActive) {
      setEditingProjectId(projectId);
      setEditingProjectName(project.name);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingProjectName(e.target.value);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (projectsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      projectsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const checkScroll = () => {
      if (projectsContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = projectsContainerRef.current;
        setShowLeftArrow(scrollLeft > 5);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
      }
    };

    const container = projectsContainerRef.current;
    if (container) {
      checkScroll();

      container.addEventListener('scroll', checkScroll);
      
      // Обработчик события колёсика мыши для горизонтальной прокрутки
      const handleWheel = (e: WheelEvent) => {
        // Если список проектов имеет горизонтальную прокрутку
        if (container.scrollWidth > container.clientWidth) {
          // Предотвращаем вертикальную прокрутку страницы, если нажата клавиша Shift
          // или если контейнер может прокручиваться горизонтально
          if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            // Используем deltaX, если оно есть, иначе используем deltaY
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            container.scrollLeft += delta;
          } else {
            // Если нажато колёсико без Shift и deltaY больше deltaX,
            // то всё равно делаем горизонтальную прокрутку, но не блокируем вертикальную
            container.scrollLeft += e.deltaY;
          }
        }
      };
      
      container.addEventListener('wheel', handleWheel, { passive: false });

      const resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', checkScroll);
        container.removeEventListener('wheel', handleWheel);
        resizeObserver.disconnect();
      };
    }
  }, [projects]);

  if (!isAuthenticated) {
    return <div className="not-authenticated">Пожалуйста, войдите в систему для просмотра проектов</div>;
  }

  return (
    <div className="projects-container" style={{ width }}>
      {isLoading && (
        <div className="projects-loading">Загрузка проектов...</div>
      )}

      {error && (
        <div className="projects-error">
          {error} <button onClick={fetchProjects}>Повторить</button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {showLeftArrow && (
            <button
              className="scroll-arrow left-arrow"
              onClick={() => scrollTabs('left')}
            >
              &lt;
            </button>
          )}

          <div className="projects-tabs" ref={projectsContainerRef}>
            {projects.length === 0 ? (
              <div className="no-projects-message">
                Проекты не найдены.
              </div>
            ) : (
              projects.map((project) => (
                <React.Fragment key={project.id}>
                  <div
                    className={`project-tab ${project.isActive ? 'active' : ''}`}
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <div className="project-name">
                      {editingProjectId === project.id ? (
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={handleNameChange}
                          onKeyDown={handleNameSubmit}
                          onBlur={() => setEditingProjectId(null)}
                          autoFocus
                        />
                      ) : (
                        <span onDoubleClick={() => handleDoubleClick(project.id)}>
                          {project.name}
                        </span>
                      )}
                    </div>
                    <button
                      className="close-project-btn"
                      onClick={(e) => handleCloseProject(project.id, e)}
                      disabled={deletingProjectId === project.id}
                    >
                      {deletingProjectId === project.id ? '...' : '×'}
                    </button>
                  </div>
                  
                  {deletingProjectId === project.id && (
                    <div className="delete-confirmation-tab">
                      <span>Удалить проект?</span>
                      <div className="delete-confirmation-buttons">
                        <button
                          className="confirm-delete-btn"
                          onClick={() => confirmProjectDeletion(project.id)}
                        >
                          Да
                        </button>
                        <button
                          className="cancel-delete-btn"
                          onClick={cancelProjectDeletion}
                        >
                          Нет
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
            
            <button className="add-project-btn" onClick={() => setIsChooseModalOpen(true)}>
              <img src="/assets/add.svg" alt="Add" className="add-icon" />
            </button>
          </div>

          {showRightArrow && (
            <button
              className="scroll-arrow right-arrow"
              onClick={() => scrollTabs('right')}
            >
              &gt;
            </button>
          )}
        </>
      )}
      {isChooseModalOpen && (
        <ChooseModal
          isOpen={isChooseModalOpen}
          onClose={() => setIsChooseModalOpen(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  );
};

export default Projects;