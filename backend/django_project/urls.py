from django.contrib import admin
from django.urls import path
from myapp import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/convert/sql-to-drawio/', views.sql_to_drawio),
    path('api/projects/', views.get_projects, name='get_projects'),
    path('api/projects/save/', views.save_project, name='save_project'),
    path('api/projects/upload/', views.upload_file, name='upload_file'),
    path('api/projects/<int:project_id>/update/', views.update_project, name='update_project'),
    path('api/projects/<int:project_id>/delete/', views.delete_project, name='delete_project'),
    path('api/projects/<int:project_id>/get/', views.get_project, name='get_project'),
    path('api/projects/export-png/', views.export_png, name='export_png'),
    path('api/register/', views.register_user, name='register_user'),
    path('api/check-auth/', views.check_auth, name='check_auth'),
    path('api/csrf-token/', views.get_csrf_token, name='get_csrf_token'),
    path('api/login/', views.login_user, name='login_user'),
    path('api/logout/', views.logout_view, name='logout'),
    path('', views.index, name='home'),
]
