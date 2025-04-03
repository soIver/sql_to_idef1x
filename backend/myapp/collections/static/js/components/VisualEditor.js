function VisualEditor({ xml = '' }) {
    return React.createElement(
        'div',
        {
            className: 'drawio-container',
            style: { height: '100%', width: '100%' }
        },
        React.createElement(window.DrawIoEmbed, {
            xml: xml,
            urlParameters: {
                ui: 'min',
                chrome: '0',
                nav: '0',
                toolbar: '0',
                menubar: '0',
                statusbar: '0'
            },
            configuration: {
                editable: false
            }
        })
    );
}