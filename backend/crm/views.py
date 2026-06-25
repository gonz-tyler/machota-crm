import os
from decimal import Decimal
from django.utils import timezone
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import transaction
from django.db import models
from django.template.loader import render_to_string
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from weasyprint import HTML

from .models import (
    Client, Event, ServiceCatalogItem, ServicePriceBand,
    Presupuesto, PresupuestoVersion, LineItem, Invoice
)
from .serializers import (
    ClientSerializer, EventSerializer, ServiceCatalogItemSerializer,
    PresupuestoSerializer, PresupuestoWriteSerializer, InvoiceSerializer,
    PresupuestoVersionSerializer, LineItemWriteSerializer
)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Returns the username and email of the currently logged-in user.
    """
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name
    })

# ---------------------------------------------------------------------------
# Core PDF Production Engine (WeasyPrint Backend Integration)
# ---------------------------------------------------------------------------

def generate_pdf_file(template_name, context_data):
    """Generates an immutable binary PDF using WeasyPrint and an HTML template."""
    html_string = render_to_string(template_name, context_data)
    pdf_binary = HTML(string=html_string, base_url=settings.MEDIA_ROOT).write_pdf()
    return pdf_binary


# ---------------------------------------------------------------------------
# Shared Database Helpers
# ---------------------------------------------------------------------------

def _resolve_price_band(catalog_item, quantity):
    """Find the matching ServicePriceBand for the given quantity."""
    bands = catalog_item.price_bands.order_by('min_units')
    for band in bands:
        above_min = quantity >= band.min_units
        below_max = band.max_units is None or quantity <= band.max_units
        if above_min and below_max:
            return band
    return None


def _create_version_with_items(presupuesto, line_items_data, notes=''):
    """Creates a new PresupuestoVersion and its LineItems, generating an immutable print PDF."""
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
                f"No price band found for '{catalog_item.internal_name}' with quantity {quantity}."
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

    # Automatically generate and pin down the Immutable server-side document PDF asset file
    pdf_bytes = generate_pdf_file('presupuesto_template.html', {'presupuesto': presupuesto, 'version': version})
    version.pdf_file.save(f"presupuesto_{presupuesto.id}_v{next_number}.pdf", ContentFile(pdf_bytes), save=True)

    return version


def _generate_invoice_number(invoice_type):
    prefix = 'DEP' if invoice_type == 'Deposit' else 'INV'
    year = timezone.now().year
    last = Invoice.objects.filter(
        invoice_number__startswith=f'{prefix}-{year}-'
    ).order_by('-invoice_number').first()

    if last:
        seq = int(last.invoice_number.split('-')[-1]) + 1
    else:
        seq = 1

    return f'{prefix}-{year}-{seq:04d}'


# ---------------------------------------------------------------------------
# Core ViewSets
# ---------------------------------------------------------------------------

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    serializer_class = ClientSerializer


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by('-start_time')
    serializer_class = EventSerializer


class ServiceCatalogItemViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogItemSerializer

    def get_queryset(self):
        if self.request.query_params.get('all'):
            return ServiceCatalogItem.objects.prefetch_related('price_bands').order_by('category', 'internal_name')
        return ServiceCatalogItem.objects.filter(is_active=True).prefetch_related('price_bands').order_by('category', 'internal_name')


# ---------------------------------------------------------------------------
# Presupuesto ViewSet (Enhanced Multi-Tier Dynamic Accounting Logic)
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

    def _inject_serialized_accounting_data(self, data, presupuesto):
        """Helper to ensure accounting fields are present regardless of serializer configs."""
        if isinstance(data, list):
            for idx, item in enumerate(data):
                obj = presupuesto[idx] if isinstance(presupuesto, list) else presupuesto.all()[idx]
                item['total_deposits_paid'] = str(obj.total_deposits_paid)
                item['balance_due'] = str(obj.balance_due)
                item['has_final_invoice'] = obj.invoices.filter(invoice_type='Final').exists()
                item['is_fully_paid'] = obj.balance_due <= 0 and obj.invoices.exists()
        elif isinstance(data, dict):
            data['total_deposits_paid'] = str(presupuesto.total_deposits_paid)
            data['balance_due'] = str(presupuesto.balance_due)
            data['has_final_invoice'] = presupuesto.invoices.filter(invoice_type='Final').exists()
            data['is_fully_paid'] = presupuesto.balance_due <= 0 and presupuesto.invoices.exists()
        return data

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data = self._inject_serialized_accounting_data(response.data, self.get_queryset())
        return response

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        response = super().retrieve(request, *args, **kwargs)
        response.data = self._inject_serialized_accounting_data(response.data, instance)
        return response

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        write_serializer = PresupuestoWriteSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)

        items_data = request.data.get('line_items', [])
        if not items_data:
            return Response({'line_items': 'At least one line item is required.'}, status=status.HTTP_400_BAD_REQUEST)

        items_serializer = LineItemWriteSerializer(data=items_data, many=True)
        items_serializer.is_valid(raise_exception=True)

        presupuesto = write_serializer.save()

        try:
            _create_version_with_items(
                presupuesto,
                items_serializer.validated_data,
                notes=request.data.get('notes', 'Initial version generated automatically.'),
            )
        except ValueError as e:
            raise serializers.ValidationError({'line_items': str(e)})

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        data = self._inject_serialized_accounting_data(out.data, presupuesto)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='new_version')
    @transaction.atomic
    def new_version(self, request, pk=None):
        """Creates a new negotiation version, cleanly locking past data trails into the archive."""
        presupuesto = self.get_object()

        items_data = request.data.get('line_items', [])
        if not items_data:
            return Response({'line_items': 'At least one line item is required.'}, status=status.HTTP_400_BAD_REQUEST)

        items_serializer = LineItemWriteSerializer(data=items_data, many=True)
        items_serializer.is_valid(raise_exception=True)

        # Set old non-archived states cleanly over to Archived
        presupuesto.versions.filter(status__in=['Draft', 'Sent', 'Accepted', 'Rejected']).update(
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

        return Response(PresupuestoVersionSerializer(new_version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='send')
    @transaction.atomic
    def send(self, request, pk=None):
        """Transitions latest Draft version to Sent."""
        presupuesto = self.get_object()
        version = presupuesto.versions.filter(status='Draft').order_by('-version_number').first()

        if not version:
            return Response({'detail': 'No active draft version found to mark as sent.'}, status=status.HTTP_400_BAD_REQUEST)

        version.status = 'Sent'
        version.save()

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        data = self._inject_serialized_accounting_data(out.data, presupuesto)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    @transaction.atomic
    def reject(self, request, pk=None):
        """Transitions latest Sent or Draft version to Rejected."""
        presupuesto = self.get_object()
        version = presupuesto.versions.filter(status__in=['Draft', 'Sent']).order_by('-version_number').first()

        if not version:
            return Response({'detail': 'No active version found to reject.'}, status=status.HTTP_400_BAD_REQUEST)

        version.status = 'Rejected'
        version.save()

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        data = self._inject_serialized_accounting_data(out.data, presupuesto)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept')
    @transaction.atomic
    def accept(self, request, pk=None):
        """
        Accepts the latest issued proposition. 
        Only creates a 50% deposit invoice if NO invoices exist yet for this deal.
        """
        presupuesto = self.get_object()
        
        # Look for the active Sent version that needs acceptance
        version = presupuesto.versions.filter(status='Sent').order_by('-version_number').first()
        if not version:
            return Response({'detail': 'Presupuesto must be in "Sent" status before acceptance.'}, status=status.HTTP_400_BAD_REQUEST)

        version.status = 'Accepted'
        version.save()

        if presupuesto.event:
            presupuesto.event.title = presupuesto.title
            presupuesto.event.notes = f"Confirmed booking from Presupuesto #{presupuesto.id}"
            presupuesto.event.save()

        # DYNAMIC DEPOSIT DRILLDOWN GUARD:
        # Check if an invoice has ever been issued for this file to prevent duplicate deposit runs.
        if not presupuesto.invoices.exists():
            deposit_amount = (version.total_amount / 2).quantize(Decimal('0.01'))
            invoice_number = _generate_invoice_number('Deposit')
            
            invoice = Invoice.objects.create(
                invoice_number=invoice_number,
                client=presupuesto.client,
                presupuesto=presupuesto,
                presupuesto_version=version,
                invoice_type='Deposit',
                amount=deposit_amount,
                due_date=request.data.get('due_date', timezone.now().date()),
            )

            invoice_pdf_bytes = generate_pdf_file('invoice_template.html', {'invoice': invoice})
            invoice.pdf_file.save(f"invoice_{invoice_number}.pdf", ContentFile(invoice_pdf_bytes), save=True)

        out = PresupuestoSerializer(presupuesto, context={'request': request})
        data = self._inject_serialized_accounting_data(out.data, presupuesto)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='final_invoice')
    @transaction.atomic
    def final_invoice(self, request, pk=None):
        """
        Generates the Final Invoice for the remaining balance.
        Calculates balance as (Latest Accepted Version Amount - Total Deposits Paid).
        """
        presupuesto = self.get_object()

        if not presupuesto.active_version or presupuesto.active_version.status != 'Accepted':
            return Response({'detail': 'Presupuesto must have an active accepted version first.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent issuing duplicate final billing items
        if presupuesto.invoices.filter(invoice_type='Final').exists():
            return Response({'detail': 'A final invoice has already been issued for this file.'}, status=status.HTTP_400_BAD_REQUEST)

        # DYNAMIC BALANCING MATH CALCULATION LAYER:
        balance = presupuesto.balance_due
        
        if balance <= 0:
            return Response({'detail': 'No outstanding balance due. Deposits cover the full amount.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_number = _generate_invoice_number('Final')
        invoice = Invoice.objects.create(
            invoice_number=invoice_number,
            client=presupuesto.client,
            presupuesto=presupuesto,
            presupuesto_version=presupuesto.active_version,
            invoice_type='Final',
            amount=balance,
            due_date=request.data.get('due_date', (presupuesto.event_start - timezone.timedelta(days=7)).date()),
        )

        final_pdf_bytes = generate_pdf_file('invoice_template.html', {'invoice': invoice})
        invoice.pdf_file.save(f"invoice_{invoice_number}.pdf", ContentFile(final_pdf_bytes), save=True)

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Invoice ViewSet
# ---------------------------------------------------------------------------

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('client', 'presupuesto', 'presupuesto_version').order_by('-created_at')
    serializer_class = InvoiceSerializer

    @action(detail=True, methods=['post'], url_path='mark_paid')
    @transaction.atomic
    def mark_paid(self, request, pk=None):
        """Marks an invoice as paid and recalculates the updated binary watermark asset stamp."""
        invoice = self.get_object()
        if invoice.status == 'Paid':
            return Response({"message": "Ledger asset already confirmed paid."}, status=status.HTTP_400_BAD_REQUEST)

        invoice.status = 'Paid'
        invoice.paid_at = timezone.now()
        invoice.save()

        # Update the file copy to include the "PAGADA" watermark stamp
        invoice_pdf_bytes = generate_pdf_file('invoice_template.html', {'invoice': invoice})
        if invoice.pdf_file and os.path.exists(invoice.pdf_file.path):
            os.remove(invoice.pdf_file.path)
                
        invoice.pdf_file.save(f"invoice_{invoice.invoice_number}_PAID.pdf", ContentFile(invoice_pdf_bytes), save=True)

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_200_OK)