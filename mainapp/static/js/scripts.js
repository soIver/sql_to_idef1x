const openModalBtn = document.getElementById('Profile');
const closeModalBtn = document.getElementById('closeModalBtn');
const modal = document.getElementById('modal');
const registerLink = document.getElementById('registerLink');
const loginLink = document.getElementById('loginLink');
const registerModal = document.getElementById('registerModal');
const closeRegisterModalBtn = document.getElementById('closeRegisterModalBtn');
let currentIndex = 0;
let sliderInterval;

// Функции для управления модальными окнами
function closeModal(modalElement) {
    modalElement.classList.remove('active');
    modalElement.classList.add('fadeOut');
    setTimeout(() => {
        modalElement.classList.remove('fadeOut');
        modalElement.style.display = 'none';
    }, 300);
}

function openModal(modalElement) {
    modalElement.style.display = 'flex';
    modalElement.classList.add('active');
    modalElement.classList.add('fadeIn');
    setTimeout(() => {
        modalElement.classList.remove('fadeIn');
    }, 300);
}

// Функции для слайдера
function resetSlider(sliderImages) {
    sliderImages.forEach((image, index) => {
        if (index === 0) {
            image.classList.add('active');
        } else {
            image.classList.remove('active');
        }
    });
    currentIndex = 0;
}

function startSlider(sliderImages) {
    currentIndex = 0;
    showImage(currentIndex, sliderImages);
    clearInterval(sliderInterval);
    sliderInterval = setInterval(() => autoSlide(sliderImages), 5000);
}

function showImage(index, sliderImages) {
    sliderImages.forEach((image, i) => {
        if (i === index) {
            image.classList.add('active');
        } else {
            image.classList.remove('active');
        }
    });
}

function autoSlide(sliderImages) {
    currentIndex = (currentIndex + 1) % sliderImages.length;
    showImage(currentIndex, sliderImages);
}

// Открытие модального окна входа
openModalBtn.addEventListener('click', () => {
    openModal(modal);
    const loginSliderImg = document.querySelectorAll('#slider-container .slider-image');
    resetSlider(loginSliderImg);
    startSlider(loginSliderImg);
    history.pushState(null, '', '/login');
});

// Закрытие модального окна входа
closeModalBtn.addEventListener('click', () => {
    const hasErrors = document.querySelector('#modal .alert') !== null;
    if (!hasErrors) {
        closeModal(modal);
        history.pushState(null, '', '/');
    }
});

// Обработка нажатия вне модального окна
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        const hasErrors = document.querySelector('#modal .alert') !== null;
        if (!hasErrors) {
            closeModal(modal);
            history.pushState(null, '', '/');
        }
    }
    if (event.target === registerModal) {
        const hasErrors = document.querySelector('#registerModal .alert') !== null;
        if (!hasErrors) {
            closeModal(registerModal);
            history.pushState(null, '', '/');
        }
    }
});

// Переход на регистрацию
registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(modal);
    setTimeout(() => {
        openModal(registerModal);
        const registerSliderImg = document.querySelectorAll('#register-slider-container .slider-image');
        resetSlider(registerSliderImg);
        startSlider(registerSliderImg);
        history.pushState(null, '', '/register');
    }, 300);
});

// Переход на вход
loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(registerModal);
    setTimeout(() => {
        openModal(modal);
        const loginSliderImg = document.querySelectorAll('#slider-container .slider-image');
        resetSlider(loginSliderImg);
        startSlider(loginSliderImg);
        history.pushState(null, '', '/login');
    }, 300);
});

// Закрытие модального окна регистрации
closeRegisterModalBtn.addEventListener('click', () => {
    closeModal(registerModal);
    history.pushState(null, '', '/');
});

// Обработка изменения URL (например, кнопка "Назад" в браузере)
window.addEventListener('popstate', () => {
    const path = window.location.pathname;

    if (path === '/login') {
        openModal(modal);
        const loginSliderImg = document.querySelectorAll('#slider-container .slider-image');
        resetSlider(loginSliderImg);
        startSlider(loginSliderImg);
    } else if (path === '/register') {
        openModal(registerModal);
        const registerSliderImg = document.querySelectorAll('#register-slider-container .slider-image');
        resetSlider(registerSliderImg);
        startSlider(registerSliderImg);
    } else {
        closeModal(modal);
        closeModal(registerModal);
    }
});

// Monaco Editor
require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.33.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    const sqlEditor = monaco.editor.create(document.getElementById('sql-editor'), {
        value: 'SELECT * FROM table;',
        language: 'sql',
        theme: 'vs-dark',
        automaticLayout: true,
    });

    sqlEditor.onDidChangeModelContent(() => {
        const sql = sqlEditor.getValue();
        if (isValidSql(sql)) {
            sendSqlToServer(sql);
        }
    });
});

function isValidSql(sql) {
    return sql.trim().length > 0 && sql.toLowerCase().startsWith('select');
}

function sendSqlToServer(sql) {
    console.log('Отправка SQL на сервер:', sql);
}

// AJAX-логика для формы входа
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();  // Отменяем стандартную отправку формы

        const formData = new FormData(loginForm);  // Собираем данные формы
        fetch(loginForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': formData.get('csrfmiddlewaretoken'),  // Добавляем CSRF-токен
            },
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.href = data.redirect_url;  // Перенаправляем на home
                } else {
                    alert(data.message);  // Показываем ошибку
                }
            })
            .catch(error => console.error('Ошибка:', error));
    });
}

// AJAX-логика для формы регистрации
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();  // Отменяем стандартную отправку формы

        const formData = new FormData(registerForm);  // Собираем данные формы
        fetch(registerForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': formData.get('csrfmiddlewaretoken'),  // Добавляем CSRF-токен
            },
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.href = data.redirect_url;  // Перенаправляем на home
                } else {
                    alert(data.message);  // Показываем ошибку
                }
            })
            .catch(error => console.error('Ошибка:', error));
    });
}