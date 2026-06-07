from django.contrib import admin
from .models import Client, Event, Presupuesto, Invoice

# A customized view for Clients
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'company', 'created_at')
    search_fields = ('name', 'email', 'company')

# A customized view for Events
@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'event_type', 'start_time')
    list_filter = ('event_type',)
    search_fields = ('title', 'client__name')

# A customized view for Presupuestos
@admin.register(Presupuesto)
class PresupuestoAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'amount', 'status', 'created_at')
    list_filter = ('status', 'event_type')

# A customized view for Invoices
@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'client', 'amount', 'status', 'issue_date')
    list_filter = ('status',)
    search_fields = ('invoice_number', 'client__name')