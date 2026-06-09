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
# Event  (calendar hold — created automatically when a Presupuesto is made)
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
    """
    A rentable service or product offered at the venue.
    internal_name     — what staff see in the UI
    client_facing_name — what appears on the client PDF
    internal_notes    — never shown to the client (setup requirements, lead times, etc.)
    is_active         — soft-delete; inactive items stay on old quotes but can't be added to new ones
    """
    internal_name      = models.CharField(max_length=255)
    client_facing_name = models.CharField(max_length=255)
    category           = models.CharField(max_length=50, choices=EVENT_TYPES)
    internal_notes     = models.TextField(blank=True)
    is_active          = models.BooleanField(default=True)

    def __str__(self):
        return self.internal_name


class ServicePriceBand(models.Model):
    """
    One row per pricing tier for a service.
    Example: catering 1–20 guests = €15/head, 21–40 = €12/head.
    max_units=None means no upper ceiling (open-ended top band).
    flat_fee handles fixed charges that don't scale with quantity
    (e.g. room hire that costs €200 regardless of headcount).
    """
    service        = models.ForeignKey(ServiceCatalogItem, on_delete=models.CASCADE, related_name='price_bands')
    min_units      = models.PositiveIntegerField()
    max_units      = models.PositiveIntegerField(null=True, blank=True)
    unit_label     = models.CharField(max_length=50)  # e.g. "guests", "nights", "hours"
    price_per_unit = models.DecimalField(max_digits=8, decimal_places=2)
    flat_fee       = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['service', 'min_units']

    def __str__(self):
        ceiling = f"–{self.max_units}" if self.max_units else "+"
        return f"{self.service.internal_name} [{self.min_units}{ceiling} {self.unit_label}] @ {self.price_per_unit}€"


# ---------------------------------------------------------------------------
# Presupuesto  (the shell / booking identity — holds no financial data itself)
# ---------------------------------------------------------------------------

class Presupuesto(models.Model):
    """
    One Presupuesto per booking. Never deleted, never changes its core identity.
    Financial data, status, and line items all live on PresupuestoVersion.
    The linked Event is the calendar hold and is updated (not recreated) when
    dates change on a new version.
    """
    client     = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='presupuestos')
    event      = models.OneToOneField(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='presupuesto')
    title      = models.CharField(max_length=255)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, default='Corporativo')
    event_start = models.DateTimeField()
    event_end   = models.DateTimeField()
    created_at  = models.DateTimeField(auto_now_add=True)

    # ----- convenience properties -----

    @property
    def active_version(self):
        """The currently accepted version, or the latest draft if none accepted yet."""
        accepted = self.versions.filter(status='Accepted').order_by('-version_number').first()
        if accepted:
            return accepted
        return self.versions.order_by('-version_number').first()

    @property
    def total_deposits_paid(self):
        return self.invoices.filter(
            invoice_type='Deposit', status='Paid'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

    @property
    def balance_due(self):
        version = self.active_version
        if not version or version.status != 'Accepted':
            return Decimal('0.00')
        return version.total_amount - self.total_deposits_paid

    def __str__(self):
        return f"Presupuesto #{self.id} — {self.client.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            # Create the calendar hold once, on the parent object
            ev = Event.objects.create(
                title=f"Hold: {self.title}",
                client=self.client,
                event_type=self.event_type,
                start_time=self.event_start,
                end_time=self.event_end,
                notes=f"Auto-generated calendar hold for Presupuesto #{self.id}",
            )
            # Link back without triggering save() again
            Presupuesto.objects.filter(pk=self.pk).update(event=ev)


# ---------------------------------------------------------------------------
# PresupuestoVersion  (the actual document — every revision lives here)
# ---------------------------------------------------------------------------

class PresupuestoVersion(models.Model):
    """
    Every quote ever sent or drafted. v1 is created alongside the Presupuesto.
    When a new version is created the previous Accepted version is set to Archived.
    status='Archived' = read-only historical record.
    """
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
    notes          = models.TextField(blank=True)   # reason for new version, internal only
    created_at     = models.DateTimeField(auto_now_add=True)
    archived_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('presupuesto', 'version_number')
        ordering = ['-version_number']

    def __str__(self):
        return f"Presupuesto #{self.presupuesto.id} v{self.version_number} ({self.status})"


# ---------------------------------------------------------------------------
# LineItem  (one row per service on a PresupuestoVersion)
# ---------------------------------------------------------------------------

class LineItem(models.Model):
    """
    A single service on a quote version.

    unit_price and line_total are locked in at creation time by copying from
    the matched ServicePriceBand — changing catalog prices later won't affect
    existing quotes.

    show_on_client_pdf controls visibility on the PDF. Internal costs (staff
    fees, platform margin) can be hidden so the client only sees what makes
    sense for them.

    client_display_name overrides the catalog's client_facing_name for this
    specific line if staff want custom wording (e.g. "Evening in the garden"
    instead of the generic "Outdoor catering setup").
    """
    version            = models.ForeignKey(PresupuestoVersion, on_delete=models.CASCADE, related_name='line_items')
    catalog_item       = models.ForeignKey(ServiceCatalogItem, on_delete=models.PROTECT, related_name='line_items')
    price_band_used    = models.ForeignKey(ServicePriceBand, on_delete=models.PROTECT, related_name='line_items')

    quantity           = models.DecimalField(max_digits=8, decimal_places=2)   # e.g. 38.0 guests
    unit_label         = models.CharField(max_length=50)                        # copied from band
    unit_price         = models.DecimalField(max_digits=8, decimal_places=2)    # locked at creation
    line_total         = models.DecimalField(max_digits=10, decimal_places=2)   # locked at creation

    show_on_client_pdf  = models.BooleanField(default=True)
    client_display_name = models.CharField(max_length=255, blank=True)          # overrides catalog name if set

    def __str__(self):
        return f"{self.catalog_item.internal_name} × {self.quantity} — {self.line_total}€"

    @property
    def display_name(self):
        """What the PDF should actually show for this line."""
        if self.client_display_name:
            return self.client_display_name
        return self.catalog_item.client_facing_name


# ---------------------------------------------------------------------------
# Invoice  (deposit or final — always tied to the Presupuesto, not a version)
# ---------------------------------------------------------------------------

class Invoice(models.Model):
    """
    Two types:
      Deposit — 50 % of the accepted version total, sent on first acceptance.
      Final   — balance due (latest accepted total − all deposits paid), sent
                before the event either manually or automatically.

    invoice_number is auto-generated in the view/signal; format: INV-YYYY-XXXX.
    presupuesto_version is a snapshot FK — records which version was active
    when this invoice was created (important for PDF audit trails).
    """
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
    presupuesto_version  = models.ForeignKey(PresupuestoVersion, on_delete=models.PROTECT,
                                             null=True, blank=True, related_name='invoices')
    invoice_type         = models.CharField(max_length=10, choices=INVOICE_TYPE_CHOICES)
    amount               = models.DecimalField(max_digits=10, decimal_places=2)
    status               = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Unpaid')
    issue_date           = models.DateField(default=timezone.now)
    due_date             = models.DateField()
    pdf_file             = models.FileField(upload_to='invoices/', null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    paid_at              = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.invoice_number} ({self.invoice_type}) — {self.client.name}"