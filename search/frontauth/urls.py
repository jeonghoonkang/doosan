# -*- coding: utf-8 -*-
# frontauth/urls.py

from django.conf.urls import patterns, url
from frontauth import views

urlpatterns = patterns('',
                       url(r'^login/', 'frontauth.views.loginview'),
                       url(r'^logout/', 'frontauth.views.logoutview'),
                       url(r'^auth/', 'frontauth.views.auth_and_login'),
                       url(r'^signup/', 'frontauth.views.sign_up_in'),
                       )
