import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Mail, Phone, Building2, Trash2, Edit2, X } from 'lucide-react';

export default function ClientsPage() {
  // Data State
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientFormData, setClientFormData] = useState({
    name: '', email: '', company: '', phone: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('clients/');
      setClients(response.data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleClientInputChange = (e) => {
    setClientFormData({ ...clientFormData, [e.target.name]: e.target.value });
  };

  const closeClientModal = () => {
    setShowClientModal(false);
    setEditingClientId(null);
    setClientFormData({ name: '', email: '', company: '', phone: '' });
  };

  const editClient = (client) => {
    setClientFormData({
      name: client.name, 
      email: client.email, 
      company: client.company || '', 
      phone: client.phone || ''
    });
    setEditingClientId(client.id);
    setShowClientModal(true);
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClientId) {
        const response = await api.put(`clients/${editingClientId}/`, clientFormData);
        setClients(clients.map(c => c.id === editingClientId ? response.data : c));
      } else {
        const response = await api.post('clients/', clientFormData);
        setClients([response.data, ...clients]);
      }
      closeClientModal();
    } catch (error) {
      alert("Error saving client. Make sure the email is unique.");
      console.error(error);
    }
  };

  const deleteClient = async (id) => {
    if (window.confirm("Delete this client? This will also delete their events.")) {
      try {
        await api.delete(`clients/${id}/`);
        setClients(clients.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Client Directory</h2>
        <button onClick={() => setShowClientModal(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all active:scale-95">
          <Plus size={18} />
          <span>New Client</span>
        </button>
      </header>
      
      <main className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-gray-400 animate-pulse">Loading database...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{client.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center space-x-2"><Building2 size={14} className="text-gray-400" /><span className="text-sm">{client.company || 'N/A'}</span></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600"><Mail size={14} className="text-gray-400" /><span>{client.email}</span></div>
                      {client.phone && (<div className="flex items-center space-x-2 text-sm text-gray-600 mt-1"><Phone size={14} className="text-gray-400" /><span>{client.phone}</span></div>)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => editClient(client)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all mr-2" title="Edit Client"><Edit2 size={18} /></button>
                      <button onClick={() => deleteClient(client.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Delete Client"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* MODAL JSX - This was missing! */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">{editingClientId ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={closeClientModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleClientSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required name="name" value={clientFormData.name} onChange={handleClientInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input required type="email" name="email" value={clientFormData.email} onChange={handleClientInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input name="company" value={clientFormData.company} onChange={handleClientInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input name="phone" value={clientFormData.phone} onChange={handleClientInputChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                  {editingClientId ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}