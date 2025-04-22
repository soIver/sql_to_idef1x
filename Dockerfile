# Используем многоэтапную сборку для оптимизации образа
FROM python:3.12-slim as base

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем только requirements файлы для кэширования слоя зависимостей
COPY backend/requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install gunicorn psycopg2-binary

# Копируем собранный frontend
COPY frontend/dist /app/frontend/dist

# Копируем backend код
COPY backend /app/backend

# Создаем директорию для статических файлов
RUN mkdir -p /app/backend/staticfiles

# Настраиваем переменные окружения для Django
ENV DJANGO_SETTINGS_MODULE=django_project.settings_prod
ENV PYTHONPATH=/app

# Рабочая директория для запуска
WORKDIR /app/backend

# Собираем статические файлы
RUN python manage_prod.py collectstatic --noinput

# Экспонируем порт для приложения
EXPOSE 8000

# Запускаем приложение через gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "django_project.wsgi_prod:application"]