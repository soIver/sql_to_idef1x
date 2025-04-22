FROM python:3.12-slim as base

WORKDIR /app

COPY backend/ ./backend/

RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install gunicorn psycopg2-binary

COPY frontend/dist ./frontend/dist

RUN mkdir -p ./backend/staticfiles

ENV DJANGO_SETTINGS_MODULE=django_project.settings_prod
ENV PYTHONPATH=/app

WORKDIR /app/backend

RUN python manage_prod.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "django_project.wsgi_prod:application"]