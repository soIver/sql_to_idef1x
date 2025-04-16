import React, { useState, useEffect, useCallback, useContext } from 'react';
import './modal.css';
import { AuthContext } from '../auth/AuthProvider';
import Notification from '../notification/notification';

export default function Modal({ type, isOpen, onClose, onSwitchModal }) {
  const { checkAuth } = useContext(AuthContext);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);

  // Пути к изображениям для слайдера
  const images = [
    '/assets/img1.png',
    '/assets/img2.png'
  ];

  // Автопереключение слайдов
  const startSlider = useCallback(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Обработчики событий
  const resetSlider = () => setCurrentIndex(0);

  const handleClose = () => {
    onClose();
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    window.history.pushState(null, '', '/');
  };

  const handleSwitch = (e, newType) => {
    e.preventDefault();
    setError('');
    onClose();
    setTimeout(() => {
      onSwitchModal(newType);
      resetSlider();
      window.history.pushState(null, '', `/${newType}`);
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (type === 'register' && password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    try {
      const csrfCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='));
      const csrfToken = csrfCookie ? csrfCookie.split('=')[1] : '';

      const endpoint = type === 'login' ? '/api/login/' : '/api/register/';
      console.log('Отправка запроса на:', endpoint);
      console.log('Отправляемые данные:', { email, password });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrftoken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          password: password,
          password2: confirmPassword
        })
      });

      console.log('Статус ответа:', response.status);

      if (!response.ok) {
        let errorText;
        try {
          const errorData = await response.json();
          errorText = errorData.error || `Ошибка при ${type === 'login' ? 'входе' : 'регистрации'}`;
        } catch (e) {
          errorText = `Ошибка при ${type === 'login' ? 'входе' : 'регистрации'}: ${response.status}`;
        }
        throw new Error(errorText);
      }

      const data = await response.json();
      await checkAuth();
      handleClose();
      setNotification({
        message: data.message || (type === 'login' ? 'Вход выполнен успешно' : 'Регистрация выполнена успешно'),
        type: 'success'
      });
    } catch (error) {
      setNotification({
        message: error.message || `Произошла ошибка при ${type === 'login' ? 'входе' : 'регистрации'}`,
        type: 'error'
      });
    }
  };

  // Эффекты
  useEffect(() => {
    if (!isOpen) return;
    const cleanUp = startSlider();
    window.history.pushState(null, '', `/${type}`);
    return cleanUp;
  }, [isOpen, type, startSlider]);

  if (!isOpen) return null;

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="modal active" onClick={handleClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Левая часть с слайдером */}
          <div className="modal-left">
            <div className="slider-container">
              {images.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`Слайд ${index}`}
                  className={`slider-image ${index === currentIndex ? 'active' : ''}`}
                />
              ))}
            </div>
            <div className="modal-line"></div>
          </div>

          {/* Правая часть с формой */}
          <div className="modal-right">
            <img
              src="/assets/close.png"
              alt="Close"
              className="close"
              onClick={handleClose}
            />

            <h2>{type === 'login' ? 'Вход' : 'Регистрация'}</h2>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="email">Почта</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Введите вашу почту"
                />
              </div>

              <div className="input-group password-text">
                <label htmlFor="password">Пароль</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Введите пароль"
                />
              </div>

              {type === 'register' && (
                <div className="input-group confirm-password-group">
                  <label htmlFor="confirmPassword">Подтвердите пароль</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Повторите пароль"
                  />
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <button type="submit">
                {type === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </form>

            <p className={type === 'login' ? 'register-text' : 'login-text'}>
              {type === 'login' ? 'У вас ещё нет аккаунта?' : 'У вас уже есть аккаунт?'}

              <button
                className="link-button"
                onClick={(e) => handleSwitch(e, type === 'login' ? 'register' : 'login')}
              >
                {type === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}