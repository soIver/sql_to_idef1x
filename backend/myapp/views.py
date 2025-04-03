from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_http_methods

# myapp/views.py
from django_project.json2drawio import Visualizer
from django_project.sql2json import sql_to_json_data
from .models import User, Project


@ensure_csrf_cookie
def index(request):
    with open('react_apps/build/asset-manifest.json', 'r') as f:
        manifest = json.load(f)
    main_js_path = f'/collections{manifest["files"]["main.js"]}'
    return render(request, 'myapp/index.html', {'main_js_path': main_js_path})

@csrf_protect
def login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        user = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            return JsonResponse({'status': 'success', 'redirect_url': '/'})
        else:
            # Возвращаем ошибку без редиректа
            return JsonResponse({
                'status': 'error',
                'message': 'Неверные учетные данные'
            }, status=400)

    return JsonResponse({'status': 'error', 'message': 'Метод не разрешен'}, status=405)

@ensure_csrf_cookie
def register_view(request):
    if request.method == 'POST':
        if not request.is_ajax():
            return HttpResponseBadRequest()
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm-password')

        if password != confirm_password:
            return JsonResponse({'status': 'error', 'message': 'Пароли не совпадают'})

        if User.objects.filter(email=email).exists():
            return JsonResponse({'status': 'error', 'message': 'Пользователь с такой электронной почтой уже существует'})

        try:
            user = User.objects.create_user(email=email, password=password)
            # Добавляем автоматический вход
            user = authenticate(request, username=email, password=password)
            if user:
                login(request, user)
            return JsonResponse({
                'status': 'success',
                'redirect_url': '/',
                'clear_cache': True  # Новый флаг
            })
        except ValidationError as e:
            return JsonResponse({'status': 'error', 'message': e.message_dict.get('password', ['Неизвестная ошибка'])[0]})

    return JsonResponse({'status': 'error', 'message': 'Недопустимый метод запроса'})


@login_required
@require_http_methods(["GET"])
def get_projects(request):
    projects = request.user.projects.all().values('id', 'title')
    return JsonResponse({'projects': list(projects)})

# views.py
@login_required
@require_http_methods(["GET"])
def get_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id, user=request.user)
        return JsonResponse({
            'id': project.id,
            'title': project.title,
            'sql_content': project.sql_content,
            'created_at': project.created_at,
            'updated_at': project.updated_at
        })
    except Project.DoesNotExist:
        return JsonResponse({'status': 'error'}, status=404)

@csrf_protect
@login_required
@require_http_methods(["POST"])
def save_project(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    project_id = data.get('id')
    sql_content = data.get('sql_content')
    title = data.get('title')

    if project_id:
        project = Project.objects.filter(id=project_id, user=request.user).first()
        if not project:
            return JsonResponse({'status': 'error', 'message': 'Project not found'}, status=404)
    else:
        project = Project(user=request.user)

    if title:
        project.title = title
    if sql_content is not None:
        project.sql_content = sql_content

    project.save()
    return JsonResponse({'status': 'success', 'project': {'id': project.id, 'title': project.title}})


@login_required
@require_http_methods(["PATCH"])
def update_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id, user=request.user)
        data = json.loads(request.body)
        project.title = data.get('title', project.title)
        project.save()
        return JsonResponse({'status': 'success'})
    except Project.DoesNotExist:
        return JsonResponse({'status': 'error'}, status=404)


@login_required
@require_http_methods(["DELETE"])
def delete_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id, user=request.user)
        project.delete()
        return JsonResponse({'status': 'success'})
    except Project.DoesNotExist:
        return JsonResponse({'status': 'error'}, status=404)

@csrf_protect
@login_required
def logout_view(request):
    logout(request)
    return JsonResponse({'status': 'success'})


import logging

logger = logging.getLogger(__name__)
MAX_SQL_LENGTH = 10000  # 10k символов

import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt


@require_POST
@csrf_exempt
def sql_to_drawio(request):
    try:
        data = json.loads(request.body)
        sql_query = data.get('sql', '').strip()

        # 1) проверить SQL (длину, пустоту)
        # 2) parse_sql → tables_data (чисто в памяти)
        tables_data = sql_to_json_data(sql_query)
        print(tables_data)
        if len(tables_data)==0:
            return JsonResponse({
                'status': 'error',
                'message': 'пустой json'
            }, status=500)

        # 3) Visualizer (чисто в памяти)
        vis = Visualizer(tables_data)
        drawio_xml = vis.visualize()  # возвращает строку-XML
        print(drawio_xml)

        # 4) JSON с этим XML
        return JsonResponse({
            'status': 'success',
            'xml': drawio_xml
        })
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JsonResponse({
            'status': 'error',
            'message': 'Внутренняя ошибка сервера'
        }, status=500)
