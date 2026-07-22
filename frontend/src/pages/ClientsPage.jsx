import React, { useState, useEffect } from "react";
import api from "../api";
import { Plus, Mail, Phone, Building2, Trash2, Edit2 } from "lucide-react";
import ClientModal from "../components/ClientModal"; // Adjust path as needed

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get("clients/");
      setClients(response.data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const editClient = (client) => {
    setClientToEdit(client);
    setShowClientModal(true);
  };

  const handleClientSuccess = (clientData, isEdit) => {
    if (isEdit) {
      setClients(clients.map((c) => (c.id === clientData.id ? clientData : c)));
    } else {
      setClients([clientData, ...clients]);
    }
  };

  const deleteClient = async (id) => {
    if (
      window.confirm(
        "¿Eliminar este cliente? Esto también eliminará sus eventos y presupuestos.",
      )
    ) {
      try {
        await api.delete(`clients/${id}/`);
        setClients(clients.filter((c) => c.id !== id));
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Clientes</h2>
        <button
          onClick={() => {
            setClientToEdit(null);
            setShowClientModal(true);
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={18} />
          <span>Nuevo Cliente</span>
        </button>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-gray-400 animate-pulse">
              Cargando base de datos...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Detalles del Cliente
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Compañia
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Info de Contacto
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {client.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Building2 size={14} className="text-gray-400" />
                        <span className="text-sm">
                          {client.company || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" />
                        <span>{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                          <Phone size={14} className="text-gray-400" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => editClient(client)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all mr-2"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteClient(client.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSuccess={handleClientSuccess}
        clientToEdit={clientToEdit}
      />
    </div>
  );
}
