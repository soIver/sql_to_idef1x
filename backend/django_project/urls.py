from django.contrib import admin
from django.urls import path
from myapp import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/convert/sql-to-drawio/', views.sql_to_drawio),
    path('api/projects/save/', views.save_project, name='save_project'),  # Переместить выше
    path('api/projects/<int:project_id>/get/', views.get_project, name='get_project'),
    path('api/projects/<int:project_id>/update/', views.update_project, name='update_project'),
    path('api/projects/<int:project_id>/delete/', views.delete_project, name='delete_project'),
    path('', views.index, name='home'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('api/projects/', views.get_projects, name='get_projects'),
    path('logout/', views.logout_view, name='logout'),
]
