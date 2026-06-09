from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal

from .models import (
    Client, Event,
    ServiceCatalogItem, ServicePriceBand,
    Presupuesto, PresupuestoVersion, LineItem,
    Invoice,
)
from .serializers import (
    ClientSerializer, EventSerializer,
    ServiceCatalogItemSerializer,
    PresupuestoSerializer, PresupuestoWriteSerializer,
    PresupuestoVersionSerializer, LineItemWriteSerializer,
    InvoiceSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_price_band(catalog_item, quantity):
    """
    Find the matching ServicePriceBand for the given quantity.
    Returns the band or None if no band covers that quantity.
    """
    bands = catalog_item.price_bands.order_by('min_units')
    for band in bands:
        above_min = quantity >= band.min_units
        below_max = band.max_units is None or quantity <= band.max_units
        if above_min and below_max:
            return band
    return None


def _create_version_with_items(presupuesto, line_items_data, notes=''):
    """
    Creates a new PresupuestoVersion (incrementing version_number) and its
    LineItems. Resolves price bands and locks in unit_price / line_total.
    Returns the new PresupuestoVersion or raises ValueError on bad input.
    """
    last = presupuesto.versions.order_by('-version_number').first()
    next_number = (last.version_number + 1) if last else 1

    version = PresupuestoVersion.objects.create(
        presupuesto=presupuesto,
        version_number=next_number,
        status='Draft',
        total_amount=Decimal('0.00'),
        notes=notes,
    )

    running_total = Decimal('0.00')

    for item_data in line_items_data:
        try:
            catalog_item = ServiceCatalogItem.objects.get(
                pk=item_data['catalog_item_id'], is_active=True
            )
        except ServiceCatalogItem.DoesNotExist:
            raise ValueError(f"Catalog item {item_data['catalog_item_id']} not found or inactive.")

        quantity = Decimal(str(item_data['quantity']))
        band = _resolve_price_band(catalog_item, quantity)

        if not band:
            raise ValueError(
                f"No price band found for '{catalog_item.internal_name}' "
                f"with quantity {quantity}."
            )

        line_total = (band.price_per_unit * quantity) + band.flat_fee

        LineItem.objects.create(
            version=version,
            catalog_item=catalog_item,
            price_band_used=band,
            quantity=quantity,
            unit_label=band.unit_label,
            unit_price=band.price_per_unit,
            line_total=line_total,
            show_on_client_pdf=item_data.get('show_on_client_pdf', True),
            client_display_name=item_data.get('client_display_name', ''),
        )

        running_total += line_total

    version.total_amount = running_total
    version.save()

    return version


def _generate_invoice_number(invoice_type):
    prefix = 'DEP' if invoice_type == 'Deposit' else 'INV'
    year   = timezone.now().year
    last   = Invoice.objects.filter(
        invoice_number__startswith=f'{prefix}-{year}-'
    ).order_by('-invoice_number').first()

    if last:
        seq = int(last.invoice_number.split('-')[-1]) + 1
    else:
        seq = 1

    return f'{prefix}-{year}-{seq:04d}'


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ClientViewSet(viewsets.ModelViewSet):
    queryset           = Client.objects.all().order_by('-created_at')
    serializer_class   = ClientSerializer


# ---------------------------------------------------------------------------
# Event
# ---------------------------------------------------------------------------

class EventViewSet(viewsets.ModelViewSet):
    queryset           = Event.objects.all().order_by('-start_time')
    serializer_class   = EventSerializer


# ---------------------------------------------------------------------------
# Service catalog
# ---------------------------------------------------------------------------

class ServiceCatalogItemViewSet(viewsets.ModelViewSet):
    """
    GET  /catalog/          — all active items with their price bands
    GET  /catalog/?all=true — include inactive items (for the admin catalog page)
    """
    serializer_class = ServiceCatalogItemSerializer

    def get_queryset(self):
        if self.request.query_params.get('all'):
            return ServiceCatalogItem.objects.prefetch_related('price_bands').order_by('category', 'internal_name')
        return ServiceCatalogItem.objects.filter(is_active=True).prefetch_related('price_bands').order_by('category', 'internal_name')


# ---------------------------------------------------------------------------
# Presupuesto
# ---------------------------------------------------------------------------

class PresupuestoViewSet(viewsets.ModelViewSet):
    queryset = Presupuesto.objects.select_related('client', 'event') \
                                  .prefetch_related('versions__line_items__catalog_item',
                                                    'versions__line_items__price_band_used',
                                                    'invoices') \
                                  .order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PresupuestoWriteSerializer
        return PresupuestoSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Creates the Presupuesto shell + v1 PresupuestoVersion in one request.

        Expected body:
        {
            "client": 1,
            "title": "Boda en la finca",
            "event_type": "Celebraciones",
            "event_start": "2025-09-12T10:00:00",
            "event_end":   "2025-09-12T23:00:00",
            "line_items": [
                { "catalog_item_id": 3, "quantity": 40, "show_on_client_pdf": true },
                { "catalog_item_id": 7, "quantity": 1,  "show_on_client_pdf": false }
            ],
            "notes": ""
        }
        """
        # Validate the shell fields
        write_serializer = PresupuestoWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        # Validate line items
        items_data = request.data.get('line_items', [])
        if not items_data:
            return Response(
                {'line_items': 'At least one line item is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items_serializer = LineItemWriteSerializer(data=items_data, many=True)
        items_serializer.is_valid(raise_exception=True)

        # Create the shell (Presupuesto.save() auto-creates the Event hold)
        presupuesto = write_serializer.save()

        # Create v1 with line items
        try:
            _create_version_with_items(
                presupuesto,
                items_serializer.validated_data,
                notes=request.data.get('notes', ''),
            )
        except ValueError as e:
            raise serializers.ValidationError({'line_items': str(e)})

        # Return the full nested response
        out = PresupuestoSerializer(presupuesto, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='new_version')
    @transaction.atomic
    def new_version(self, request, pk=None):
        """
        Creates a new draft version, archiving the current accepted one.

        Body: same line_items array + optional "notes" string.
        """
        presupuesto = self.get_object()

        items_data = request.data.get('line_items', [])
        if not items_data:
            return Response(
                {'line_items': 'At least one line item is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items_serializer = LineItemWriteSerializer(data=items_data, many=True)
        items_serializer.is_valid(raise_exception=True)

        # Archive anything currently accepted
        presupuesto.versions.filter(status='Accepted').update(
            status='Archived',
            archived_at=timezone.now(),
        )

        try:
            new_version = _create_version_with_items(
                presupuesto,
                items_serializer.validated_data,
                notes=request.data.get('notes', ''),
            )
        except ValueError as e:
            raise serializers.ValidationError({'line_items': str(e)})

        return Response(
            PresupuestoVersionSerializer(new_version).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='accept')
    @transaction.atomic
    def accept(self, request, pk=None):
        """
        Accepts the current draft/sent version and creates a deposit Invoice
        if this is the first acceptance (no deposits paid yet).
        """
        presupuesto = self.get_object()

        version = presupuesto.versions.filter(
            status__in=['Draft', 'Sent']
        ).order_by('-version_number').first()

        if not version:
            return Response(
                {'detail': 'No draft or sent version to accept.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        version.status = 'Accepted'
        version.save()

        # First-time acceptance → create deposit invoice
        if presupuesto.total_deposits_paid == 0:
            deposit_amount = (version.total_amount / 2).quantize(Decimal('0.01'))
            Invoice.objects.create(
                invoice_number      = _generate_invoice_number('Deposit'),
                client              = presupuesto.client,
                presupuesto         = presupuesto,
                presupuesto_version = version,
                invoice_type        = 'Deposit',
                amount              = deposit_amount,
                due_date            = request.data.get('due_date', timezone.now().date()),
            )

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        return Response(out.data)

    @action(detail=True, methods=['post'], url_path='send')
    def send(self, request, pk=None):
        """
        Marks the latest draft version as Sent.
        The actual email is handled separately.
        """
        presupuesto = self.get_object()
        version = presupuesto.versions.filter(status='Draft').order_by('-version_number').first()

        if not version:
            return Response(
                {'detail': 'No draft version to mark as sent.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        version.status = 'Sent'
        version.save()

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        return Response(out.data)

    @action(detail=True, methods=['post'], url_path='final_invoice')
    @transaction.atomic
    def final_invoice(self, request, pk=None):
        """
        Generates the final invoice for the balance due.
        Only works if there is an accepted version and at least one deposit paid.
        """
        presupuesto = self.get_object()

        if not presupuesto.active_version or presupuesto.active_version.status != 'Accepted':
            return Response(
                {'detail': 'Presupuesto must have an accepted version first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        balance = presupuesto.balance_due
        if balance <= 0:
            return Response(
                {'detail': 'No balance due — deposit already covers the full amount.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent duplicate final invoices
        if presupuesto.invoices.filter(invoice_type='Final').exists():
            return Response(
                {'detail': 'A final invoice has already been issued for this presupuesto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice = Invoice.objects.create(
            invoice_number      = _generate_invoice_number('Final'),
            client              = presupuesto.client,
            presupuesto         = presupuesto,
            presupuesto_version = presupuesto.active_version,
            invoice_type        = 'Final',
            amount              = balance,
            due_date            = request.data.get('due_date', timezone.now().date()),
        )

        return Response(
            InvoiceSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Marks the latest sent version as Rejected."""
        presupuesto = self.get_object()
        version = presupuesto.versions.filter(
            status__in=['Draft', 'Sent']
        ).order_by('-version_number').first()

        if not version:
            return Response(
                {'detail': 'No active version to reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        version.status = 'Rejected'
        version.save()

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        return Response(out.data)


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset         = Invoice.objects.select_related('client', 'presupuesto', 'presupuesto_version') \
                                      .order_by('-created_at')
    serializer_class = InvoiceSerializer

    @action(detail=True, methods=['post'], url_path='mark_paid')
    def mark_paid(self, request, pk=None):
        invoice        = self.get_object()
        invoice.status = 'Paid'
        invoice.paid_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)