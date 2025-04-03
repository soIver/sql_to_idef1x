import React, { useState, useRef, useEffect } from 'react';
import './projects.css';

interface Project {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ProjectsProps {
  width?: string;
}

const Projects: React.FC<ProjectsProps> = ({ width = '100%' }) => {
  const [projects, setProjects] = useState<Project[]>([
    { id: '1', name: 'Проект 1', isActive: true },
  ]);
  
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const handleProjectClick = (projectId: string) => {
    setProjects(projects.map(project => ({
      ...project,
      isActive: project.id === projectId
    })));
  };

  const handleAddProject = () => {
    const newProjectId = String(Date.now()); 
    setProjects([
      ...projects,
      { id: newProjectId, name: `Проект ${projects.length + 1}` }
    ]);
  };

  const handleCloseProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newProjects = projects.filter(project => project.id !== projectId);
    

    const wasActive = projects.find(p => p.id === projectId)?.isActive;
    setProjects(newProjects);
    
    if (wasActive && newProjects.length > 0) {
      const indexToActivate = Math.max(0, projects.findIndex(p => p.id === projectId) - 1);
      handleProjectClick(newProjects[indexToActivate].id);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const checkScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth);
      }
    };

    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      checkScroll();
      
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(container);
      
      return () => {
        container.removeEventListener('scroll', checkScroll);
        resizeObserver.disconnect();
      };
    }
  }, [projects]);

  return (
    <div className="projects-container" style={{ width }}>
      {showLeftArrow && (
        <button 
          className="scroll-arrow left-arrow"
          onClick={() => scrollTabs('left')}
        >
          &lt;
        </button>
      )}

      <div className="projects-tabs" ref={tabsContainerRef}>
        {projects.map(project => (
          <div
            key={project.id}
            className={`project-tab ${project.isActive ? 'active' : ''}`}
            onClick={() => handleProjectClick(project.id)}
          >
            {project.name}
            <button 
              className="close-tab"
              onClick={(e) => handleCloseProject(project.id, e)}
            >
              ×
            </button>
          </div>
        ))}
        <button className="add-project-btn" onClick={handleAddProject}>
          +
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
    </div>
  );
};

export default Projects;