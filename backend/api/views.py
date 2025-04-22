from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_http_methods

from django_project.json2drawio import Visualizer
from django_project.sql2json import sql_to_json_data
from django_project.reverse import extract_sql_from_png
from django_project.embedding import embed_metadata_to_png

from .models import User, Project

from rest_framework import status
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view
from rest_framework.response import Response

import json, logging, tempfile, os, base64

from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)
MAX_SQL_LENGTH = 10000

@api_view(['POST'])
@ensure_csrf_cookie
def register_user(request):
    try:
        data = request.data
        email = data.get('email')
        password = data.get('password')
        password2 = data.get('password2')

        if not all([email, password, password2]):
            return Response({'error': 'Пожалуйста, заполните все поля'}, status=status.HTTP_400_BAD_REQUEST)

        if password != password2:
            return Response({'error': 'Пароли не совпадают'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'Пользователь с таким email уже существует'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(email=email, password=password)
        login(request, user)

        return Response({
            'message': 'Регистрация успешна',
            'email': user.email
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Ошибка при регистрации: {str(e)}")
        return Response({'error': 'Произошла ошибка при регистрации'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@ensure_csrf_cookie
def login_user(request):
    try:
        data = request.data
        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return Response({'error': 'Пожалуйста, заполните все поля'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, email=email, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                'message': 'Вход выполнен успешно',
                'email': user.email
            })
        return Response({'error': 'Неверный email или пароль'}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"Ошибка при входе: {str(e)}")
        return Response({'error': 'Произошла ошибка при входе'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@ensure_csrf_cookie
def get_csrf_token(request):
    return Response({'csrfToken': get_token(request)})

@api_view(['GET'])
def check_auth(request):
    return Response({
        'is_authenticated': request.user.is_authenticated,
        'email': request.user.email if request.user.is_authenticated else None
    })

@ensure_csrf_cookie
def index(request):
    return render(request, 'api/index.html')

@api_view(['GET'])
@login_required
def get_projects(request):
    try:
        projects = request.user.projects.all().values('id', 'title')
        return Response({'projects': list(projects)})
    except Exception as e:
        logger.error(f"Ошибка при получении проектов: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

@api_view(['POST'])
@login_required
def save_project(request):
    try:
        project = Project(user=request.user)
        project.title = request.data.get('title', 'Новый проект')
        project.save()
        return Response({
            'status': 'success',
            'project': {
                'id': project.id,
                'title': project.title
            }
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PATCH'])
@login_required
def update_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id, user=request.user)
        
        if 'title' in request.data:
            project.title = request.data.get('title')
        if 'sql_content' in request.data:
            project.sql_content = request.data.get('sql_content')
        
        project.save()
        
        return Response({
            'status': 'success',
            'project': {
                'id': project.id,
                'title': project.title,
                'sql_content': project.sql_content
            }
        })
    except Project.DoesNotExist:
        return Response({'status': 'error', 'message': 'Проект не найден'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@login_required
def delete_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id, user=request.user)
        project.delete()
        return Response({'status': 'success'})
    except Project.DoesNotExist:
        return Response({'status': 'error'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@ensure_csrf_cookie
def logout_view(request):
    try:
        logout(request)
        return Response({'status': 'success', 'message': 'Выход выполнен успешно'})
    except Exception as e:
        logger.error(f"Ошибка при выходе из системы: {str(e)}")
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@require_POST
@csrf_exempt
def sql_to_drawio(request):
    try:
        data = json.loads(request.body)
        sql_query = data.get('sql', '').strip()
        
        if not sql_query:
            return JsonResponse({'status': 'error', 'message': 'SQL запрос не должен быть пустым'}, status=400)
            
        if len(sql_query) > MAX_SQL_LENGTH:
            return JsonResponse({'status': 'error', 'message': f'SQL запрос слишком длинный (максимум {MAX_SQL_LENGTH} символов)'}, status=400)

        try:
            tables_data = sql_to_json_data(sql_query)
            if not tables_data:
                return JsonResponse({'status': 'error', 'message': 'SQL запрос не содержит определений таблиц'}, status=400)
        except Exception as e:
            logger.error(f"Error parsing SQL: {str(e)}")
            return JsonResponse({'status': 'error', 'message': f'Ошибка при обработке SQL: {str(e)}'}, status=400)

        try:
            vis = Visualizer(tables_data)
            drawio_xml = vis.visualize()
            
            if not drawio_xml or '<mxfile' not in drawio_xml:
                return JsonResponse({'status': 'error', 'message': 'Не удалось сгенерировать диаграмму из полученных данных'}, status=500)
        except Exception as e:
            logger.error(f"Error visualizing tables: {str(e)}")
            return JsonResponse({'status': 'error', 'message': f'Ошибка при создании диаграммы: {str(e)}'}, status=500)

        return JsonResponse({'status': 'success', 'xml': drawio_xml})
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Неверный формат JSON'}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JsonResponse({'status': 'error', 'message': 'Внутренняя ошибка сервера'}, status=500)

@api_view(['POST'])
@login_required
def upload_file(request):
    try:
        file = request.FILES.get('file')
        file_type = request.POST.get('type')
        
        if not file or not file_type:
            return Response({'error': 'Файл или тип файла не указаны'}, status=status.HTTP_400_BAD_REQUEST)
            
        project = Project(user=request.user)
        
        if file_type == 'sql':
            sql_content = file.read().decode('utf-8')
            project.title = file.name.replace('.sql', '')
            project.sql_content = sql_content
            project.save()
            
            return Response({
                'status': 'success',
                'projectId': project.id,
                'message': 'SQL файл успешно загружен'
            })
            
        elif file_type == 'png':
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
                for chunk in file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
                
            try:
                sql_content = extract_sql_from_png(temp_file_path)
                project.title = file.name.replace('.png', '')
                project.sql_content = sql_content
                project.save()
                
                return Response({
                    'status': 'success',
                    'projectId': project.id,
                    'message': 'PNG файл успешно обработан'
                })
            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        else:
            return Response({'error': f'Неподдерживаемый тип файла: {file_type}'}, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Ошибка при загрузке файла: {str(e)}")
        return Response({'error': f'Ошибка при обработке файла: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
@require_POST
def embed_sql_xml_to_image(request):
    try:
        data = json.loads(request.body)
        png_data_base64 = data.get('png_data', '')
        sql_query = data.get('sql_query', '')
        xml_data = data.get('xml_data', '')
        project_name = data.get('project_name', 'diagram')
        
        if not png_data_base64:
            return JsonResponse({'error': 'Не предоставлены данные PNG'}, status=400)
        
        try:
            if ',' in png_data_base64:
                png_data_base64 = png_data_base64.split(',', 1)[1]
            png_data = base64.b64decode(png_data_base64)
        except Exception as e:
            logger.error(f"Ошибка при декодировании Base64: {str(e)}")
            return JsonResponse({'error': 'Неверный формат данных PNG'}, status=400)
        
        try:
            embedded_png_data = embed_metadata_to_png(png_data, sql_query, xml_data)
            response = HttpResponse(embedded_png_data, content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename="{project_name}.png"'
            return response
            
        except Exception as process_error:
            logger.error(f"Ошибка при внедрении данных в PNG: {str(process_error)}")
            return JsonResponse({'error': f'Ошибка при внедрении данных в PNG: {str(process_error)}'}, status=500)
            
    except Exception as e:
        logger.error(f"Ошибка в обработчике embed_sql_xml_to_image: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)
