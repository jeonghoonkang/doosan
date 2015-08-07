# -*- coding: utf-8 -*-
# models.py

from django.db import models
from django.contrib.auth.models import User


class Metric(models.Model):
    name = models.CharField(max_length=128)

    def __unicode__(self):
        return u"Metric[%s]" % self.name


class Query(models.Model):
    name = models.CharField(max_length=128)
    metric = models.CharField(max_length=128)
    start = models.CharField(max_length=64)
    end = models.CharField(max_length=64, null=True, blank=True)

    def queryParam(self):
        if self.end:
            return u"start=%s&end=%s&m=%s" % (self.start, self.end, self.metric)
        else:
            return u"start=%s&m=%s" % (self.start, self.metric)

    def __unicode__(self):
        return u"Query[%s] - %s" % (self.name, self.queryParam())


class Operator(models.Model):
    name = models.CharField(max_length=255)
    phoneNumber = models.CharField(max_length=255, blank=True, null=True)
    wantSMS = models.BooleanField(default=True)

    def __unicode__(self):
        return u"%s:%s" % (self.name, self.phoneNumber)

    def toDictionary(self):
        return {
            'name': self.name,
            'phoneNumber': self.phoneNumber,
            'wantSMS': self.wantSMS
        }


class Image(models.Model):
    file = models.ImageField(upload_to="images", blank=False, null=False)

    def __unicode__(self):
        return u"%s" % (self.file.url)

    def imageTag(self):
        return u'<img src="%s"/>' % self.file.url

    imageTag.short_description = 'Preview'
    imageTag.allow_tags = True


class Stream(models.Model):
    metric = models.CharField(max_length=128)
    keywords = models.TextField(default="", blank=True)
    buildingName = models.CharField(max_length=512, blank=True, null=True)
    image = models.ForeignKey("Image", blank=True, null=True)
    coordX = models.FloatField(default=0.5, blank=False, null=False)
    coordY = models.FloatField(default=0.5, blank=False, null=False)
    category = models.CharField(max_length=256, blank=True, default="")

    def __unicode__(self):
        return u"%s" % self.metric

    def _image(self):  # safe access
        try:
            return self.image

        except Exception, e:
            # print e ##
            return None

    def toDictionary(self):
        #
        def func(s):
            l = s.split(',')
            for idx in range(len(l)):
                l[idx] = l[idx].strip().encode('utf-8')

            # 빈 문자열 제거
            try:
                while True:
                    l.remove('')

            except ValueError:
                pass

            return l

        res = {
            'streamID': self.id,
            'metric': self.metric,
            'keywords': func(self.keywords),
            'coordX': self.coordX,
            'coordY': self.coordY,
            'category': self.category.strip()
        }

        if self.buildingName:
            res['buildingName'] = self.buildingName

        if self._image():
            res['image'] = self._image().file.url

        return res

    def imageTag(self):
        if self._image():
            return u'<img src="%s" style="width:800px"/>' % self._image().file.url

    imageTag.short_description = 'Preview'
    imageTag.allow_tags = True

    def get_absolute_url(self):
        return u"/datahub/dashboard/pickPoint/%d/" % (self.id)


class FavoriteQuery(models.Model):
    user = models.ForeignKey(User)
    name = models.CharField(max_length=2048)
    url = models.CharField(max_length=2048)

    def __unicode__(self):
        return "Query[%s:%s]%s" % (self.user.username, self.name, self.url)

    def toDictionary(self):
        res = {
            'id': self.id,
            'userID': self.user.id,
            'name': self.name,
            'url': self.url
        }
        return res


class Place(models.Model):
    name = models.CharField(max_length=128)
    description = models.TextField(default="", blank=True)
    latitude = models.FloatField(default=0, blank=False, null=False)
    longitude = models.FloatField(default=0, blank=False, null=False)
    altitude = models.FloatField(default=0, blank=False, null=False)
    category = models.CharField(max_length=256, blank=True, default="")
    iconURL = models.CharField(max_length=2048, default="", blank=True)

    def __unicode__(self):
        return u"[Place] %s" % (self.name)

    def toDictionary(self):
        return {
            'name': self.name,
            'description': self.description,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'altitude': self.altitude,
            'category': self.category,
            'iconURL': self.iconURL
        }
