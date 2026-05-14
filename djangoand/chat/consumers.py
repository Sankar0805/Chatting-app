import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time group chat.

    Flow:
      connect()   → validate room code → join channel group → send history
      receive()   → save message to DB → broadcast to group
      disconnect()→ remove from group → broadcast leave event
    """

    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.username = self.scope['url_route']['kwargs']['username']
        self.group_name = f'chat_{self.room_code}'

        room = await self.get_room(self.room_code)
        if not room:
            await self.close(code=4004)
            return

        self.room = room

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        history = await self.get_history(room)
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': history,
        }))

        await self.channel_layer.group_send(self.group_name, {
            'type': 'user_join',
            'username': self.username,
            'time': self._now(),
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_send(self.group_name, {
                'type': 'user_leave',
                'username': self.username,
                'time': self._now(),
            })
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'message':
            text = data.get('text', '').strip()
            if not text:
                return

            saved = await self.save_message(self.room, self.username, text)

            await self.channel_layer.group_send(self.group_name, {
                'type': 'chat_message',
                'id': saved['id'],
                'username': self.username,
                'text': text,
                'time': saved['time'],
            })

        elif msg_type == 'ping':
            await self.channel_layer.group_send(self.group_name, {
                'type': 'user_ping',
                'username': self.username,
            })


    async def chat_message(self, event):
        """Broadcast a regular chat message to this WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'id': event['id'],
            'username': event['username'],
            'text': event['text'],
            'time': event['time'],
        }))

    async def user_join(self, event):
        await self.send(text_data=json.dumps({
            'type': 'join',
            'username': event['username'],
            'time': event['time'],
        }))

    async def user_leave(self, event):
        await self.send(text_data=json.dumps({
            'type': 'leave',
            'username': event['username'],
            'time': event['time'],
        }))

    async def user_ping(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ping',
            'username': event['username'],
        }))


    @database_sync_to_async
    def get_room(self, code):
        from chat.models import Room
        try:
            return Room.objects.get(code=code, is_active=True)
        except Room.DoesNotExist:
            return None

    @database_sync_to_async
    def get_history(self, room, limit=50):
        from chat.models import Message
        msgs = Message.objects.filter(room=room).order_by('-timestamp')[:limit]
        return [
            {
                'id': m.id,
                'username': m.username,
                'text': m.text,
                'time': m.timestamp.strftime('%H:%M'),
            }
            for m in reversed(list(msgs))
        ]

    @database_sync_to_async
    def save_message(self, room, username, text):
        from chat.models import Message
        msg = Message.objects.create(room=room, username=username, text=text)
        return {
            'id': msg.id,
            'time': msg.timestamp.strftime('%H:%M'),
        }

    def _now(self):
        return timezone.now().strftime('%H:%M')
