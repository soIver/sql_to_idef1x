import React, { useEffect, useState } from 'react';
import { DrawIoEmbed } from 'react-drawio';
import './visualedit.css';

const VisualEditor: React.FC = () => {
    const [xml, setXml] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadDiagram = async () => {
            try {
                setLoading(true);

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
                console.error('Error loading diagram:', err);
                setError('Failed to load diagram. Using default.');
                setXml(defaultXml);
            } finally {
                setLoading(false);
            }
        };

        loadDiagram();
    }, []);

    const handleSave = (event: { xml: string }) => {
        console.log('Diagram saved:', event.xml);
        setXml(event.xml);
    };

    if (loading) {
        return <div style={{ padding: 20 }}>Loading diagram...</div>;
    }

    return (
        <div className="visual-editor">
            <div className="visual-editor-content">
                {error && <div style={{ color: 'red', padding: 10 }}>{error}</div>}
                <DrawIoEmbed
                    xml={xml}
                    urlParameters={{
                        ui: "min",
                        chrome: "0",
                        nav: "0",
                        toolbar: "0",
                        spin: "1",
                        proto: "json"
                    }}
                    configuration={{
                        editable: true,
                        resize: true
                    }}
                    onLoad={() => console.log('Draw.io loaded')}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
};

export default VisualEditor;