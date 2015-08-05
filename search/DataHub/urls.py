# -*- coding: utf-8 -*-
# DataHub/urls.py

from django.conf.urls import patterns, include, url
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static

admin.autodiscover()

urlpatterns = patterns('',
                       url(r'^datahub/$', include('dashboard.urls')),
                       url(r'^datahub/dashboard/', include('dashboard.urls')),
                       url(r'^datahub/admin/doc/', include('django.contrib.admindocs.urls')),
                       url(r'^datahub/admin/', include(admin.site.urls)),
                       url(r'^datahub/frontauth/', include('frontauth.urls')),
                       ) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
