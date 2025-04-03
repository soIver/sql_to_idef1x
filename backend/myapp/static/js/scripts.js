const openModalBtn = document.getElementById('Profile');
const closeModalBtn = document.getElementById('closeModalBtn');
const modal = document.getElementById('modal');
const registerLink = document.getElementById('registerLink');
const loginLink = document.getElementById('loginLink');
const registerModal = document.getElementById('registerModal');
const closeRegisterModalBtn = document.getElementById('closeRegisterModalBtn');

let currentProjectId = null;
let currentIndex = 0;
let sliderInterval;
let lastAuthState = null;

let authCheckInterval = null;
let isRequestPending = false;

// получение CSRF токена
function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
           document.cookie.match(/csrftoken=([\w-]+)/)?.[1] ||
           '';
}

function checkAuthState() {
    if (isRequestPending) return;

    const isAuth = document.cookie.includes('sessionid=');

    if (lastAuthState !== isAuth) {
        lastAuthState = isAuth;

        if (!isAuth) {
            if (window.location.pathname !== '/login') {
                window.location.href = '/login/';
            }
        } else {
            if (window.location.pathname === '/login') {
                window.location.href = '/';
            } else {
                isRequestPending = true;
                loadProjects()
                    .finally(() => {
                        isRequestPending = false;
                    });
            }
        }
    }
}



// модальные окна
function closeModal(modalElement) {
    modalElement.classList.remove('active');
    modalElement.classList.add('fadeOut');
    setTimeout(() => {
        modalElement.classList.remove('fadeOut');
        modalElement.style.display = 'none';
    }, 300);
}

// Добавьте обработчик для остановки интервала при размонтировании
window.addEventListener('beforeunload', () => {
    clearInterval(authCheckInterval);
});

async function loadProjects() {
    try {
        const response = await fetch(`/api/projects/?r=${Date.now()}`, {
            credentials: 'include',
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.status === 401) {
            window.location.href = '/login/';
            return [];
        }

        const data = await response.json();
        renderTabs(data.projects);

        // Если у нас уже выбран проект, но его нет в списке (удален?), сбросим currentProjectId
        const hasCurrent = data.projects.some(p => p.id === currentProjectId);
        if (!hasCurrent) currentProjectId = null;

        // Если не выбрано, но проекты есть – выберем первый
        if (!currentProjectId && data.projects.length > 0) {
            currentProjectId = data.projects[0].id;
            await loadProjectContent(currentProjectId);
        } else if (!data.projects.length) {
            // Нет проектов – очистим редактор
            if (window.setEditorValue) window.setEditorValue('');
        }

        // Возвращаем проекты, чтобы можно было использовать дальше
        window.currentProjectId = currentProjectId;
        return data.projects;

    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        return [];
    }
}


function openModal(modalElement) {
    modalElement.style.display = 'flex';
    modalElement.classList.add('active', 'fadeIn');
    setTimeout(() => modalElement.classList.remove('fadeIn'), 300);
}

// Слайдер
function initSlider(containerId) {
    const sliderImages = document.querySelectorAll(`#${containerId} .slider-image`);
    resetSlider(sliderImages);
    startSlider(sliderImages);
}

function resetSlider(images) {
    images.forEach((img, i) => img.classList.toggle('active', i === 0));
    currentIndex = 0;
}

function startSlider(images) {
    clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        images.forEach((img, i) => img.classList.toggle('active', i === currentIndex));
    }, 5000);
}

// обработчики модальных окон
openModalBtn.addEventListener('click', () => {
    openModal(modal);
    initSlider('slider-container');
    history.pushState(null, '', '/login');
});

[closeModalBtn, closeRegisterModalBtn].forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(btn.closest('.modal'));
        history.pushState(null, '', '/');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target);
        history.pushState(null, '', '/');
    }
});

registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(modal);
    setTimeout(() => {
        openModal(registerModal);
        initSlider('register-slider-container');
        history.pushState(null, '', '/register');
    }, 300);
});

loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(registerModal);
    setTimeout(() => {
        openModal(modal);
        initSlider('slider-container');
        history.pushState(null, '', '/login');
    }, 300);
});

window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    if (path === '/login') openModal(modal);
    else if (path === '/register') openModal(registerModal);
    else [modal, registerModal].forEach(closeModal);
});




