from rest_framework import serializers
from .models import (
    Client, Event,
    ServiceCatalogItem, ServicePriceBand,
    Presupuesto, PresupuestoVersion, LineItem,
    Invoice,
)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Client
        fields = '__all__'


# ---------------------------------------------------------------------------
# Event
# ---------------------------------------------------------------------------

class EventSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model  = Event
        fields = '__all__'


# ---------------------------------------------------------------------------
# Service catalog
# ---------------------------------------------------------------------------

class ServicePriceBandSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServicePriceBand
        fields = '__all__'


class ServiceCatalogItemSerializer(serializers.ModelSerializer):
    price_bands = ServicePriceBandSerializer(many=True, read_only=True)

    class Meta:
        model  = ServiceCatalogItem
        fields = '__all__'


# ---------------------------------------------------------------------------
# Line items
# ---------------------------------------------------------------------------

class LineItemSerializer(serializers.ModelSerializer):
    # These are resolved server-side from the chosen price band — read only
    unit_price  = serializers.DecimalField(max_digits=8,  decimal_places=2, read_only=True)
    line_total  = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    unit_label  = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)  # property on the model

    class Meta:
        model  = LineItem
        fields = '__all__'


class LineItemWriteSerializer(serializers.Serializer):
    """
    Used when staff submits a new version's line items.
    The view resolves the price band and calculates totals from these inputs.
    """
    catalog_item_id     = serializers.IntegerField()
    quantity            = serializers.DecimalField(max_digits=8, decimal_places=2)
    show_on_client_pdf  = serializers.BooleanField(default=True)
    client_display_name = serializers.CharField(allow_blank=True, default='')


# ---------------------------------------------------------------------------
# PresupuestoVersion
# ---------------------------------------------------------------------------

class PresupuestoVersionSerializer(serializers.ModelSerializer):
    line_items = LineItemSerializer(many=True, read_only=True)

    class Meta:
        model  = PresupuestoVersion
        fields = '__all__'


# ---------------------------------------------------------------------------
# Presupuesto — two serializers:
#   PresupuestoSerializer      read  → full nested response for the frontend
#   PresupuestoWriteSerializer write → flat input for creating a new presupuesto
# ---------------------------------------------------------------------------

class PresupuestoSerializer(serializers.ModelSerializer):
    # Flat client fields kept from the original so the frontend table still works
    client_name    = serializers.CharField(source='client.name',    read_only=True)
    client_email   = serializers.CharField(source='client.email',   read_only=True)
    client_company = serializers.CharField(source='client.company', read_only=True)

    # Nested versions — full history, ordered newest first (set on model Meta)
    versions = PresupuestoVersionSerializer(many=True, read_only=True)

    # Convenience fields pulled from the active version so the table row
    # doesn't have to dig into the nested array
    active_status = serializers.SerializerMethodField()
    active_amount = serializers.SerializerMethodField()
    active_version_id = serializers.SerializerMethodField()

    class Meta:
        model  = Presupuesto
        fields = '__all__'

    def get_active_status(self, obj):
        v = obj.active_version
        return v.status if v else None

    def get_active_amount(self, obj):
        v = obj.active_version
        return str(v.total_amount) if v else None

    def get_active_version_id(self, obj):
        v = obj.active_version
        return v.id if v else None


class PresupuestoWriteSerializer(serializers.ModelSerializer):
    """Flat write serializer — line items are handled separately by the view."""
    class Meta:
        model  = Presupuesto
        fields = ('client', 'title', 'event_type', 'event_start', 'event_end')


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

class InvoiceSerializer(serializers.ModelSerializer):
    client_name        = serializers.CharField(source='client.name',          read_only=True)
    presupuesto_title  = serializers.CharField(source='presupuesto.title',    read_only=True)
    version_number     = serializers.IntegerField(
                            source='presupuesto_version.version_number',      read_only=True)

    class Meta:
        model  = Invoice
        fields = '__all__'