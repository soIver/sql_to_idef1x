import React, { useEffect, useState } from 'react';
import { DrawIoEmbed } from 'react-drawio';

function VisualEditor() {
    const [xml, setXml] = useState('');

    useEffect(() => {
        fetch('collections/static/example.drawio')
            .then((response) => response.text())
            .then((data) => setXml(data))
            .catch((error) => console.error('Error loading diagram:', error));
    }, []);

    const urlParameters = {
        ui: 'min', // Минимальный интерфейс
        chrome: '0', // Убираем панели
        nav: '0', // Убираем навигацию
        toolbar: '0', // Убираем панель инструментов
        menubar: '0', // Убираем меню
        statusbar: '0', // Убираем статусбар
    };

    const configuration = {
        editable: false, // Запрещаем редактирование
    };

    return (
        <DrawIoEmbed
            xml={xml}
            urlParameters={urlParameters}
            configuration={configuration}
        />
    );
}

export default VisualEditor;