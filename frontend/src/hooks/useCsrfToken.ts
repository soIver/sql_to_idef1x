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
        setCsrfToken(data.csrfToken);
        
        setTimeout(() => {
          const updatedCookieToken = getCsrfTokenFromCookies();
          if (updatedCookieToken && updatedCookieToken !== cookieToken) {
            setCsrfToken(updatedCookieToken);
          }
        }, 500);
      } catch (error) {
        console.error('Ошибка при получении CSRF токена:', error);
      }
    };

    fetchCsrfToken();

    const handleUserActivity = () => {
      const currentToken = getCsrfTokenFromCookies();
      if (currentToken && currentToken !== csrfToken) {
        setCsrfToken(currentToken);
      }
    };

    document.addEventListener('click', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);

    const intervalId = setInterval(fetchCsrfToken, 30 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
    };
  }, [csrfToken]);

  const getCurrentToken = (): string => {
    const cookieToken = document.cookie
      .split(';')
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith('csrftoken='));
      
    return cookieToken ? cookieToken.split('=')[1] : csrfToken;
  };

  return getCurrentToken();
}