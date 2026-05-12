from django.urls import re_path
from chat import consumers

websocket_urlpatterns = [
    # ws://localhost:8000/ws/chat/<ROOM_CODE>/<USERNAME>/
    re_path(
        r'ws/chat/(?P<room_code>[A-Z0-9]{6})/(?P<username>[^/]+)/$',
        consumers.ChatConsumer.as_asgi()
    ),
]