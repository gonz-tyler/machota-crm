from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import Client, Event, Presupuesto, Invoice
from .serializers import ClientSerializer, EventSerializer, PresupuestoSerializer, InvoiceSerializer

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    serializer_class = ClientSerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by('-start_time')
    serializer_class = EventSerializer

class PresupuestoViewSet(viewsets.ModelViewSet):
    queryset = Presupuesto.objects.all().order_by('-created_at')
    serializer_class = PresupuestoSerializer

    @action(detail=True, methods=['post'])
    def convert_to_invoice(self, request, pk=None):
        presupuesto = self.get_object()
        
        # Check if already converted
        if hasattr(presupuesto, 'invoice') or presupuesto.status == 'Accepted':
            return Response({'error': 'This quote has already been converted to an invoice.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a unique invoice number (e.g., INV-2026-001)
        invoice_num = f"INV-{timezone.now().year}-{presupuesto.id:03d}"
        
        # Create the invoice
        Invoice.objects.create(
            invoice_number=invoice_num,
            client=presupuesto.client,
            presupuesto=presupuesto,
            amount=presupuesto.amount,
            issue_date=timezone.now().date(),
            due_date=timezone.now().date() + timedelta(days=30) # Default net-30 terms
        )

        # Update Presupuesto status
        presupuesto.status = 'Accepted'
        presupuesto.save()

        return Response({'message': 'Invoice created successfully.', 'invoice_number': invoice_num})

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().order_by('-created_at')
    serializer_class = InvoiceSerializer
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'Paid'
        invoice.save()
        serializer = self.get_serializer(invoice)
        return Response(serializer.data)