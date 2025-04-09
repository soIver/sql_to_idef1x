import React, { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { DrawIoEmbed, DrawIoEmbedRef } from 'react-drawio';
import './visualedit.css';

interface SqlToDrawioResponse {
    status: string;
    xml?: string;
    message?: string;
}

interface VisualEditorProps {
    sqlContent: string;
}

interface VisualEditorRef {
    exportDiagram: () => void;
}

interface DrawIoWindow extends Window {
    editor?: {
        getXml: () => string;
    };
}

declare global {
    interface Window {
        lastExportedXml?: string;
    }
}

const VisualEditor = forwardRef<VisualEditorRef, VisualEditorProps>(({ sqlContent }, ref) => {
    const [xml, setXml] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastProcessedSql, setLastProcessedSql] = useState<string>('');
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const activeElementRef = useRef<Element | null>(null);
    const drawioRef = useRef<DrawIoEmbedRef>(null);

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

    const handleExport = () => {
        console.log('Вызвана функция handleExport в VisualEditor');
        if (drawioRef.current) {
            console.log('drawioRef.current существует, вызываем exportDiagram');

            // Сохраняем текущее XML перед экспортом
            const currentXml = xml;
            console.log('Текущее XML перед экспортом (длина):', currentXml.length);

            // Сохраняем XML в глобальной переменной для использования в onExport
            window.lastExportedXml = currentXml;

            try {
                localStorage.setItem('lastExportedDiagramXml', currentXml);
                localStorage.setItem('lastExportTime', Date.now().toString());
                console.log('XML сохранен в localStorage с отметкой времени:', Date.now());

                const checkXmlInterval = setInterval(() => {
                    if (xml !== currentXml) {
                        console.log('XML изменился! Восстанавливаем из lastExportedXml');
                        setXml(currentXml);
                    }
                }, 50);

                setTimeout(() => {
                    clearInterval(checkXmlInterval);
                }, 3000);

                // вместо прямого экспорта PNG отправляем SQL и XML на сервер,
                // который встроит их в PNG файл и вернет готовый файл для скачивания
                const activeProjectId = localStorage.getItem('activeProjectId');

                if (activeProjectId) {
                    const sqlContentElement = document.querySelector('.monaco-editor');
                    let sqlContent = '';

                    if (sqlContentElement) {
                        const monacoEditor = (window as any).monaco?.editor?.getEditors()[0];
                        if (monacoEditor) {
                            sqlContent = monacoEditor.getValue() || '';
                        } else {
                            const textarea = sqlContentElement.querySelector('textarea');
                            if (textarea) {
                                sqlContent = textarea.value || '';
                            }
                        }
                    }
                    if (!sqlContent) {
                        sqlContent = localStorage.getItem('lastSqlContent') || '';
                    }

                    // CSRF из печенек
                    const getCookie = (name: string): string => {
                        const value = `; ${document.cookie}`;
                        const parts = value.split(`; ${name}=`);
                        if (parts.length === 2) {
                            const part = parts.pop();
                            if (part) return part.split(';').shift() || '';
                        }
                        return '';
                    };

                    const csrfToken = getCookie('csrftoken');

                    const requestData = {
                        project_id: activeProjectId,
                        sql_content: sqlContent,
                        xml_content: currentXml
                    };

                    console.log('Подготовлены данные для отправки:', {
                        project_id: activeProjectId,
                        sql_length: sqlContent.length,
                        xml_length: currentXml.length
                    });

                    fetch('/api/projects/export-png/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify(requestData)
                    })
                        .then(response => {
                            console.log('Получен ответ от сервера:', {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries())
                            });

                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `diagram_${activeProjectId}.png`;
                            document.body.appendChild(a);
                            a.click();
                            URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            console.log('Файл успешно экспортирован с метаданными');

                            setTimeout(() => {
                                if (xml !== currentXml) {
                                    console.log('Обнаружено изменение XML, восстанавливаем предыдущее состояние');
                                    setXml(currentXml);
                                }
                            }, 100);
                        })
                        .catch(error => {
                            console.error('Ошибка при экспорте PNG с метаданными:', error);
                            console.error('Детали ошибки:', {
                                message: error.message,
                                stack: error.stack
                            });

                            // если что-то пошло не так, используем обычный экспорт без метаданных
                            console.log('Переключаемся на стандартный экспорт');
                            localStorage.setItem('pendingExport', 'true');
                            drawioRef.current?.exportDiagram({
                                format: 'png',
                                background: '#ffffff'
                            });

                            setTimeout(() => {
                                if (xml !== currentXml) {
                                    console.log('Обнаружено изменение XML, восстанавливаем предыдущее состояние');
                                    setXml(currentXml);
                                }
                            }, 100);
                        });
                } else {
                    localStorage.setItem('pendingExport', 'true');
                    drawioRef.current?.exportDiagram({
                        format: 'png',
                        background: '#ffffff'
                    });
                }
            } catch (e) {
                console.error('Ошибка при экспорте:', e);
                localStorage.setItem('pendingExport', 'true');
                drawioRef.current.exportDiagram({
                    format: 'png',
                    background: '#ffffff'
                });

                setTimeout(() => {
                    if (xml !== currentXml) {
                        setXml(currentXml);
                    }
                }, 100);
            }
        } else {
            console.log('drawioRef.current не существует');
        }
    };

    useImperativeHandle(ref, () => ({
        exportDiagram: handleExport
    }));

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.action === 'getXml') {
                const editor = (iframeRef.current?.contentWindow as DrawIoWindow)?.editor;
                if (editor) {
                    const xml = editor.getXml();
                    iframeRef.current?.contentWindow?.postMessage({
                        action: 'xml',
                        xml: xml
                    }, '*');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <div className="visual-editor">
            <div className="visual-editor-content">
                {showLoadingMessage && <div className="loading-overlay">Обработка SQL и генерация диаграммы...</div>}
                {error && <div className="error-message">{error}</div>}
                <DrawIoEmbed
                    ref={drawioRef}
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
                    onExport={(data) => {
                        console.log('Получены данные экспорта:', data);
                        console.log('Тип данных:', typeof data.data);
                        console.log('Начало данных:', typeof data.data === 'string' ? data.data.substring(0, 50) : 'Не строка');

                        const isPendingExport = localStorage.getItem('pendingExport') === 'true';
                        if (isPendingExport && window.lastExportedXml) {
                            console.log('Обнаружен отложенный экспорт, восстанавливаем XML');
                            setTimeout(() => {
                                setXml(window.lastExportedXml || '');
                                localStorage.removeItem('pendingExport');
                            }, 0);
                        }

                        if (data && data.data) {
                            try {
                                if (typeof data.data === 'string' && data.data.startsWith('data:')) {
                                    const a = document.createElement('a');
                                    a.href = data.data;
                                    a.download = 'diagram.png';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    console.log('Файл успешно сохранен через простой метод');

                                    if (!isPendingExport && window.lastExportedXml) {
                                        setTimeout(() => {
                                            setXml(window.lastExportedXml || '');
                                        }, 0);
                                    }
                                    return;
                                }

                            } catch (error) {
                                console.error('Ошибка при сохранении файла:', error);

                                if (!isPendingExport && window.lastExportedXml) {
                                    setTimeout(() => {
                                        setXml(window.lastExportedXml || '');
                                    }, 0);
                                }
                            }
                        } else {
                            console.error('Нет данных для экспорта');

                            if (!isPendingExport && window.lastExportedXml) {
                                setTimeout(() => {
                                    setXml(window.lastExportedXml || '');
                                }, 0);
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
});

export default VisualEditor;