import React, { createContext, useState, useEffect } from 'react';
import { useCsrfToken } from '../../hooks/useCsrfToken';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const csrfToken = useCsrfToken();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/check-auth/', {
                credentials: 'include'
            });

            if (!response.ok) {
                setIsAuthenticated(false);
                setUser(null);
                console.error('Ошибка при проверке авторизации:', response.status);
                setLoading(false);
                return;
            }

            try {
                const data = await response.json();
                setIsAuthenticated(data.is_authenticated);
                if (data.is_authenticated) {
                    setUser({ email: data.email });
                } else {
                    setUser(null);
                }
            } catch (e) {
                console.error('Ошибка при парсинге JSON:', e);
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Ошибка при проверке авторизации:', error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            console.log('Выполняем выход из системы...');

            // получаем новый CSRF токен если не передан
            let token = csrfToken;
            if (!token) {
                const tokenResponse = await fetch('/api/csrf-token/', {
                    credentials: 'include'
                });
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    token = tokenData.csrfToken;
                }
            }

            const response = await fetch('/api/logout/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Csrftoken': token
                }
            });

            if (response.ok) {
                // гудбай данные пользователя
                setIsAuthenticated(false);
                setUser(null);
                localStorage.removeItem('activeProjectId');

                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('project_content_')) {
                        localStorage.removeItem(key);
                    }
                });

                window.location.reload();

            } else {
                console.error('Ошибка при выходе из системы:', response.status);

                if (response.status === 403) {
                    console.log('Выполняем локальный выход из-за ошибки CSRF');
                    setIsAuthenticated(false);
                    setUser(null);
                    localStorage.removeItem('activeProjectId');

                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('project_content_')) {
                            localStorage.removeItem(key);
                        }
                    });

                    window.location.reload();
                }
            }
        } catch (error) {
            console.error('Ошибка при выходе:', error);

            setIsAuthenticated(false);
            setUser(null);
            localStorage.removeItem('activeProjectId');

            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('project_content_')) {
                    localStorage.removeItem(key);
                }
            });

            window.location.reload();
        }
    };

    const value = {
        isAuthenticated,
        user,
        loading,
        checkAuth,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}