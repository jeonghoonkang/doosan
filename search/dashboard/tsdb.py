# -*- coding: utf-8 -*-
# tsdb.py

import datetime
import traceback
from influxdb.influxdb08 import client as influxdb


__db = influxdb.InfluxDBClient('125.7.128.54', 8086, 'dsuser', 'dsuser', 'doosan')


def db():
    return __db


def date_time_to_influx_query_param(tm):
    return (tm - datetime.timedelta(hours=9)).strftime('%Y-%m-%d %H:%M:%S')


def date_time_to_epoch(tm):
    return (tm - datetime.timedelta(hours=9) - datetime.datetime(1970, 1, 1)).total_seconds()


def get_series(series, start, end, margin=0):
    assert isinstance(start, datetime.datetime)
    assert isinstance(end, datetime.datetime)

    start = start + datetime.timedelta(seconds=-margin)
    end = end + datetime.timedelta(seconds=margin)

    t0 = date_time_to_influx_query_param(start)
    t1 = date_time_to_influx_query_param(end)

    query = "select time, value from %s where time > '%s' and time < '%s' order asc" % (series, t0, t1)

    try:
        data = __db.query(query, 's')

    except influxdb.InfluxDBClientError:
        traceback.print_exc()
        data = []

    res = []
    if len(data):
        for (t, seq, v) in data[0]["points"]:
            res.append((t, v))

    return res


def list_series():
    try:
        data = __db.query('list series', 's')

    except influxdb.InfluxDBClientError:
        traceback.print_exc()
        data = []

    res = []
    if len(data):
        for (t, name) in data[0]["points"]:
            res.append(name)

    return res
