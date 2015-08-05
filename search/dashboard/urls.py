# -*- coding: utf-8 -*-
# urls.py

from django.conf.urls import patterns, url
from dashboard import views

urlpatterns = patterns('',
                       url(r'^$', views.index, name='index'),
                       url(r'^purge/$', views.purge, name='purge'),
                       url(r'^pickPoint/(?P<streamID>\S+)/$', views.pickPoint, name='pickPoint'),
                       url(r'^savePoint/(?P<streamID>\S+)/$', views.savePoint, name='savePoint'),
                       url(r'^fixStreams/$', views.fixStreams, name='fixStreams'),
                       url(r'^series/$', views.series, name='series'),
                       url(r'^chart/$', views.chart, name='chart'),
                       url(r'^listQueries/$', views.listQueries, name='listQueries'),
                       url(r'^getAllMetrics/$', views.getAllMetrics, name='getAllMetrics'),
                       url(r'^getAllStreams/$', views.getAllStreams, name='getAllStreams'),
                       url(r'^getAllOperators/$', views.getAllOperators, name='getAllOperators'),
                       url(r'^addFavoriteQuery/$', views.addFavoriteQuery, name='addFavoriteQuery'),
                       url(r'^removeFavoriteQuery/$', views.removeFavoriteQuery, name='removeFavoriteQuery'))
