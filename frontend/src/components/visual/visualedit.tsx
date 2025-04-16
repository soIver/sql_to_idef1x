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

                // Убираем загрузку example.drawio
                setXml('');
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
            setShowLoadingMessage(true);
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

    const lastXmlRef = useRef(xml);
    
    // Обновляем ref при изменении xml
    useEffect(() => {
        lastXmlRef.current = xml;
    }, [xml]);

    const handleExport = useCallback(async (exportData?: {data: string, format: string}) => {
        console.log('Начало процесса экспорта');
        
        // Сохраняем текущий XML
        const currentXml = lastXmlRef.current;
        window.lastExportedXml = currentXml;

        // Если данные экспорта получены
        if (exportData?.data) {
            try {
                // Получаем название проекта
                const projectName = localStorage.getItem('activeProjectName') || 'diagram';
                const fileName = `${projectName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s_-]/g, '')
                    .replace(/\s+/g, '_')
                    .substring(0, 50)}_diagram.png`;

                // Обработка данных изображения
                const base64Data = exportData.data.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteArray = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteArray[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([byteArray], { type: 'image/png' });

                // Создаем и скачиваем файл
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                
                // Очистка
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 100);

                console.log('Экспорт завершен успешно');
                
                // Восстанавливаем XML через обновление состояния
                setTimeout(() => {
                    setXml(currentXml);
                }, 100);
                
                return true;
            } catch (error) {
                console.error('Ошибка экспорта:', error);
                setXml(currentXml);
                return false;
            }
        }

        // Если экспорт инициирован извне
        if (!drawioRef.current) {
            console.error('Ссылка на DrawIO недоступна');
            return false;
        }

        try {
            return new Promise<boolean>((resolve) => {
                const handleMessage = (event: MessageEvent) => {
                    if (event.data?.event === 'export') {
                        window.removeEventListener('message', handleMessage);
                        handleExport(event.data)
                            .then(resolve)
                            .catch(() => resolve(false));
                    }
                };

                window.addEventListener('message', handleMessage);

                drawioRef.current.exportDiagram({
                    format: 'png',
                    background: '#ffffff',
                });
            });
        } catch (error) {
            console.error('Ошибка инициализации экспорта:', error);
            return false;
        }
    }, [xml]);

    const handleOnExport = useCallback((data: {data: string, format: string}) => {
        console.log('Обработка события экспорта из DrawIO');
        if (data?.data) {
            handleExport(data);
        }
    }, [handleExport]);


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
                    onExport={handleOnExport}
                />
            </div>
        </div>
    );
});

export default VisualEditor;