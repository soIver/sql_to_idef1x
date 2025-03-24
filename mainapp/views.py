from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import User
import json

def index(request):
    with open('react_apps/build/asset-manifest.json', 'r') as f:
        manifest = json.load(f)
    main_js_path = f'/collections{manifest['files']['main.js']}'

    context = {
        'main_js_path': main_js_path,
    }
    return render(request, 'myapp/index.html', context)

def login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        try:
            user = User.objects.get(email=email)
            if user.check_password(password):
                request.session['user_id'] = user.id
                return JsonResponse({'status': 'success', 'redirect_url': '/'})  # Успешный вход
            else:
                return JsonResponse({'status': 'error', 'message': 'Неверный пароль'})  # Ошибка пароля
        except User.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Пользователь с такой почтой не найден'})  # Ошибка email

    return JsonResponse({'status': 'error', 'message': 'Недопустимый метод запроса'})  # Ошибка метода

def register_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm-password')

        if password != confirm_password:
            return JsonResponse({'status': 'error', 'message': 'Пароли не совпадают'})

        if User.objects.filter(email=email).exists():
            return JsonResponse({'status': 'error', 'message': 'Пользователь с такой электронной почтой уже существует'})

        try:
            user = User.objects.create_user(email=email, password=password)
            return JsonResponse({'status': 'success', 'message': 'Регистрация прошла успешно', 'redirect_url': '/'})
        except ValidationError as e:
            return JsonResponse({'status': 'error', 'message': e.message_dict.get('password', ['Неизвестная ошибка'])[0]})

    return JsonResponse({'status': 'error', 'message': 'Недопустимый метод запроса'})