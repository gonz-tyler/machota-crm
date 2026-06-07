import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Eye, X, User, ArrowRight, Tag, Download, Euro } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getBadgeStyle = (type) => {
  switch (type) {
    case 'Rodajes':              return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Alojamiento':          return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'AIRBNB':               return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'Talleres y retiros':   return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Celebraciones':        return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Corporativo':          return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'Catering & others':    return 'bg-orange-100 text-orange-800 border-orange-200';
    default:                     return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [drawerItem, setDrawerItem]           = useState(null);   // open drawer with this item
  const [drawerVisible, setDrawerVisible]     = useState(false);  // controls CSS transition
  const [pdfPreviewUrl, setPdfPreviewUrl]     = useState(null);

  const [formData, setFormData] = useState({
    client: '', title: '', event_type: '', event_start: '', event_end: '', amount: '',
  });

  useEffect(() => { fetchData(); }, []);

  // Trigger slide-in when drawerItem is set
  useEffect(() => {
    if (drawerItem) {
      // Small delay so the element is in the DOM before we add the visible class
      requestAnimationFrame(() => setDrawerVisible(true));
      const doc = buildPDF(drawerItem);
      setPdfPreviewUrl(doc.output('bloburl'));
    } else {
      setDrawerVisible(false);
      setPdfPreviewUrl(null);
    }
  }, [drawerItem]);

  const closeDrawer = () => {
    setDrawerVisible(false);
    // Wait for the slide-out animation to finish before unmounting
    setTimeout(() => setDrawerItem(null), 300);
  };

  const fetchData = async () => {
    try {
      const [presRes, clientRes] = await Promise.all([
        api.get('presupuestos/'),
        api.get('clients/'),
      ]);
      setPresupuestos(presRes.data);
      setClients(clientRes.data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('presupuestos/', formData);
      setPresupuestos([response.data, ...presupuestos]);
      setShowCreateModal(false);
      setFormData({ client: '', title: '', event_type: 'Corporativo', event_start: '', event_end: '', amount: '' });
    } catch (error) {
      alert('Error creando Presupuesto.');
    }
  };

  const handleConvertToInvoice = async (id) => {
    try {
      await api.post(`presupuestos/${id}/convert_to_invoice/`);
      alert('Presupuesto ha sido convertido a Factura.');
      closeDrawer();
      fetchData();
    } catch (error) {
      alert('No se pudo convertir. Puede que ya sea una factura.');
    }
  };

  const buildPDF = (quote) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text('PRESUPUESTO', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Quote ID: #${quote.id}`, 14, 37);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared For:', 14, 52);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${quote.client_name}`, 14, 59);
    doc.text(`Email: ${quote.client_email}`, 14, 64);

    autoTable(doc, {
      startY: 75,
      head: [['Project Details', 'Information']],
      body: [
        ['Title', quote.title],
        ['Event Category', quote.event_type],
        ['Start Time', new Date(quote.event_start).toLocaleString()],
        ['End Time', new Date(quote.event_end).toLocaleString()],
        ['Status', quote.status],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10, cellPadding: 5 },
    });

    const finalY = doc.lastAutoTable.finalY || 75;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(`Total Amount: ${quote.amount}€`, 14, finalY + 15);

    return doc;
  };

  const handleDownloadPDF = () => {
    if (drawerItem) {
      const doc = buildPDF(drawerItem);
      doc.save(`Presupuesto_${drawerItem.title.replace(/\s+/g, '_')}.pdf`);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">

      {/* Header */}
      <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Presupuestos</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
        >
          <Plus size={18} />
          <span>Nuevo Presupuesto</span>
        </button>
      </header>

      {/* Table */}
      <main className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-gray-400">Cargando base de datos...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Titulo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo de Evento</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {presupuestos.map((pres) => (
                  <tr key={pres.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{pres.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">#{pres.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{pres.client_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${getBadgeStyle(pres.event_type)}`}>
                        {pres.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{pres.amount}€</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${pres.status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {pres.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDrawerItem(pres)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                        title="Ver detalles"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── RIGHT DRAWER ──────────────────────────────────────────────────── */}
      {drawerItem && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-300"
            style={{ opacity: drawerVisible ? 1 : 0 }}
          />

          {/* Drawer panel */}
          <div
            className="fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
            style={{ transform: drawerVisible ? 'translateX(0)' : 'translateX(100%)' }}
          >
            {/* Drawer header */}
            <div className="h-16 border-b bg-gray-50 px-6 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Presupuesto #{drawerItem.id}</h3>
                <p className="text-xs text-gray-400">{drawerItem.title}</p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Client info */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm mb-3">
                  <User size={15} /> Detalles de Cliente
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="text-gray-500">Nombre:</span> {drawerItem.client_name}</p>
                  <p><span className="text-gray-500">Email:</span> {drawerItem.client_email}</p>
                  {drawerItem.client_company && (
                    <p><span className="text-gray-500">Empresa:</span> {drawerItem.client_company}</p>
                  )}
                </div>
              </div>

              {/* Key details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Tag size={12} /> Categoría</div>
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md border ${getBadgeStyle(drawerItem.event_type)}`}>
                    {drawerItem.event_type}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Euro size={12} /> Total</div>
                  <p className="text-lg font-semibold text-green-600">{drawerItem.amount}€</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">Inicio</div>
                  <p className="text-sm text-gray-700">{new Date(drawerItem.event_start).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">Fin</div>
                  <p className="text-sm text-gray-700">{new Date(drawerItem.event_end).toLocaleString()}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Estado:</span>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${drawerItem.status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {drawerItem.status}
                </span>
              </div>

              {/* PDF preview */}
              {pdfPreviewUrl && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vista previa del documento</p>
                  <div className="w-full h-[768px] bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    <iframe src={pdfPreviewUrl} className="w-full h-full" title="PDF Preview" />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                Cerrar
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
              >
                <Download size={15} /> Download PDF
              </button>
              {drawerItem.status !== 'Accepted' && (
                <button
                  onClick={() => handleConvertToInvoice(drawerItem.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Convert to Invoice <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── CREATE MODAL (unchanged) ──────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Redactar Nuevo Presupuesto</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elige un Cliente</label>
                <select required name="client" value={formData.client} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">---</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company || 'Individual'})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título del Proyecto</label>
                  <input required type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Evento</label>
                  <select required name="event_type" value={formData.event_type} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">---</option>
                    <option value="Rodajes">Rodajes</option>
                    <option value="Alojamiento">Alojamiento</option>
                    <option value="AIRBNB">AIRBNB</option>
                    <option value="Talleres y retiros">Talleres y retiros</option>
                    <option value="Celebraciones">Celebraciones</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="Catering & others">Catering & others</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio del Evento</label>
                  <input required type="datetime-local" name="event_start" value={formData.event_start} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin del Evento</label>
                  <input required type="datetime-local" name="event_end" value={formData.event_end} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total (€)</label>
                <input required type="number" step="0.01" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                  Generar Presupuesto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}