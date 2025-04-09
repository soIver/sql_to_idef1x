from django.urls import path
from . import views

urlpatterns = [
    path('projects/<int:project_id>/', views.update_project, name='update_project'),
    path('projects/<int:project_id>/delete/', views.delete_project, name='delete_project'),
    path('projects/save/', views.save_project, name='save_project'),
    path('projects/upload/', views.upload_file, name='upload_file'),
    path('projects/export-png/', views.export_png, name='export_png'),
    path('api/projects/export-png/', views.export_png, name='export_png_api'),
] 