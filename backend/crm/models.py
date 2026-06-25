from django.db import models
from django.utils import timezone
from decimal import Decimal


# ---------------------------------------------------------------------------
# Shared choices
# ---------------------------------------------------------------------------

EVENT_TYPES = (
    ('Rodajes', 'Rodajes'),
    ('Alojamiento', 'Alojamiento'),
    ('AIRBNB', 'AIRBNB'),
    ('Talleres y retiros', 'Talleres y retiros'),
    ('Celebraciones', 'Celebraciones'),
    ('Corporativo', 'Corporativo'),
    ('Catering & others', 'Catering & others'),
)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class Client(models.Model):
    name       = models.CharField(max_length=255)
    email      = models.EmailField(unique=True)
    company    = models.CharField(max_length=255, blank=True, null=True)
    phone      = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Event
# ---------------------------------------------------------------------------

class Event(models.Model):
    title      = models.CharField(max_length=255)
    client     = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, default='Corporativo')
    start_time = models.DateTimeField()
    end_time   = models.DateTimeField()
    notes      = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.client.name})"


# ---------------------------------------------------------------------------
# Service catalog
# ---------------------------------------------------------------------------

class ServiceCatalogItem(models.Model):
    internal_name      = models.CharField(max_length=255)
    client_facing_name = models.CharField(max_length=255)
    category           = models.CharField(max_length=50, choices=EVENT_TYPES)
    internal_notes     = models.TextField(blank=True)
    is_active          = models.BooleanField(default=True)

    def __str__(self):
        return self.internal_name


class ServicePriceBand(models.Model):
    service        = models.ForeignKey(ServiceCatalogItem, on_delete=models.CASCADE, related_name='price_bands')
    min_units      = models.PositiveIntegerField()
    max_units      = models.PositiveIntegerField(null=True, blank=True)
    unit_label     = models.CharField(max_length=50)
    price_per_unit = models.DecimalField(max_digits=8, decimal_places=2)
    flat_fee       = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['service', 'min_units']

    def __str__(self):
        ceiling = f"–{self.max_units}" if self.max_units else "+"
        return f"{self.service.internal_name} [{self.min_units}{ceiling} {self.unit_label}] @ {self.price_per_unit}€"


# ---------------------------------------------------------------------------
# Presupuesto
# ---------------------------------------------------------------------------

class Presupuesto(models.Model):
    client      = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='presupuestos')
    event       = models.OneToOneField(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='presupuesto')
    title       = models.CharField(max_length=255)
    event_type  = models.CharField(max_length=50, choices=EVENT_TYPES, default='Corporativo')
    event_start = models.DateTimeField()
    event_end   = models.DateTimeField()
    created_at  = models.DateTimeField(auto_now_add=True)

    @property
    def active_version(self):
        """The currently accepted version, or the latest operational sheet if none accepted yet."""
        accepted = self.versions.filter(status='Accepted').order_by('-version_number').first()
        if accepted:
            return accepted
        return self.versions.order_by('-version_number').first()

    @property
    def total_deposits_paid(self):
        """Returns total sum of all paid deposit invoices pinned to this deal identity context."""
        return self.invoices.filter(
            status='Paid'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

    @property
    def balance_due(self):
        """Calculates balance as the latest active amount minus all confirmed paid elements."""
        version = self.active_version
        if not version:
            return Decimal('0.00')
        return version.total_amount - self.total_deposits_paid

    def __str__(self):
        return f"Presupuesto #{self.id} — {self.client.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            ev = Event.objects.create(
                title=f"Hold: {self.title}",
                client=self.client,
                event_type=self.event_type,
                start_time=self.event_start,
                end_time=self.event_end,
                notes=f"Auto-generated calendar hold for Presupuesto #{self.id}",
            )
            Presupuesto.objects.filter(pk=self.pk).update(event=ev)


# ---------------------------------------------------------------------------
# PresupuestoVersion
# ---------------------------------------------------------------------------

class PresupuestoVersion(models.Model):
    STATUS_CHOICES = (
        ('Draft',    'Draft'),
        ('Sent',     'Sent'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
        ('Archived', 'Archived'),
    )

    presupuesto    = models.ForeignKey(Presupuesto, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    status         = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    total_amount   = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    pdf_file       = models.FileField(upload_to='presupuestos/', null=True, blank=True)
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    archived_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('presupuesto', 'version_number')
        ordering = ['-version_number']

    def __str__(self):
        return f"Presupuesto #{self.presupuesto.id} v{self.version_number} ({self.status})"


# ---------------------------------------------------------------------------
# LineItem
# ---------------------------------------------------------------------------

class LineItem(models.Model):
    version             = models.ForeignKey(PresupuestoVersion, on_delete=models.CASCADE, related_name='line_items')
    catalog_item        = models.ForeignKey(ServiceCatalogItem, on_delete=models.PROTECT, related_name='line_items')
    price_band_used     = models.ForeignKey(ServicePriceBand, on_delete=models.PROTECT, related_name='line_items')
    quantity            = models.DecimalField(max_digits=8, decimal_places=2)
    unit_label          = models.CharField(max_length=50)
    unit_price          = models.DecimalField(max_digits=8, decimal_places=2)
    line_total          = models.DecimalField(max_digits=10, decimal_places=2)
    show_on_client_pdf  = models.BooleanField(default=True)
    client_display_name = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.catalog_item.internal_name} × {self.quantity} — {self.line_total}€"

    @property
    def display_name(self):
        if self.client_display_name:
            return self.client_display_name
        return self.catalog_item.client_facing_name


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = (
        ('Deposit', 'Deposit'),
        ('Final',   'Final'),
    )
    STATUS_CHOICES = (
        ('Unpaid',  'Unpaid'),
        ('Paid',    'Paid'),
        ('Overdue', 'Overdue'),
    )

    invoice_number       = models.CharField(max_length=50, unique=True)
    client               = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='invoices')
    presupuesto          = models.ForeignKey(Presupuesto, on_delete=models.CASCADE, related_name='invoices')
    presupuesto_version  = models.ForeignKey(PresupuestoVersion, on_delete=models.PROTECT, null=True, blank=True, related_name='invoices')
    invoice_type         = models.CharField(max_length=10, choices=INVOICE_TYPE_CHOICES)
    amount               = models.DecimalField(max_digits=10, decimal_places=2)
    status               = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Unpaid')
    issue_date           = models.DateTimeField(default=timezone.now)
    due_date             = models.DateField()
    pdf_file             = models.FileField(upload_to='invoices/', null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    paid_at              = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.invoice_number} ({self.invoice_type}) — {self.client.name}"