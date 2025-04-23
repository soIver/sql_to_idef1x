from .settings import *
import os

# Отключаем режим отладки
DEBUG = False

# Разрешаем все хосты (в идеале, указать только конкретные домены)
ALLOWED_HOSTS = ['*'] 

# Добавляем middleware для SPA
MIDDLEWARE.append('api.spa_middleware.SPAMiddleware')

# Настройка БД для продакшена
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'sql2idef1x'),
        'USER': os.environ.get('DB_USER', ''),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'amvera-superbot-cnpg-sql2idef1x-db-rw'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Настройки для статических файлов
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, '../frontend/dist')
]

# Настройки для обслуживания собранного React-приложения
TEMPLATES[0]['DIRS'] = [os.path.join(BASE_DIR, '../frontend/dist')]

# Обновляем список доверенных источников
CORS_ALLOWED_ORIGINS = [
    "https://sql2idef1x.amvera.io",
]

CSRF_TRUSTED_ORIGINS = [
    "https://sql2idef1x.amvera.io",
]

# Настройки безопасности для продакшена
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

# Папка для данных приложения (постоянное хранилище)
DATA_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)