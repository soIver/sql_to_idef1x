import React, { useEffect, useState, useRef } from 'react';
import { DrawIoEmbed } from 'react-drawio';
import './visualedit.css';

interface SqlToDrawioResponse {
    status: string;
    xml?: string;
    message?: string;
}

interface VisualEditorProps {
    sqlContent: string;
}

const VisualEditor: React.FC<VisualEditorProps> = ({ sqlContent }) => {
    const [xml, setXml] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastProcessedSql, setLastProcessedSql] = useState<string>('');
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const activeElementRef = useRef<Element | null>(null);

    const timerRef = useRef<number | null>(null);
    const loadingTimerRef = useRef<number | null>(null);

    const convertSqlToDrawio = async (sql: string) => {
        if (!sql || sql.trim() === '') {
            // если SQL пустой, очищаем диаграмму
            setXml('');
            setLoading(false);
            setShowLoadingMessage(false);
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
            setError(null);
            return;
        }

        if (sql === lastProcessedSql) {
            setLoading(false);
            setShowLoadingMessage(false);
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
            return;
        }

        activeElementRef.current = document.activeElement;

        try {
            // устанавливаем состояние загрузки и убираем ошибку
            setLoading(true);
            setError(null);

            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
            }
            loadingTimerRef.current = window.setTimeout(() => {
                if (loading) {
                    setShowLoadingMessage(true);
                }
            }, 1000);

            const response = await fetch('/api/convert/sql-to-drawio/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql }),
            });

            let data: SqlToDrawioResponse;
            try {
                const textResponse = await response.text();
                data = JSON.parse(textResponse);
            } catch (parseError) {
                console.error('Ошибка при парсинге ответа JSON:', parseError);
                setError('Получен некорректный формат ответа от сервера');
                setLoading(false);
                setShowLoadingMessage(false);
                restoreFocus();
                return;
            }

            if (response.ok && data.status === 'success' && data.xml) {
                setXml(data.xml);
                setError(null);
                setLastProcessedSql(sql);
            } else {
                console.error('Ошибка при конвертации SQL в DrawIO:', data.message);

                if (data.message && data.message.includes('SQL запрос не содержит определений таблиц')) {
                    setError('Ошибка при конвертации SQL в DrawIO: SQL запрос не содержит определений таблиц');
                    setXml('');
                    setLastProcessedSql(sql);
                } else {
                    const errorMessage = data.message || 'Не удалось преобразовать SQL в диаграмму';

                    if (errorMessage.includes('Внутренняя ошибка сервера')) {
                        setError(`Ошибка: ${errorMessage}. Проверьте синтаксис SQL запроса и убедитесь, что он содержит CREATE TABLE с определением PRIMARY KEY и FOREIGN KEY.`);
                    } else {
                        setError(`Ошибка: ${errorMessage}`);
                    }
                }
            }
        } catch (err) {
            console.error('Ошибка при отправке SQL на сервер:', err);
            setError('Не удалось отправить SQL на сервер для обработки. Проверьте подключение к интернету и работу сервера.');
        } finally {
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }

            setLoading(false);
            setShowLoadingMessage(false);
            setTimeout(restoreFocus, 10);
        }
    };

    const restoreFocus = () => {
        if (activeElementRef.current && activeElementRef.current instanceof HTMLElement) {
            try {
                activeElementRef.current.focus();
            } catch (e) {
                console.error('Ошибка при восстановлении фокуса:', e);
            }
        }
    };

    useEffect(() => {
        const loadDefaultDiagram = async () => {
            // сохраняем активный элемент перед загрузкой
            activeElementRef.current = document.activeElement;

            try {
                setLoading(true);
                setShowLoadingMessage(true);

                const response = await fetch('/assets/example.drawio');

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.text();

                if (!data.includes('<mxfile')) {
                    throw new Error('Invalid diagram file format');
                }

                setXml(data);
                setError(null);
            } catch (err) {
                console.error('Error loading default diagram:', err);
                setError('Failed to load default diagram');
            } finally {
                setLoading(false);
                setShowLoadingMessage(false);
                setTimeout(restoreFocus, 10);
            }
        };

        loadDefaultDiagram();

        return () => {
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        // если SQL изменился и отличается от последнего обработанного,
        // показываем загрузку и сбрасываем ошибку
        if (sqlContent !== lastProcessedSql && sqlContent.trim() !== '') {
            setLoading(true);
            setError(null);

            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
            }
            loadingTimerRef.current = window.setTimeout(() => {
                if (loading) {
                    setShowLoadingMessage(true);
                }
            }, 1000);

            activeElementRef.current = document.activeElement;
        } else if (sqlContent === lastProcessedSql && loading) {
            setLoading(false);
            setShowLoadingMessage(false);
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        }
    }, [sqlContent, lastProcessedSql, loading]);

    useEffect(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }

        if (sqlContent && sqlContent.trim() !== '') {
            timerRef.current = window.setTimeout(() => {
                convertSqlToDrawio(sqlContent);
            }, 1000);
        }

        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, [sqlContent]);

    const handleSave = (event: { xml: string }) => {
        activeElementRef.current = document.activeElement;
        setXml(event.xml);
        setTimeout(restoreFocus, 10);
    };

    return (
        <div className="visual-editor">
            <div className="visual-editor-content">
                {showLoadingMessage && <div className="loading-overlay">Обработка SQL и генерация диаграммы...</div>}
                {error && <div className="error-message">{error}</div>}
                <DrawIoEmbed
                    xml={xml}
                    urlParameters={{
                        ui: "min",
                        spin: true,
                        dark: false,
                        nav: false,
                        toolbar: false,
                        chrome: false,
                        saveAndExit: false,
                        noSaveBtn: true,
                        noExitBtn: true
                    }}
                    configuration={{
                        editable: false,
                        resize: true,
                        border: '2px solid #f5f5f5'
                    }}
                    onLoad={() => {
                        setLoading(false);
                        setShowLoadingMessage(false);

                        const iframes = document.querySelectorAll('.visual-editor iframe');
                        if (iframes.length > 0) {
                            iframeRef.current = iframes[0] as HTMLIFrameElement;

                            if (iframeRef.current) {
                                iframeRef.current.setAttribute('tabindex', '-1');
                            }
                        }

                        setTimeout(restoreFocus, 10);
                    }}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
};

export default VisualEditor;