# -*- coding: utf-8 -*-
# frontauth/views.py

from django.core.context_processors import csrf
from django.shortcuts import render_to_response, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import HttpResponseRedirect


def loginview(request):
    c = {}
    try:
        c["next"] = request.GET["next"]
    except:
        pass

    c.update(csrf(request))

    return render_to_response('login.html', c)


def auth_and_login(request, onsuccess='/datahub', onfail='/datahub/frontauth/login/'):
    user = authenticate(username=request.POST['email'], password=request.POST['password'])
    if user is not None:
        login(request, user)

        try:
            next = request.POST["next"]
        except:
            next = None

        if next:
            return redirect(next)
        else:
            return redirect(onsuccess)
    else:
        return redirect(onfail)


def create_user(username, email, password):
    user = User(username=username, email=email)
    user.set_password(password)
    user.save()
    return user


def user_exists(username):
    user_count = User.objects.filter(username=username).count()
    if user_count == 0:
        return False

    return True


def sign_up_in(request):
    post = request.POST
    if not user_exists(post['email']):
        user = create_user(username=post['email'], email=post['email'], password=post['password'])
        return auth_and_login(request)
    else:
        return redirect("/datahub/frontauth/login/")


def logoutview(request):
    logout(request)
    return HttpResponseRedirect("/datahub/frontauth/login/")
