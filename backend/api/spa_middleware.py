from django.http import HttpResponse
import os

class SPAMiddleware:
    """
    Middleware для обслуживания SPA (React) приложения.
    Перенаправляет все запросы, которые не к API и статическим файлам, на index.html
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.index_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend/dist/index.html')
        self.index_content = None
        
        # Загружаем содержимое index.html при инициализации
        try:
            with open(self.index_file_path, 'r', encoding='utf-8') as f:
                self.index_content = f.read()
        except Exception as e:
            print(f"Ошибка при загрузке index.html: {str(e)}")

    def __call__(self, request):
        response = self.get_response(request)
        
        # Если получили 404, и запрос не к API или статическим файлам - возвращаем index.html
        if (response.status_code == 404 and
            not request.path.startswith('/api/') and
            not request.path.startswith('/static/') and
            not request.path.startswith('/admin/') and
            self.index_content):
            
            return HttpResponse(self.index_content, content_type='text/html')
        return response