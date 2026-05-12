from django.contrib import admin
from chat.models import Room, Message


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'creator', 'created_at', 'is_active']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'name', 'creator']
    readonly_fields = ['code', 'created_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['room', 'username', 'text', 'timestamp']
    list_filter = ['room', 'timestamp']
    search_fields = ['username', 'text']
    readonly_fields = ['timestamp']