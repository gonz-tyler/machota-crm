from rest_framework import serializers
from .models import Client, Event, Presupuesto, Invoice

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Event
        fields = '__all__'

class PresupuestoSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    client_email = serializers.CharField(source='client.email', read_only=True)
    client_company = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model = Presupuesto
        fields = '__all__'

class InvoiceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    presupuesto_title = serializers.CharField(source='presupuesto.title', read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'