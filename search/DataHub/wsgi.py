# -*- coding: utf-8 -*-
# DataHub/wsgi.py

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "DataHub.settings")

application = get_wsgi_application()
