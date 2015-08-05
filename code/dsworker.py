#! /usr/bin/python
# -*- coding: utf-8 -*-
# dsworker.py

from optparse import OptionParser
import time
import datetime
import traceback
import requests
import worker
from influxdb.influxdb08 import client as influxdb
from dateutil.relativedelta import relativedelta


################################################################################
#
#	TSDB -> OpenTSDB 
#
################################################################################

def check_values(points, value):
    sz = 10
    if sz > len(points):
        sz = len(points)

    if sz > 0:
        s = 0
        for p in points[-sz:]:
            s += p[1]

        y = s / float(sz)
        if y > 0:
            diff = (value - y) / y
            if abs(diff) > 0.1:
                return False

    return True


def lastTimeForSeries(db, series):  # series 의 마지막 시각을 seconds 로 반환
    try:
        query = "select time, value from %s limit 1 order desc" % series
        ret = db.query(query, 's')

    except influxdb.InfluxDBClientError:
        traceback.print_exc()
        return None

    if len(ret):
        return ret[0]["points"][0][0]


def lastPointsForSeries(db, series, N):  # series 의 마지막 시각을 seconds 로 반환
    try:
        query = "select time, value from %s limit %d order desc" % (series, N)
        ret = db.query(query, 's')

    except influxdb.InfluxDBClientError:
        traceback.print_exc()
        return []

    if len(ret):
        res = []
        for (t, seq, value) in reversed(ret[0]["points"]):
            res.append([t, value])

        return res

    return []


def migrate_usage(db, nodeid):
    target = "usage.kWh.%s" % nodeid
    start = lastTimeForSeries(db, target)
    if start is None:
        start = "2015/03/01-00:00:00"
    else:
        start = str(start + 1)

    url = "http://125.7.128.52:4242/api/query?start=%s&m=avg:gyu_RC1_etype.t_current{nodeid=%s}" % (start, nodeid)

    try:
        ret = requests.get(url, timeout=30)
    except:
        traceback.print_exc()
        ret = None

    if ret and ret.status_code == 200:
        points = ret.json()[0]["dps"]

        times = sorted(points.keys())

        prev = lastPointsForSeries(db, target, 10)

        arr = []
        for t in times:
            value = points[t]
            if check_values(prev, value):
                # 전 값보다 작다면 보정한다.
                if len(prev) > 0 and prev[-1][1] > value:
                    value = prev[-1][1]

                arr.append([float(t), value])
                prev.append(arr[-1])

        # 새로 갱신한다.
        data = [{
            'points': arr,
            'name': target,
            'columns': ['time', 'value']
        }]
        ret = db.write_points_with_precision(data, 's')


def migrate_current(db, nodeid):
    for ty in ['a', 'b', 'c']:
        target = "current_%s.A.%s" % (ty, nodeid)
        start = lastTimeForSeries(db, target)
        if start is None:
            start = "2015/03/01-00:00:00"
        else:
            start = str(start + 1)

        url = "http://125.7.128.52:4242/api/query?start=%s&m=avg:gyu_RC1_etype.current_%s{nodeid=%s}" % (
        start, ty, nodeid)

        try:
            ret = requests.get(url, timeout=30)
        except:
            traceback.print_exc()
            ret = None

        if ret and ret.status_code == 200:
            points = ret.json()[0]["dps"]
            times = sorted(points.keys())
            arr = []
            for t in times:
                value = points[t] / 100
                arr.append([float(t), value])

            # 새로 갱신한다.
            data = [{
                'points': arr,
                'name': target,
                'columns': ['time', 'value']
            }]
            ret = db.write_points_with_precision(data, 's')


def migrate_voltage(db, nodeid):
    for ty in ['a', 'b', 'c']:
        target = "voltage_%s.V.%s" % (ty, nodeid)
        start = lastTimeForSeries(db, target)
        if start is None:
            start = "2015/03/01-00:00:00"
        else:
            start = str(start + 1)

        url = "http://125.7.128.52:4242/api/query?start=%s&m=avg:gyu_RC1_etype.voltage_%s{nodeid=%s}" % (
        start, ty, nodeid)

        try:
            ret = requests.get(url, timeout=30)
        except:
            traceback.print_exc()
            ret = None

        if ret and ret.status_code == 200:
            points = ret.json()[0]["dps"]
            times = sorted(points.keys())
            arr = []
            for t in times:
                value = points[t] / 10
                arr.append([float(t), value])

            # 새로 갱신한다.
            data = [{
                'points': arr,
                'name': target,
                'columns': ['time', 'value']
            }]
            ret = db.write_points_with_precision(data, 's')


################################################################################
#
#	2 차 메트릭 (diffs)
#
################################################################################

