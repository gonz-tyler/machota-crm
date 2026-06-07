from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, EventViewSet, PresupuestoViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet)
router.register(r'events', EventViewSet)
router.register(r'presupuestos', PresupuestoViewSet)
router.register(r'invoices', InvoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]