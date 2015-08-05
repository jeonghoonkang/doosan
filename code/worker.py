# -*- coding:utf-8 -*-
# worker.py

import traceback
import datetime
from dateutil.relativedelta import relativedelta
import time
from influxdb.influxdb08 import client as influxdb

MERGING_TIME_GAP = 30  # 30 초의 시간 갭을 둔다.


def dateTimeToInfluxDBQueryParam(tm):
    return (tm - datetime.timedelta(hours=9)).strftime('%Y-%m-%d %H:%M:%S')


def dateTimeToEpochTimeForInfluxDB(tm):
    return (tm - datetime.timedelta(hours=9) - datetime.datetime(1970, 1, 1)).total_seconds()


def QUERY(db, query, *args):
    print query
    return db.query(query, *args)


class Worker(object):
    TYPE_MONTH = "TYPE_MONTH"
    TYPE_DAY = "TYPE_DAY"
    TYPE_HOUR = "TYPE_HOUR"
    TYPE_SEGMENT = "TYPE_SEGMENT"
    TYPE_FIBER = "TYPE_FIBER"
    TYPE_CONTINUOUS = "TYPE_CONTINUOUS"

    GROUPBY = {
        TYPE_MONTH: '43200s',
        TYPE_DAY: '720s',
        TYPE_HOUR: '60s',
        TYPE_SEGMENT: '15s',
        TYPE_FIBER: '5s'
    }

    def __init__(self, workerType, db, target, sources, workerFunc, isMerging=False):
        super(Worker, self).__init__()

        self.__db = db
        self.__type = workerType
        self.__target = target
        self.__sources = sources
        self.__workerFunc = workerFunc
        self.__isMerging = isMerging

    def firstTimeForSeries(self, series):  # series 의 첫 시각을 seconds 로 반환
        try:
            query = "select time, value from %s limit 1 order asc" % series
            ret = QUERY(self.__db, query, 's')

        except influxdb.InfluxDBClientError:
            traceback.print_exc()
            return None

        if len(ret):
            return ret[0]["points"][0][0]

    def lastTimeForSeries(self, series):  # series 의 마지막 시각을 seconds 로 반환
        try:
            query = "select time, value from %s limit 1" % series
            ret = QUERY(self.__db, query, 's')

        except influxdb.InfluxDBClientError:
            traceback.print_exc()
            return None

        if len(ret):
            return ret[0]["points"][0][0]

    def firstTimeForSources(self):  # 모든 sources 가 존재하는 첫 시각을 seconds 로 반환
        res = None

        for series in self.__sources:
            ret = self.firstTimeForSeries(series)

            # sources 중 하나라도 값이 없다면, 작업 구간을 구할 수 없다.
            if ret is None:
                return None

            #
            if res is None:
                res = ret

            elif self.__isMerging:
                if res > ret:  # 공통의 시작 시간이어야 하므로, min 값이 맞다.
                    res = ret

            else:
                if res < ret:  # 공통의 시작 시간이어야 하므로, max 값이 맞다.
                    res = ret

        return res

    def lastTimeForSources(self):  # 모든 sources 가 존재하는 마지막 시각을 seconds 로 반환
        res = None

        for series in self.__sources:
            ret = self.lastTimeForSeries(series)

            # sources 중 하나라도 값이 없다면, 작업 구간을 구할 수 없다.
            if ret is None:
                return None

            #
            if res is None:
                res = ret

            elif self.__isMerging:
                if res < ret:  # 공통의 시작 시간이어야 하므로, max 값이 맞다.
                    res = ret

            else:
                if res > ret:  # 공통의 시작 시간이어야 하므로, min 값이 맞다.
                    res = ret

        return res

    def findWorkingSpan(self):
        # target 의 last 시각, sources 의 last 시각을 비교하여,
        # 작업할 시간 구간을 찾는다. (초단위)

        #
        srcLastTime = self.lastTimeForSources()
        if srcLastTime is None:
            return None

        targetLastTime = self.lastTimeForSeries(self.__target)
        if targetLastTime is None:
            # target 이 하나도 생성되어 있지 않다면,
            srcFirstTime = self.firstTimeForSources()
            assert srcFirstTime is not None
            return [srcFirstTime, srcLastTime]

        if targetLastTime < srcLastTime:
            return [targetLastTime + 1, srcLastTime]

        return None

    def deleteSeriesFrom(self, series, seconds):
        tm = datetime.datetime.fromtimestamp(seconds)
        try:
            query = "delete from %s where time > '%s'" % (series, dateTimeToInfluxDBQueryParam(tm))
            QUERY(self.__db, query)

        except influxdb.InfluxDBClientError, e:
            traceback.print_exc()

    def splitSpans(self, startSeconds, endSeconds):
        s = datetime.datetime.fromtimestamp(startSeconds)
        e = datetime.datetime.fromtimestamp(endSeconds)

        if self.__type == Worker.TYPE_MONTH:
            s = s.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            e = e.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            step = relativedelta(months=1)

        elif self.__type == Worker.TYPE_DAY:
            s = s.replace(hour=0, minute=0, second=0, microsecond=0)
            e = e.replace(hour=0, minute=0, second=0, microsecond=0)
            step = relativedelta(days=1)

        elif self.__type == Worker.TYPE_HOUR:
            s = s.replace(minute=0, second=0, microsecond=0)
            e = e.replace(minute=0, second=0, microsecond=0)
            step = relativedelta(hours=1)

        elif self.__type == Worker.TYPE_SEGMENT:
            #
            s = s.replace(second=0, microsecond=0)
            if s.minute < 15:
                s = s.replace(minute=0)
            elif s.minute < 30:
                s = s.replace(minute=15)
            elif s.minute < 45:
                s = s.replace(minute=30)
            else:
                s = s.replace(minute=45)

            #
            e = e.replace(second=0, microsecond=0)
            if e.minute < 15:
                e = e.replace(minute=0)
            elif e.minute < 30:
                e = e.replace(minute=15)
            elif e.minute < 45:
                e = e.replace(minute=30)
            else:
                e = e.replace(minute=45)

            step = relativedelta(minutes=15)

        elif self.__type == Worker.TYPE_FIBER:
            #
            s = s.replace(second=0, microsecond=0)
            if s.minute < 5:
                s = s.replace(minute=0)
            elif s.minute < 10:
                s = s.replace(minute=5)
            elif s.minute < 15:
                s = s.replace(minute=10)
            elif s.minute < 20:
                s = s.replace(minute=15)
            elif s.minute < 25:
                s = s.replace(minute=20)
            elif s.minute < 30:
                s = s.replace(minute=25)
            elif s.minute < 35:
                s = s.replace(minute=30)
            elif s.minute < 40:
                s = s.replace(minute=35)
            elif s.minute < 45:
                s = s.replace(minute=40)
            elif s.minute < 50:
                s = s.replace(minute=45)
            elif s.minute < 55:
                s = s.replace(minute=50)
            else:
                s = s.replace(minute=55)

            #
            e = e.replace(second=0, microsecond=0)
            if e.minute < 5:
                e = e.replace(minute=0)
            elif e.minute < 10:
                e = e.replace(minute=5)
            elif e.minute < 15:
                e = e.replace(minute=10)
            elif e.minute < 20:
                e = e.replace(minute=15)
            elif e.minute < 25:
                e = e.replace(minute=20)
            elif e.minute < 30:
                e = e.replace(minute=25)
            elif e.minute < 35:
                e = e.replace(minute=30)
            elif e.minute < 40:
                e = e.replace(minute=35)
            elif e.minute < 45:
                e = e.replace(minute=40)
            elif e.minute < 50:
                e = e.replace(minute=45)
            elif e.minute < 55:
                e = e.replace(minute=50)
            else:
                e = e.replace(minute=55)

            step = relativedelta(minutes=5)


        else:
            assert False

        return (s, e, step)

    def run(self, startSeconds=None):  #
        # 강제로 시작 시간을 정해주었다면, 지우고 시작한다.
        if startSeconds is not None:
            self.deleteSeriesFrom(self.__target, startSeconds)

        # 구간을 찾는다.
        span = self.findWorkingSpan()
        if span is None:
            return False

        s, e = span


        # 작업을 시작한다.
        if self.__type != Worker.TYPE_CONTINUOUS:
            start, end, step = self.splitSpans(s, e)

            print "start(%s), end(%s), step(%s)" % (start, end, step)

            cur = start
            while cur < end:
                self.__workerFunc(self.__db, self.__target, self.__sources, cur, cur + step,
                                  Worker.GROUPBY[self.__type])
                cur += step

        else:
            # 머징일 때에는, 종료 시각에 marging 을 둔다.
            e -= MERGING_TIME_GAP

            start = datetime.datetime.fromtimestamp(s)
            end = datetime.datetime.fromtimestamp(e)
            groupBy = "%ss" % (int(e - s) / 60)

            print "start(%s), end(%s)" % (start, end)
            self.__workerFunc(self.__db, self.__target, self.__sources, start, end, groupBy)