LERP_MARGIN = relativedelta(days=3)  # 15 분 갭을 둔다.


def do_diff_func(s, t1, t2):
    def lerp(s, t, idx_start):
        idx = idx_start
        while idx < len(s):
            x, y = s[idx]
            if t < x:
                if idx == 0:
                    # return -1, 0 # 범위 밖.
                    return idx_start, s[idx_start][1]

                else:
                    x0, y0 = s[idx - 1]
                    return idx, ((t - x0) * y + (x - t) * y0) / (x - x0)

            elif x == t:
                return idx, y

            idx += 1

        # return -1, 0 # 범위 밖
        return len(s) - 1, s[-1][1]

    assert t1 <= t2

    #
    xaxis = []
    for (t, v) in s:
        xaxis.append(t)

    xaxis = list(set(xaxis))
    xaxis.sort()

    idx1, v1 = lerp(s, t1, 0)
    idx2, v2 = lerp(s, t2, idx1)

    print "series = ", s[-10:]
    print "len = ", len(s)
    print 's[idx1] = ', s[idx1]
    print 's[idx2] = ', s[idx2]
    print "t1 = ", t1, datetime.datetime.fromtimestamp(t1)
    print "t2 = ", t2, datetime.datetime.fromtimestamp(t2)
    print "idx1 = %d, idx2 = %d" % (idx1, idx2)
    print "v1 = %f, v2 = %f" % (v1, v2)

    assert idx1 <= idx2
    assert v1 <= v2

    return v2 - v1


def diffFunc(db, target, sources, startDateTime, endDateTime, groupBy):
    assert len(sources) == 1

    try:
        t0 = worker.dateTimeToInfluxDBQueryParam(startDateTime - LERP_MARGIN)
        t1 = worker.dateTimeToInfluxDBQueryParam(endDateTime + LERP_MARGIN)
        query = "select value from %s where time > '%s' and time < '%s' order asc" % (sources[0], t0, t1)
        data = db.query(query, 's')

    except influxdb.InfluxDBClientError:
        traceback.print_exc()
        data = []

    if len(data):
        # 접속 시간을 구한다.
        arr = []
        for (t, seq, v) in data[0]["points"]:
            arr.append((t, v))

        t0 = dateTimeToEpoch(startDateTime)
        t1 = dateTimeToEpoch(endDateTime)
        value = do_diff_func(arr, t0, t1)
        t = worker.dateTimeToEpochTimeForInfluxDB(endDateTime)  # 구간 우측 끝 값

        # 새로 갱신한다.
        data = [{
            'points': [[t, value]],
            'name': target,
            'columns': ['time', 'value']
        }]
        ret = db.write_points_with_precision(data, 's')


def updateDiff(db, nodeid, start_sec=None):
    # 월 단위 사용량
    worker.Worker(worker.Worker.TYPE_MONTH,
                  db,
                  "diff.1M.usage.kWh.%s" % nodeid,
                  ['usage.kWh.%s' % nodeid],
                  diffFunc).run(start_sec)

    # 일 단위 사용량
    worker.Worker(worker.Worker.TYPE_DAY,
                  db,
                  "diff.1d.usage.kWh.%s" % nodeid,
                  ['usage.kWh.%s' % nodeid],
                  diffFunc).run(start_sec)

    # 시 단위 사용량
    worker.Worker(worker.Worker.TYPE_HOUR,
                  db,
                  "diff.1h.usage.kWh.%s" % nodeid,
                  ['usage.kWh.%s' % nodeid],
                  diffFunc).run(start_sec)

    # 15분 단위 사용량
    worker.Worker(worker.Worker.TYPE_SEGMENT,
                  db,
                  "diff.15m.usage.kWh.%s" % nodeid,
                  ['usage.kWh.%s' % nodeid],
                  diffFunc).run(start_sec)

    # 5분 단위 사용량
    worker.Worker(worker.Worker.TYPE_FIBER,
                  db,
                  "diff.5m.usage.kWh.%s" % nodeid,
                  ['usage.kWh.%s' % nodeid],
                  diffFunc).run(start_sec)


################################################################################
#
#	2 차 메트릭 (merge)
#
################################################################################



EXTERPOLATION = datetime.timedelta(seconds=60)  # 그래프의 외삽을 위해


def dateTimeToEpoch(tm):
    return (tm - datetime.timedelta(hours=9) - datetime.datetime(1970, 1, 1)).total_seconds()


