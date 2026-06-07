from django.db import models
from django.utils import timezone

# 1. We define the choices here so multiple models can use them
EVENT_TYPES = (
    ('Rodajes', 'Rodajes'),
    ('Alojamiento', 'Alojamiento'),
    ('AIRBNB', 'AIRBNB'),
    ('Talleres y retiros', 'Talleres y retiros'),
    ('Celebraciones', 'Celebraciones'),
    ('Corporativo', 'Corporativo'),
    ('Catering & others', 'Catering & others'),
)

class Client(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    company = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Event(models.Model):
    title = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='events')
    
    # 2. Applied to the Event model
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, default='Corporativo')
    
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.client.name})"

class Presupuesto(models.Model):
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
    )

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='presupuestos')
    title = models.CharField(max_length=255)
    
    # 3. Applied to the Presupuesto model
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, default='Corporativo')
    
    event_start = models.DateTimeField()
    event_end = models.DateTimeField()
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Quote #{self.id} - {self.client.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:
            # 4. Pass the selected event_type to the calendar block
            Event.objects.create(
                title=f"Hold: {self.title}",
                client=self.client,
                event_type=self.event_type, 
                start_time=self.event_start,
                end_time=self.event_end,
                notes=f"Auto-generated calendar hold for Presupuesto #{self.id}"
            )

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('Unpaid', 'Unpaid'),
        ('Paid', 'Paid'),
        ('Overdue', 'Overdue'),
    )

    invoice_number = models.CharField(max_length=50, unique=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='invoices')
    presupuesto = models.OneToOneField(Presupuesto, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Unpaid')
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.invoice_number} - {self.client.name}"