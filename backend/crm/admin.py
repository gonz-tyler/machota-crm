from django.contrib import admin
from .models import (
    Client, Event,
    ServiceCatalogItem, ServicePriceBand,
    Presupuesto, PresupuestoVersion, LineItem,
    Invoice,
)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display  = ('name', 'email', 'company', 'created_at')
    search_fields = ('name', 'email', 'company')


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display  = ('title', 'client', 'event_type', 'start_time')
    list_filter   = ('event_type',)
    search_fields = ('title', 'client__name')


# ---------------------------------------------------------------------------
# Service catalog
# ---------------------------------------------------------------------------

class ServicePriceBandInline(admin.TabularInline):
    model  = ServicePriceBand
    extra  = 1
    fields = ('min_units', 'max_units', 'unit_label', 'price_per_unit', 'flat_fee')

@admin.register(ServiceCatalogItem)
class ServiceCatalogItemAdmin(admin.ModelAdmin):
    list_display  = ('internal_name', 'client_facing_name', 'category', 'is_active')
    list_filter   = ('category', 'is_active')
    search_fields = ('internal_name', 'client_facing_name')
    inlines       = [ServicePriceBandInline]


# ---------------------------------------------------------------------------
# Presupuestos
# ---------------------------------------------------------------------------

class LineItemInline(admin.TabularInline):
    model      = LineItem
    extra      = 0
    fields     = ('catalog_item', 'quantity', 'unit_label', 'unit_price', 'line_total',
                  'show_on_client_pdf', 'client_display_name')
    readonly_fields = ('unit_price', 'line_total', 'unit_label')

class PresupuestoVersionInline(admin.TabularInline):
    model           = PresupuestoVersion
    extra           = 0
    fields          = ('version_number', 'status', 'total_amount', 'created_at')
    readonly_fields = ('version_number', 'total_amount', 'created_at')
    show_change_link = True

@admin.register(Presupuesto)
class PresupuestoAdmin(admin.ModelAdmin):
    list_display  = ('id', 'client', 'title', 'event_type', 'active_status', 'active_amount', 'created_at')
    list_filter   = ('event_type',)
    search_fields = ('title', 'client__name')
    inlines       = [PresupuestoVersionInline]

    @admin.display(description='Status')
    def active_status(self, obj):
        v = obj.active_version
        return v.status if v else '—'

    @admin.display(description='Amount')
    def active_amount(self, obj):
        v = obj.active_version
        return f"{v.total_amount}€" if v else '—'

@admin.register(PresupuestoVersion)
class PresupuestoVersionAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'presupuesto', 'version_number', 'status', 'total_amount', 'created_at')
    list_filter   = ('status',)
    search_fields = ('presupuesto__title', 'presupuesto__client__name')
    readonly_fields = ('version_number', 'created_at', 'archived_at')
    inlines       = [LineItemInline]


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display  = ('invoice_number', 'client', 'invoice_type', 'amount', 'status', 'issue_date', 'due_date')
    list_filter   = ('status', 'invoice_type')
    search_fields = ('invoice_number', 'client__name')