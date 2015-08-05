# -*- coding: utf-8 -*-
# views.py

import urllib2
import json
import datetime
import mimetypes

from django.http import HttpResponse, Http404
from django.template import Context, loader
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect

from dashboard.models import Metric, Query, Operator, Stream, FavoriteQuery, Place
import tsdb
import error

g_cache_counter = 0


def urlopen(url):
    global g_cache_counter
    g_cache_counter += 1
    url += "&__cache=%d" % (g_cache_counter)
    return urllib2.urlopen(url)


# 캐쉬: 일단 local memory variable 로 캐싱함.
g_cachedStreamsJSON = None
g_cachedStreamObjects = None


def _getAllStreamsString():
    global g_cachedStreamsJSON
    global g_cachedStreamObjects

    if g_cachedStreamsJSON:
        return g_cachedStreamsJSON


    # 캐쉬가 없다면
    print "no cache. read start."
    res = []
    backup = []

    allStreams = Stream.objects.all()
    for s in allStreams:
        backup.append(s)

    def streamByName(name):
        for s in allStreams:
            if s.metric == name:
                return s

    # 모든 메트릭을 대상으로, 메타 데이터가 존재하면 입힌다.
    for metricName in tsdb.list_series():
        entry = {
            'streamID': '_' + metricName,
            'metric': metricName,
            'keywords': [],
            'buildingName': None,
            'image': None
        }

        stream = streamByName(metricName)
        if stream:
            try:
                res.append(stream.toDictionary())
            except Exception, e:
                # print stream.id, stream.metric
                raise e

            # 결과에 참여한 스트림은 제거
            backup.remove(stream)
        else:
            res.append(entry)

    # 결과에서 빠진 녀석이 있는가?
    for s in backup:
        # 		print "add missing: %s" % ( s.metric )
        res.append(s.toDictionary())

    # 결과를 캐싱한다.
    g_cachedStreamObjects = res
    res = json.dumps(res).encode('utf-8')
    g_cachedStreamsJSON = res

    print "caching done."
    return res


_getAllStreamsString()  # 런칭시 한번 해버림.


def streamByStreamID(streamID):
    for entry in g_cachedStreamObjects:
        if str(entry['streamID']) == str(streamID):
            return entry


def purge(request):
    global g_cachedStreamsJSON
    g_cachedStreamsJSON = None
    return redirect('/')


def fixStreams(request):
    for s in Stream.objects.all():
        s.metric = s.metric.strip()
        s.keywords = s.keywords.strip()
        s.save()

    return HttpResponse("success")


# Favorite Queries
def _favoritesForUser(user):
    res = []

    ret = FavoriteQuery.objects.filter(user=user)
    for query in ret:
        res.append(query.toDictionary())

    return res


def _places():
    res = []

    for place in Place.objects.all():
        res.append(place.toDictionary())

    res = json.dumps(res).encode('utf-8')
    return res


@login_required(login_url='/frontauth/login/')
def index(request):
    template = loader.get_template("dataSearch.html")
    context = Context({
        'user': request.user,
        'streams': _getAllStreamsString(),
        'favorites': _favoritesForUser(request.user),
        'places': _places()
    })

    return HttpResponse(template.render(context))


def addFavoriteQuery(request):
    if request.user:
        url = request.REQUEST.get("url", None)
        if url and len(url):
            name = request.REQUEST.get("name", "").strip()
            if len(name) == 0:
                name = url

            query = FavoriteQuery(user=request.user, name=name, url=url)
            query.save()
            return HttpResponse("[true, %d]" % query.id, content_type="application/javascript")

    return HttpResponse("[false]", content_type="application/javascript")


def removeFavoriteQuery(request):
    if request.user:
        query_id = request.REQUEST.get("id", None)
        if query_id:
            query = FavoriteQuery(pk=query_id)
            query.delete()

            return HttpResponse("[true, %s]" % query_id, content_type="application/javascript")

    return HttpResponse("[false]", content_type="application/javascript")


def make_response(code, result=None):
    res = {
        "code": code,
        "message": error.MESSAGES[code],
    }
    if result != None:
        res["result"] = result

    content = json.dumps(res, sort_keys=True).encode('utf-8')

    response = HttpResponse(content)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    response["Access-Control-Max-Age"] = "1000"
    response["Access-Control-Allow-Headers"] = "*"
    return response


def series(request):
    # start
    start = request.REQUEST.get("start", None)
    try:
        start = datetime.datetime.strptime(start, "%Y/%m/%d-%H:%M:%S")
    except (ValueError, TypeError):
        return make_response(error.CODE_INVALID_PARAMETERS)

    # end
    end = request.REQUEST.get("end", None)
    try:
        end = datetime.datetime.strptime(end, "%Y/%m/%d-%H:%M:%S")
    except (ValueError, TypeError):
        return make_response(error.CODE_INVALID_PARAMETERS)

    # metrics
    m = request.REQUEST.get("m", None)
    if m is None:
        return make_response(error.CODE_INVALID_PARAMETERS)

    # aggregator
    aggregator = request.REQUEST.get("agg", None)
    if aggregator:
        aggregator, group_by = aggregator.split('-')

    else:
        aggregator = None
        group_by = None

    # retreive
    res = {}
    for series_name in m.split(','):
        res[series_name] = tsdb.get_series(series_name, start, end, aggregator=aggregator, group_by=group_by)

    callback = request.REQUEST.get("callback", None)
    if callback:
        res = "%s(" + json.dumps(res) + ");"
        return HttpResponse(res, content_type="application/javascript")

    else:
        return HttpResponse(json.dumps(res).encode('utf-8'), content_type="application/javascript")


def chart(request):
    url = 'http://apollo-na-uploads.s3.amazonaws.com/1421911606908/Chart.jpg'
    contents = urllib2.urlopen(url).read()
    mimetype = mimetypes.guess_type(url)
    return HttpResponse(contents, content_type=mimetype)


def listQueries(request):
    queryParams = []

    for query in Query.objects.all():
        queryParams.append({
            'name': query.name,
            'metric': query.metric,
            'start': query.start,
            'end': query.end,
            'queryParam': query.queryParam()
        })

    return HttpResponse(json.dumps(queryParams).encode('utf-8'))


def getAllStreams(request):
    res = _getAllStreamsString()

    # JSONP?
    callback = request.GET["callback"]
    if callback:
        text = callback + "(" + res + ");"
        return HttpResponse(text, content_type="application/javascript")

    else:
        return HttpResponse(res)


def getAllMetrics(request):
    res = []

    for metric in Metric.objects.all():
        res.append(metric.name)

    return HttpResponse(json.dumps(res))


def getAllOperators(request):
    res = []

    for operator in Operator.objects.all():
        res.append(operator.toDictionary())

    return HttpResponse(json.dumps(res).encode('utf-8'))


@login_required(login_url='/admin/')
def pickPoint(request, streamID):
    if not request.user.is_staff:
        raise Http404

    template = loader.get_template("pickPoint.html")
    context = Context({
        'stream': Stream.objects.get(pk=streamID)
    })

    return HttpResponse(template.render(context))


@login_required(login_url='/admin/')
def savePoint(request, streamID):
    if not request.user.is_staff:
        raise Http404

    s = Stream.objects.get(pk=streamID)
    s.coordX = float(request.REQUEST.get('coordX', 0))
    s.coordY = float(request.REQUEST.get('coordY', 0))
    s.save()

    return redirect('/admin/Dashboard/stream/%s/' % streamID)
