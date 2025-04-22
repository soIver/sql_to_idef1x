from django.http import HttpResponse
from django.conf import settings
import os

class SPAMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.index_file = None
        try:
            with open(os.path.join(settings.BASE_DIR, '../frontend/dist/index.html'), 'r') as f:
                self.index_file = f.read()
        except:
            pass

    def __call__(self, request):
        response = self.get_response(request)
        
        if response.status_code == 404 and not request.path.startswith('/api/') and self.index_file:
            return HttpResponse(self.index_file)
        return response