function renderTabs(projects) {
    const container = document.getElementById('projectTabs');
    container.innerHTML = '';

    projects.forEach(project => {
        const tab = document.createElement('div');
        tab.className = `tab${currentProjectId === project.id ? ' active' : ''}`;
        // сохраняем исходное название в data атрибут
        tab.dataset.projectId = project.id;
        tab.dataset.title = project.title;

        tab.innerHTML = `
            ${project.title}
            <span class="close-tab">×</span>
        `;

        //удаление
        tab.querySelector('.close-tab').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProject(project.id);
        });

        // Разводим одиночный/двойной клик таймером
        let clickTimer = null;
        const DOUBLE_CLICK_DELAY = 300;

        tab.addEventListener('click', (event) => {
            if (clickTimer) {
                // вторая часть двойного клика
                clearTimeout(clickTimer);
                clickTimer = null;
                startEditTab(project.id);
            } else {
                // потенциально одиночный клик
                clickTimer = setTimeout(() => {
                    selectProject(project.id);
                    clickTimer = null;
                }, DOUBLE_CLICK_DELAY);
            }
        });

        container.appendChild(tab);
    });
}


async function selectProject(projectId) {
    currentProjectId = projectId;
    window.currentProjectId = currentProjectId;
    await loadProjectContent(projectId);
}

function startEditTab(projectId) {
    const tab = document.querySelector(`.tab[data-project-id="${projectId}"]`);
    if (!tab) return;

    const originalTitle = tab.dataset.title; // без "×"
    const input = document.createElement('input');
    input.value = originalTitle;

    // потеря фокуса - фиксируем изменения
    input.onblur = async () => {
        const newTitle = input.value.trim();
        // Если новое название непустое и отличается от старого
        if (newTitle && newTitle !== originalTitle) {
            await updateProjectTitle(projectId, newTitle);
            // перерисовываем списки проектов
            await loadProjects();
        }
    };

    // Enter — завершаем ввод
    input.onkeydown = (e) => {
        if (e.key === 'Enter') input.blur();
    };

    // очищаем вкладку
    tab.textContent = '';
    tab.appendChild(input);
    input.focus();
}


async function updateProjectTitle(projectId, title) {
  await fetch(`/api/projects/${projectId}/update/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ title })
    });
}

async function deleteProject(projectId) {
    if (!confirm('Удалить проект?')) return;

    try {
        const response = await fetch(`/api/projects/${projectId}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });

        if (response.ok) {
            // заново загружаем список
            const projects = await loadProjects();

            // остались проекты
            if (projects.length > 0) {
                // Берем последний
                const lastProject = projects[projects.length - 1];
                currentProjectId = lastProject.id;
                // подгружаем его содержимое
                await loadProjectContent(currentProjectId);
                window.currentProjectId = lastProject.id;
            } else {
                // ничего не осталось
                currentProjectId = null;
                if (window.setEditorValue) window.setEditorValue('');
            }
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка при удалении проекта');
    }
}


document.getElementById('addProject').addEventListener('click', async () => {
    const response = await fetch('/api/projects/save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
            title: 'Новый проект',
            sql_content: ''
        })
    });
    const data = await response.json();
    currentProjectId = data.project.id;
    await loadProjects();
});


async function loadProjectContent(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/get/`, {
            credentials: 'include'
        });
        const data = await response.json();
        let content = data.sql_content || '';
        if (!content.trim()) {
            content = '-- введите ваш запрос для создания схемы';
        }
        if (window.setEditorValue) {
            window.setEditorValue(content);
        }
    } catch (error) {
        console.error('Ошибка загрузки проекта:', error);
    }
}




async function saveProject(projectId, content) {
    try {
        const response = await fetch('/api/projects/save/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                id: projectId,
                sql_content: content
            }),
            credentials: 'include'
        });

        if (response.status === 403) {
            window.location.href = '/login/';
            return;
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        throw error;
    }
}

// инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const formData = new FormData(form);
                const csrfToken = getCsrfToken();

                // обработка разных методов
                const method = form.method.toUpperCase();

                const response = await fetch(form.action, {
                    method: method,
                    body: method === 'GET' ? null : formData,
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                });

                // ответ
                const data = await response.json();

                if (data.status === 'success') {
                    if (data.redirect_url) {
                        window.location.href = data.redirect_url;
                    }
                } else {
                    alert(data.message || 'Произошла ошибка');
                }

            } catch (error) {
                console.error('Ошибка:', error);
                alert(error.message || 'Ошибка соединения с сервером');
            }
        });
    });
});



// Сброс состояния приложения
function resetApplicationState() {
    localStorage.clear();
    sessionStorage.clear();
    currentProjectId = null;
    if (sqlEditor) sqlEditor.setValue('');
    loadProjects();
}



// Вспомогательная функция для показа ошибок
function showErrorModal(message) {
    const errorModal = document.createElement('div');
    errorModal.className = 'error-modal';
    errorModal.innerHTML = `
        <div class="error-content">
            <h3>Ошибка</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    document.body.appendChild(errorModal);
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/logout/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });
        window.location.reload(true);
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
});