def merge_series(sources, startDateTime, endDateTime):
    def lerp(s, t, idx0):
        idx = idx0
        while idx < len(s):
            x, y = s[idx]
            if t < x:
                if idx == 0:
                    return idx, 0  # 범위 밖.
                else:
                    x0, y0 = s[idx - 1]
                    return idx, ((t - x0) * y + (x - t) * y0) / (x - x0)

            elif x == t:
                return idx, y

            idx += 1

        return idx, 0  # 범위 밖

    # xaxis 를 구한다.
    xaxis = []
    for source in sources:
        for (x, y) in source:
            xaxis.append(x)

    #
    s = dateTimeToEpoch(startDateTime)
    e = dateTimeToEpoch(endDateTime)

    #
    xaxis = list(set(xaxis))
    xaxis.sort()

    res = []
    indexes = [0] * len(sources)
    values = [0] * len(sources)
    for idx, x in enumerate(xaxis):
        y = 0
        for (i, source) in enumerate(sources):
            indexes[i], values[i] = lerp(source, x, indexes[i])
            y += values[i]

        if s <= x <= e:
            res.append((x, y))

    return res


def mergeFunc(db, target, sources, startDateTime, endDateTime, groupBy):
    # 센서들의 데이터를 가져온다.
    dataPoints = {
    }

    for series in sources:
        dataPoints[series] = []

        try:
            t0 = worker.dateTimeToInfluxDBQueryParam(startDateTime - EXTERPOLATION)
            t1 = worker.dateTimeToInfluxDBQueryParam(endDateTime + EXTERPOLATION)
            query = "select time, value from %s where time > '%s' and time < '%s'" % (series, t0, t1)
            data = db.query(query, 's')

        except influxdb.InfluxDBClientError:
            traceback.print_exc()
            data = []

        # 센서로 퍼나른다.
        for entry in data:
            for (t, seq, v) in entry["points"]:
                dataPoints[series].append((t, v))

        # 중복 데이터 제거
        dataPoints[series] = list(set(dataPoints[series]))

        # 시간 순으로 소팅한다.
        dataPoints[series].sort()

    # 모든 센서들의 데이터를 머징한다.
    groupDataPoints = merge_series(dataPoints.values(), startDateTime, endDateTime)


    # 데이터베이스를 갱신한다.
    if groupDataPoints:
        data = [{
            'points': groupDataPoints,
            'name': target,
            'columns': ['time', 'value']
        }]
        ret = db.write_points_with_precision(data, 's')


def updateMerge(db, target, sources, start_sec=None):
    worker.Worker(worker.Worker.TYPE_CONTINUOUS,
                  db,
                  target,
                  sources,
                  mergeFunc, True).run(start_sec)


if __name__ == '__main__':
    db = influxdb.InfluxDBClient('localhost', 8086, 'dsuser', 'dsuser', 'doosan')
    nodes = ["2701", "2702", "2703", "2704", "2705"]

    parser = OptionParser()
    parser.add_option('--reset', dest='reset', default=False)

    (options, args) = parser.parse_args()
    if options.reset:
        start_sec = 0
        print "remove all derived metrics."
    else:
        start_sec = None


    # run loop
    while True:
        print '-' * 80
        print datetime.datetime.now()

        for nodeid in nodes:
            migrate_usage(db, nodeid)

        for nodeid in nodes:
            updateDiff(db, nodeid, start_sec)

        for nodeid in nodes:
            migrate_current(db, nodeid)
            migrate_voltage(db, nodeid)

        updateMerge(db, "usage.kWh.all",
                    ["usage.kWh.2701", "usage.kWh.2702", "usage.kWh.2703", "usage.kWh.2704", "usage.kWh.2705"],
                    start_sec)
        updateMerge(db, "diff.1d.usage.kWh.all",
                    ["diff.1d.usage.kWh.2701", "diff.1d.usage.kWh.2702", "diff.1d.usage.kWh.2703",
                     "diff.1d.usage.kWh.2704", "diff.1d.usage.kWh.2705"], start_sec)
        updateMerge(db, "diff.1h.usage.kWh.all",
                    ["diff.1h.usage.kWh.2701", "diff.1h.usage.kWh.2702", "diff.1h.usage.kWh.2703",
                     "diff.1h.usage.kWh.2704", "diff.1h.usage.kWh.2705"], start_sec)
        updateMerge(db, "diff.15m.usage.kWh.all",
                    ["diff.15m.usage.kWh.2701", "diff.15m.usage.kWh.2702", "diff.15m.usage.kWh.2703",
                     "diff.15m.usage.kWh.2704", "diff.15m.usage.kWh.2705"], start_sec)
        updateMerge(db, "diff.5m.usage.kWh.all",
                    ["diff.5m.usage.kWh.2701", "diff.5m.usage.kWh.2702", "diff.5m.usage.kWh.2703",
                     "diff.5m.usage.kWh.2704", "diff.5m.usage.kWh.2705"], start_sec)

        time.sleep(15)

        start_sec = None
