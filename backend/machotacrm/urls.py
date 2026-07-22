from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from crm.views import current_user, portal_get_version, portal_accept_version, portal_reject_version, portal_get_pdf

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('crm.urls')),
    
    # NEW: Authentication endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/users/me/', current_user, name='current-user'),

    path('api/portal/presupuesto/<uuid:token>/',        portal_get_version,  name='portal-get'),
    path('api/portal/presupuesto/<uuid:token>/accept/', portal_accept_version, name='portal-accept'),
    path('api/portal/presupuesto/<uuid:token>/reject/', portal_reject_version, name='portal-reject'),
    path('api/portal/presupuesto/<uuid:token>/pdf/', portal_get_pdf, name='portal-pdf'),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)