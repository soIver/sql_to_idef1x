from django.urls import path
from . import views

urlpatterns = [
    path('projects/<int:project_id>/', views.update_project, name='update_project'),
    path('projects/<int:project_id>/delete/', views.delete_project, name='delete_project'),
    path('projects/save/', views.save_project, name='save_project'),
    path('projects/upload/', views.upload_file, name='upload_file'),
    path('projects/export-png/', views.export_png, name='export_png'),
    path('projects/embed-metadata/', views.embed_metadata, name='embed_metadata'),
    path('convert/sql-to-drawio/', views.sql_to_drawio),
    path('projects/', views.get_projects, name='get_projects'),
    path('projects/save/', views.save_project, name='save_project'),
    path('projects/upload/', views.upload_file, name='upload_file'),
    path('projects/<int:project_id>/update/', views.update_project, name='update_project'),
    path('projects/<int:project_id>/delete/', views.delete_project, name='delete_project'),
    path('projects/<int:project_id>/get/', views.get_project, name='get_project'),
    path('projects/export-png/', views.export_png, name='export_png'),
    path('register/', views.register_user, name='register_user'),
    path('check-auth/', views.check_auth, name='check_auth'),
    path('csrf-token/', views.get_csrf_token, name='get_csrf_token'),
    path('login/', views.login_user, name='login_user'),
    path('logout/', views.logout_view, name='logout'),
    path('', views.index, name='home')
] 