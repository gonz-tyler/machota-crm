import React, { useState, useEffect, useCallback } from "react";
import api from "../api";
import {
  Plus,
  Eye,
  X,
  User,
  Tag,
  Download,
  Euro,
  History,
  PackagePlus,
  Trash2,
  CheckCircle,
  Send,
  XCircle,
  FilePenLine,
  Receipt,
  Scale,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants & Styles
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "Rodajes",
  "Alojamiento",
  "AIRBNB",
  "Talleres y retiros",
  "Celebraciones",
  "Corporativo",
  "Catering & others",
];

const getBadgeStyle = (type) => {
  const map = {
    Rodajes: "bg-purple-100 text-purple-800 border-purple-200",
    Alojamiento: "bg-blue-100 text-blue-800 border-blue-200",
    AIRBNB: "bg-rose-100 text-rose-800 border-rose-200",
    "Talleres y retiros": "bg-emerald-100 text-emerald-800 border-emerald-200",
    Celebraciones: "bg-amber-100 text-amber-800 border-amber-200",
    Corporativo: "bg-slate-100 text-slate-800 border-slate-200",
    "Catering & others": "bg-orange-100 text-orange-800 border-orange-200",
  };
  return map[type] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusStyle = (status) => {
  const map = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    Sent: "bg-blue-100 text-blue-800 border-blue-200",
    Accepted: "bg-green-100 text-green-800 border-green-200",
    Rejected: "bg-red-100 text-red-800 border-red-200",
    Archived: "bg-gray-100 text-gray-400 border-gray-200",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

const getDisplayStatus = (pres) => {
  if (pres?.is_fully_paid) return "Completado";
  if (pres?.has_final_invoice) return "Facturado";
  return pres?.active_status || "—";
};

const getDisplayStatusStyle = (status) => {
  const map = {
    Completado: "bg-emerald-100 text-emerald-800 border-emerald-300",
    Facturado: "bg-indigo-100 text-indigo-800 border-indigo-200",
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    Sent: "bg-blue-100 text-blue-800 border-blue-200",
    Accepted: "bg-green-100 text-green-800 border-green-200",
    Rejected: "bg-red-100 text-red-800 border-red-200",
    Archived: "bg-gray-100 text-gray-400 border-gray-200",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

// ---------------------------------------------------------------------------
// LineItemBuilder Sub-Component
// ---------------------------------------------------------------------------

function LineItemBuilder({ catalogItems, lineItems, setLineItems, eventType }) {
  const relevant = eventType
    ? catalogItems.filter(
        (ci) =>
          ci.category === eventType || ci.category === "Catering & others",
      )
    : catalogItems;

  const addItem = (catalogItem) => {
    if (lineItems.find((li) => li.catalog_item_id === catalogItem.id)) return;
    setLineItems([
      ...lineItems,
      {
        catalog_item_id: catalogItem.id,
        catalog_item: catalogItem,
        quantity: 1,
        show_on_client_pdf: true,
        client_display_name: "",
      },
    ]);
  };

  const removeItem = (id) => {
    setLineItems(lineItems.filter((li) => li.catalog_item_id !== id));
  };

  const updateItem = (id, field, value) => {
    setLineItems(
      lineItems.map((li) =>
        li.catalog_item_id === id ? { ...li, [field]: value } : li,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Añadir servicio
        </p>
        <div className="flex flex-wrap gap-2">
          {relevant.map((ci) => {
            const added = lineItems.find((li) => li.catalog_item_id === ci.id);
            return (
              <button
                key={ci.id}
                type="button"
                onClick={() => addItem(ci)}
                disabled={!!added}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  added
                    ? "bg-green-50 border-green-200 text-green-700 cursor-default"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                {added ? "✓ " : "+ "}
                {ci.internal_name}
              </button>
            );
          })}
        </div>
      </div>

      {lineItems.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  Servicio
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  Nombre en PDF
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                  Visible
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((li) => (
                <tr key={li.catalog_item_id} className="bg-white">
                  <td className="px-3 py-2 text-xs font-medium text-gray-800">
                    {li.catalog_item.internal_name}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      value={li.quantity}
                      onChange={(e) =>
                        updateItem(
                          li.catalog_item_id,
                          "quantity",
                          e.target.value,
                        )
                      }
                      className="w-20 p-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      placeholder={li.catalog_item.client_facing_name}
                      value={li.client_display_name}
                      onChange={(e) =>
                        updateItem(
                          li.catalog_item_id,
                          "client_display_name",
                          e.target.value,
                        )
                      }
                      className="w-full p-1 border border-gray-200 rounded text-xs text-gray-700 placeholder-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={li.show_on_client_pdf}
                      onChange={(e) =>
                        updateItem(
                          li.catalog_item_id,
                          "show_on_client_pdf",
                          e.target.checked,
                        )
                      }
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(li.catalog_item_id)}
                      className="p-1 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PresupuestosPage Component
// ---------------------------------------------------------------------------

export default function PresupuestosPage({ refreshTrigger }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [clients, setClients] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drawer Control State
  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [drawerTab, setDrawerTab] = useState("details");

  // Create Project Shell Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    client: "",
    title: "",
    event_type: "",
    event_start: "",
    event_end: "",
    notes: "",
  });
  const [createLineItems, setCreateLineItems] = useState([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Revision Form Modal State
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [newVersionLineItems, setNewVersionLineItems] = useState([]);
  const [newVersionSubmitting, setNewVersionSubmitting] = useState(false);

  // Custom Simulated Workflow Alert Overlays
  const [simulatedEmailPopup, setSimulatedEmailPopup] = useState(null);
  const [showRejectionOptionsModal, setShowRejectionOptionsModal] =
    useState(false);

  // FIXED: We removed drawerItem from dependencies to stop the re-render trigger loop
  const fetchData = useCallback(async () => {
    try {
      const [presRes, clientRes, catalogRes] = await Promise.all([
        api.get("presupuestos/"),
        api.get("clients/"),
        api.get("catalog/"),
      ]);
      setPresupuestos(presRes.data);
      setClients(clientRes.data);
      setCatalogItems(catalogRes.data);
      setLoading(false);

      // Functional updater pattern ensures we use the freshest state without creating loops
      setDrawerItem((currentDrawerItem) => {
        if (!currentDrawerItem) return null;
        const structuralRefresh = presRes.data.find(
          (p) => p.id === currentDrawerItem.id,
        );
        return structuralRefresh || currentDrawerItem;
      });
    } catch (error) {
      console.error("Error loading CRM dataset context pools:", error);
      setLoading(false);
    }
  }, []);

  // FIXED: Only trigger on mounting adjustments or explicit context refreshes
  useEffect(() => {
    fetchData();
  }, [refreshTrigger, fetchData]);

  const getActiveVersion = (pres) => {
    if (!pres?.versions?.length) return null;
    return (
      pres.versions.find((v) => v.status === "Accepted") ||
      pres.versions.find((v) => v.status === "Sent") ||
      pres.versions[0]
    );
  };

  useEffect(() => {
    if (drawerItem) {
      requestAnimationFrame(() => setDrawerVisible(true));
      setPreviewVersion(getActiveVersion(drawerItem));
    } else {
      setDrawerVisible(false);
      setPreviewVersion(null);
    }
  }, [drawerItem]);

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerItem(null), 300);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createLineItems.length === 0)
      return alert("Por favor, añade al menos un servicio al presupuesto.");
    setCreateSubmitting(true);
    try {
      const payload = {
        ...createForm,
        line_items: createLineItems.map((li) => ({
          catalog_item_id: li.catalog_item_id,
          quantity: parseFloat(li.quantity),
          show_on_client_pdf: li.show_on_client_pdf,
          client_display_name: li.client_display_name,
        })),
      };
      await api.post("presupuestos/", payload);
      fetchData();
      setShowCreateModal(false);
      setCreateLineItems([]);
      setCreateForm({
        client: "",
        title: "",
        event_type: "",
        event_start: "",
        event_end: "",
        notes: "",
      });
    } catch (error) {
      alert("Error al guardar el presupuesto. Verifica los tramos de precio.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const setupLineItemsForRevision = () => {
    const active = getActiveVersion(drawerItem);
    if (active?.line_items) {
      return active.line_items.map((li) => ({
        catalog_item_id: li.catalog_item,
        catalog_item: catalogItems.find((ci) => ci.id === li.catalog_item) || {
          internal_name: li.display_name,
        },
        quantity: li.quantity,
        show_on_client_pdf: li.show_on_client_pdf,
        client_display_name: li.client_display_name || "",
      }));
    }
    return [];
  };

  const openNewVersionModal = () => {
    setNewVersionLineItems(setupLineItemsForRevision());
    setNewVersionNotes("");
    setShowNewVersionModal(true);
  };

  const handleNewVersion = async (e) => {
    e.preventDefault();
    setNewVersionSubmitting(true);
    try {
      const payload = {
        notes: newVersionNotes,
        line_items: newVersionLineItems.map((li) => ({
          catalog_item_id: li.catalog_item_id,
          quantity: parseFloat(li.quantity),
          show_on_client_pdf: li.show_on_client_pdf,
          client_display_name: li.client_display_name,
        })),
      };
      await api.post(`presupuestos/${drawerItem.id}/new_version/`, payload);
      const updated = await api.get(`presupuestos/${drawerItem.id}/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? updated.data : p)),
      );
      setDrawerItem(updated.data);
      setShowNewVersionModal(false);
    } catch (error) {
      alert("Error al compilar y guardar el nuevo documento revisado.");
    } finally {
      setNewVersionSubmitting(false);
    }
  };

  const handleSendToClient = async () => {
    try {
      const response = await api.post(`presupuestos/${drawerItem.id}/send/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? response.data : p)),
      );
      setDrawerItem(response.data);

      setSimulatedEmailPopup({
        email: drawerItem.client_email,
        title: drawerItem.title,
        version: getActiveVersion(response.data)?.version_number || 1,
      });
    } catch (error) {
      alert("Error al procesar la salida de despacho documental.");
    }
  };

  const handleAccept = async () => {
    try {
      const response = await api.post(`presupuestos/${drawerItem.id}/accept/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? response.data : p)),
      );
      setDrawerItem(response.data);
    } catch (error) {
      alert(
        "Error formalizando aceptación. Verifica flujos flujos contables asociados.",
      );
    }
  };

  const handleFinalInvoice = async () => {
    try {
      // Calls the @action final_invoice you built in views.py
      await api.post(`presupuestos/${drawerItem.id}/final_invoice/`);

      // Refresh the specific item to update the UI (since a new invoice is linked)
      const response = await api.get(`presupuestos/${drawerItem.id}/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? response.data : p)),
      );
      setDrawerItem(response.data);

      alert(
        "Factura final generada con éxito. Puedes verla en la pestaña de Invoices.",
      );
    } catch (error) {
      alert(
        error.response?.data?.detail ||
          "Error al generar la factura final. Verifica que no exista ya una.",
      );
    }
  };

  const handleRejectLostJob = async () => {
    try {
      const response = await api.post(`presupuestos/${drawerItem.id}/reject/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? response.data : p)),
      );
      setDrawerItem(response.data);
      setShowRejectionOptionsModal(false);
    } catch (error) {
      alert("Error al registrar cancelación irrevocable.");
    }
  };

  const handleRejectAndRenegotiate = () => {
    setShowRejectionOptionsModal(false);
    setNewVersionLineItems(setupLineItemsForRevision());
    setNewVersionNotes(
      "Re-negociación iniciada tras rechazo de propuesta anterior.",
    );
    setShowNewVersionModal(true);
  };

  const activeVersion = drawerItem ? getActiveVersion(drawerItem) : null;

  // Real-time calculation layer with direct fallback math to protect UI display values
  const rawTotal = activeVersion ? parseFloat(activeVersion.total_amount) : 0;

  const totalPaid =
    drawerItem && drawerItem.total_deposits_paid !== undefined
      ? parseFloat(drawerItem.total_deposits_paid)
      : 0;

  const balanceDue =
    drawerItem && drawerItem.balance_due !== undefined
      ? parseFloat(drawerItem.balance_due)
      : Math.max(0, rawTotal - totalPaid);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Presupuestos</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> <span>Nuevo Presupuesto</span>
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
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Titulo
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {presupuestos.map((pres) => (
                  <tr
                    key={pres.id}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {pres.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        #{pres.id} · {pres.versions?.length || 0} versiones
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {pres.client_name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border ${getBadgeStyle(pres.event_type)}`}
                      >
                        {pres.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {pres.active_amount
                        ? `${parseFloat(pres.active_amount).toFixed(2)}€`
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${getDisplayStatusStyle(pres.active_status)}`}
                      >
                        {pres.active_status || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDrawerItem(pres)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
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

      {/* RIGHT SIDE MANAGEMENT DRAWER */}
      {drawerItem && (
        <>
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-300"
            style={{ opacity: drawerVisible ? 1 : 0 }}
          />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
            style={{
              transform: drawerVisible ? "translateX(0)" : "translateX(100%)",
            }}
          >
            <div className="h-16 border-b bg-gray-50 px-6 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {drawerItem.title}
                </h3>
                <p className="text-xs text-gray-400">
                  #{drawerItem.id} · {drawerItem.client_name}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b bg-white shrink-0">
              <button
                onClick={() => setDrawerTab("details")}
                className={`px-6 py-3 text-sm font-semibold border-b-2 ${drawerTab === "details" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
              >
                Detalles
              </button>
              <button
                onClick={() => setDrawerTab("history")}
                className={`px-6 py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${drawerTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
              >
                <History size={14} /> Versiones
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerTab === "details" && (
                <>
                  <div className="grid grid-cols-3 bg-slate-950 text-white rounded-2xl p-5 shadow-inner border border-slate-800">
                    <div className="border-r border-slate-800/60 px-2">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <Euro size={10} /> Presupuesto Total
                      </p>
                      <p className="text-xl font-bold text-slate-100">
                        {rawTotal.toFixed(2)}€
                      </p>
                    </div>
                    <div className="border-r border-slate-800/60 px-4">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                        <CheckCircle size={10} /> Total Abonado
                      </p>
                      <p className="text-xl font-bold text-emerald-400">
                        -{totalPaid.toFixed(2)}€
                      </p>
                    </div>
                    <div className="px-4 bg-amber-500/10 rounded-xl py-1 border border-amber-500/20">
                      <p className="text-[10px] uppercase font-black tracking-widest text-amber-400 mb-0.5 flex items-center gap-1">
                        <Scale size={10} /> Pendiente de Cobro
                      </p>
                      <p className="text-2xl font-black text-amber-400">
                        {balanceDue.toFixed(2)}€
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 border">
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Estado Operativo
                      </div>
                      <span
                        className={`inline-block px-3 py-0.5 text-xs font-bold rounded-full border ${getDisplayStatusStyle(drawerItem.active_status)}`}
                      >
                        {drawerItem.active_status || "—"}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border">
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Categoría Proyecto
                      </div>
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getBadgeStyle(drawerItem.event_type)}`}
                      >
                        {drawerItem.event_type}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border">
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        Versión Activa
                      </div>
                      <p className="text-sm font-bold text-gray-700">
                        v{previewVersion?.version_number}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt size={13} className="text-gray-400" /> Estado
                      Analítico de Cuenta del Evento
                    </h4>
                    <div className="divide-y divide-gray-100 text-sm">
                      <div className="py-2.5 flex justify-between text-gray-600">
                        <span>Importe Bruto del Servicio Contractual</span>
                        <span className="font-semibold text-gray-800">
                          {rawTotal.toFixed(2)}€
                        </span>
                      </div>
                      <div className="py-2.5 flex justify-between text-emerald-700">
                        <span>Crédito Liquidado por Depósito Inicial</span>
                        <span className="font-semibold">
                          -{totalPaid.toFixed(2)}€
                        </span>
                      </div>
                      <div className="py-3 flex justify-between text-base font-bold bg-slate-50 px-3 rounded-xl mt-2 border border-slate-100">
                        <span className="text-gray-700">
                          Saldo Pendiente Neto en Factura Final
                        </span>
                        <span className="text-amber-600">
                          {balanceDue.toFixed(2)}€
                        </span>
                      </div>
                    </div>
                  </div>

                  {previewVersion?.pdf_file && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Servidor Central Snapshot Preview (Documento Inmutable)
                      </p>
                      <div className="w-full h-[550px] bg-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <iframe
                          src={`${previewVersion.pdf_file}?t=${new Date().getTime()}`}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {drawerTab === "history" && (
                <div className="space-y-2">
                  {drawerItem.versions?.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gray-400">
                          v{v.version_number}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${getDisplayStatusStyle(v.status)}`}
                        >
                          {v.status}
                        </span>
                        {v.notes && (
                          <span className="text-xs text-gray-400 italic truncate max-w-xs">
                            ({v.notes})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setPreviewVersion(v);
                          setDrawerTab("details");
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Ver Snapshot
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 text-sm font-medium border rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>

              {previewVersion?.pdf_file && (
                <a
                  href={previewVersion.pdf_file}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 border text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Download size={15} /> Descargar PDF
                </a>
              )}

              {drawerItem.active_status === "Draft" && (
                <button
                  onClick={handleSendToClient}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Send size={15} /> Enviar al Cliente
                </button>
              )}

              {drawerItem.active_status === "Sent" && (
                <>
                  <button
                    onClick={() => setShowRejectionOptionsModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <XCircle size={15} /> Marcar Rechazado
                  </button>
                  <button
                    onClick={handleAccept}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <CheckCircle size={15} /> Marcar Aceptado
                  </button>
                </>
              )}

              {drawerItem.active_status === "Accepted" && (
                <>
                  <button
                    onClick={openNewVersionModal}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors shadow-sm"
                  >
                    <PackagePlus size={15} /> Nueva versión
                  </button>

                  {/* DYNAMIC FINAL INVOICE TRIGGER */}
                  {balanceDue > 0 && !drawerItem.has_final_invoice && (
                    <button
                      onClick={handleFinalInvoice}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                    >
                      <Receipt size={15} /> Emitir Factura Final
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL: CREATE NEW BASE PRESUPUESTO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                Nuevo Presupuesto
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cliente
                </label>
                <select
                  required
                  value={createForm.client}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, client: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Título del proyecto
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, title: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Tipo de evento
                  </label>
                  <select
                    required
                    value={createForm.event_type}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        event_type: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">Selecciona tipo</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Inicio del evento
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={createForm.event_start}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        event_start: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Fin del evento
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={createForm.event_end}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        event_end: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Servicios Incluidos
                </label>
                <LineItemBuilder
                  catalogItems={catalogItems}
                  lineItems={createLineItems}
                  setLineItems={setCreateLineItems}
                  eventType={createForm.event_type}
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50">
              <button
                type="submit"
                disabled={createSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow"
              >
                {createSubmitting
                  ? "Generando Documentación..."
                  : "Generar Presupuesto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REVISE CURRENT ITEMS (NEW VERSION) */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleNewVersion}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Nueva versión</h3>
              <button
                type="button"
                onClick={() => setShowNewVersionModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
                La versión anterior quedará archivada como un registro histórico
                inmutable dentro del historial de auditoría.
              </div>
              <LineItemBuilder
                catalogItems={catalogItems}
                lineItems={newVersionLineItems}
                setLineItems={setNewVersionLineItems}
                eventType={drawerItem?.event_type}
              />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Motivo del cambio (Interno)
                </label>
                <textarea
                  rows={2}
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Cambio solicitado por el cliente..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50">
              <button
                type="submit"
                disabled={newVersionSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow"
              >
                {newVersionSubmitting
                  ? "Compilando versión..."
                  : "Crear nueva versión"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SIMULATED SYSTEM DISPATCH BANNER POPUP (EMAIL EMULATION) */}
      {simulatedEmailPopup && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-700 z-50 max-w-sm animate-slide-in">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-xs font-black tracking-widest text-blue-400 uppercase">
              Simulación de Despacho Técnico
            </h4>
            <button
              onClick={() => setSimulatedEmailPopup(null)}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Se ha simulado el envío de la propuesta comercial{" "}
            <strong>
              "{simulatedEmailPopup.title}" (v{simulatedEmailPopup.version})
            </strong>{" "}
            con su respectivo PDF adjunto al buzón electrónico del cliente:
          </p>
          <div className="mt-3 bg-slate-800 text-blue-300 p-2 text-center font-mono rounded-lg text-xs font-bold select-all truncate">
            {simulatedEmailPopup.email}
          </div>
        </div>
      )}

      {/* STYLED REJECTION DIALOG ACTION ROUTER MODAL */}
      {showRejectionOptionsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border text-center animate-scale-up">
            <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
              <XCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Propuesta Comercial Rechazada
            </h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              ¿Cómo deseas procesar la respuesta negativa del cliente? Puedes
              cerrar el expediente declarando el encargo perdido o abrir una
              mesa de negociación modificando los términos comerciales actuales.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRejectAndRenegotiate}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold text-sm py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <FilePenLine size={16} /> Ajustar Detalles y Re-negociar
              </button>
              <button
                type="button"
                onClick={handleRejectLostJob}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Trash2 size={16} /> Cerrar Expediente (Misión Perdida)
              </button>
              <button
                type="button"
                onClick={() => setShowRejectionOptionsModal(false)}
                className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 pt-2 transition-colors"
              >
                Cancelar Acción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
