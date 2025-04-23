# Используем Python в качестве базового образа
FROM python:3.12-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем все необходимые файлы
COPY . .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install gunicorn psycopg2-binary

# Создаем директорию для статических файлов и данных
RUN mkdir -p ./backend/staticfiles ./backend/data

# Настраиваем переменные окружения для Django
ENV DJANGO_SETTINGS_MODULE=django_project.settings_prod
ENV PYTHONPATH=/app

# Собираем статические файлы
WORKDIR /app/backend
RUN python manage_prod.py collectstatic --noinput

# Экспонируем порт для приложения
EXPOSE 8000

# Создаем скрипт запуска
RUN echo '#!/bin/bash\ncd /app/backend\npython manage_prod.py migrate\npython manage_prod.py runserver 0.0.0.0:8000' > /app/start.sh && \
    chmod +x /app/start.sh

# Запускаем через скрипт, который выполнит миграции
CMD ["/app/start.sh"]