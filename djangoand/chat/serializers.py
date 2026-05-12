from rest_framework import serializers
from chat.models import Room, Message


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'code', 'name', 'creator', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'username', 'text', 'timestamp', 'time']

    def get_time(self, obj):
        return obj.timestamp.strftime('%H:%M')