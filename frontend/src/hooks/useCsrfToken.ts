import { useState, useEffect } from 'react';

export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    const getCsrfTokenFromCookies = (): string | null => {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
          return value;
        }
      }
      return null;
    };

    const fetchCsrfToken = async () => {
      try {
        // если есть токен в куках
        const cookieToken = getCsrfTokenFromCookies();

        if (cookieToken) {
          console.log('CSRF токен получен из кук:', cookieToken.substring(0, 5) + '...');
          setCsrfToken(cookieToken);
          return;
        }

        // если токена нет в куках (запрос с сервера)
        console.log('Запрашиваем CSRF токен с сервера...');
        const response = await fetch('/api/csrf-token/', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Ошибка при получении CSRF токена: ${response.status}`);
        }

        const data = await response.json();
        console.log('Получен новый CSRF токен:', data.csrfToken.substring(0, 5) + '...');
        setCsrfToken(data.csrfToken);
      } catch (error) {
        console.error('Ошибка при получении CSRF токена:', error);
      }
    };

    fetchCsrfToken();

    // обновление токена каждые 30 минут (я не знаю зачем сказали надо)
    const intervalId = setInterval(fetchCsrfToken, 30 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return csrfToken;
}