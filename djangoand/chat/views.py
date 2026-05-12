from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from chat.models import Room, Message
from chat.serializers import RoomSerializer, MessageSerializer


class CreateRoomView(APIView):
    """POST /api/rooms/ — create a new room, returns room code."""

    def post(self, request):
        name = request.data.get('name', '').strip()
        creator = request.data.get('creator', '').strip()

        if not name:
            return Response({'error': 'Room name is required.'}, status=400)
        if not creator:
            return Response({'error': 'Creator name is required.'}, status=400)
        if len(name) > 100:
            return Response({'error': 'Room name too long (max 100 chars).'}, status=400)

        room = Room.objects.create(name=name, creator=creator)
        return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


class RoomDetailView(APIView):
    """GET /api/rooms/<code>/ — check if a room exists and return its info."""

    def get(self, request, code):
        code = code.upper()
        try:
            room = Room.objects.get(code=code, is_active=True)
            return Response(RoomSerializer(room).data)
        except Room.DoesNotExist:
            return Response({'error': 'Room not found.'}, status=404)


class RoomMessagesView(APIView):
    """GET /api/rooms/<code>/messages/ — fetch message history."""

    def get(self, request, code):
        code = code.upper()
        try:
            room = Room.objects.get(code=code, is_active=True)
        except Room.DoesNotExist:
            return Response({'error': 'Room not found.'}, status=404)

        limit = int(request.query_params.get('limit', 50))
        messages = Message.objects.filter(room=room).order_by('-timestamp')[:limit]
        return Response(MessageSerializer(list(reversed(messages)), many=True).data)