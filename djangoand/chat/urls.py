
from django.urls import path
from chat import views

urlpatterns = [
    path('rooms/', views.CreateRoomView.as_view(), name='create-room'),
    path('rooms/<str:code>/', views.RoomDetailView.as_view(), name='room-detail'),
    path('rooms/<str:code>/messages/', views.RoomMessagesView.as_view(), name='room-messages'),
]