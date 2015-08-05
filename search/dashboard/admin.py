# -*- coding: utf-8 -*-
# admin.py

from django.contrib import admin
from dashboard.models import Metric, Query, Operator, Stream, Image, Place


class StreamAdmin(admin.ModelAdmin):
    readonly_fields = ['imageTag']


class ImageAdmin(admin.ModelAdmin):
    readonly_fields = ['imageTag']


admin.site.register(Metric)
admin.site.register(Query)
admin.site.register(Operator)
admin.site.register(Stream, StreamAdmin)
admin.site.register(Image, ImageAdmin)
admin.site.register(Place)
