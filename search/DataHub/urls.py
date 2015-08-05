# -*- coding: utf-8 -*-
# DataHub/urls.py

from django.conf.urls import patterns, include, url
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static

admin.autodiscover()

urlpatterns = patterns('',
                       url(r'^$', include('dashboard.urls')),
                       url(r'^dashboard/', include('dashboard.urls')),
                       url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
                       url(r'^admin/', include(admin.site.urls)),
                       url(r'^frontauth/', include('frontauth.urls')),
                       ) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
