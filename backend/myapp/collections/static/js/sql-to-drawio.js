// sql-to-drawio.js
// --------------------------------------------------------------------------------
// Этот файл только для создания Monaco Editor и вызова конвертации SQL -> DrawIO.
// Все упоминания проектов убраны.
// --------------------------------------------------------------------------------

// Глобальная переменная под редактор
let sqlEditor = null;

// Опционально: метод для внешнего кода "установить текст":
window.setEditorValue = function(value) {
  if (!sqlEditor) {
    console.warn("Monaco editor не инициализирован");
    return;
  }
  sqlEditor.setValue(value);
};

document.addEventListener('DOMContentLoaded', function() {
    const csrfToken = document.getElementById('csrf_token')?.value;
    const visualContainer = document.getElementById('visual');

    // Настраиваем пути Monaco
    window.require.config({
        paths: {
            vs: 'https://unpkg.com/monaco-editor@0.33.0/min/vs'
        }
    });

    // Загружаем основной модуль редактора
    window.require(['vs/editor/editor.main'], function() {
        // Создаём Monaco Editor и сохраняем в глобальную переменную sqlEditor
        sqlEditor = monaco.editor.create(document.getElementById('sql-editor'), {
            language: 'sql',
            theme: 'vs-dark',
            automaticLayout: true
        });

        console.log("Monaco Editor создан:", sqlEditor);

        // Дебаунс-функция для SQL -> DrawIO
        const convertAndSave = _.debounce(async (sql) => {
            if (sql.trim().length < 10) return;  // Не конвертируем слишком короткий SQL

            try {
                const response = await fetch('/api/convert/sql-to-drawio/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({ sql })
                });

                const data = await response.json();
                if (data.status === 'success') {
                    ReactDOM.render(
                        React.createElement(VisualEditor, { xml: data.xml }),
                        visualContainer
                    );
                } else {
                    console.error("Conversion error:", data.message);
                }

                // Дополнительно: Сохраняем содержимое SQL проекта
                if (window.currentProjectId) {
                    await fetch('/api/projects/save/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({
                            id: window.currentProjectId,
                            sql_content: sql
                        }),
                        credentials: 'include'
                    });
                }

            } catch (error) {
                console.error('Conversion or save error:', error);
            }
        }, 1000);

        // Вызываем convertAndSave при каждом изменении редактора
        sqlEditor.onDidChangeModelContent(() => {
            convertAndSave(sqlEditor.getValue());
        });

        // Однократно при загрузке
        convertAndSave(sqlEditor.getValue());


    });
});
