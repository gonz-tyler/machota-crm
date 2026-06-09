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
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle,
  Clock,
  ArrowRight,
  History,
  PackagePlus,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------------------------------------
// Constants
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
    Draft: "bg-gray-100 text-gray-700",
    Sent: "bg-blue-100 text-blue-800",
    Accepted: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
    Archived: "bg-gray-100 text-gray-400",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

// ---------------------------------------------------------------------------
// PDF builder — reads line items from a version
// ---------------------------------------------------------------------------

const buildPDF = (presupuesto, version) => {
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text("PRESUPUESTO", 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, 14, 32);
  doc.text(`Ref: #${presupuesto.id} · v${version.version_number}`, 14, 37);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Preparado para:", 14, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${presupuesto.client_name}`, 14, 59);
  if (presupuesto.client_email) doc.text(presupuesto.client_email, 14, 64);

  // Event details
  autoTable(doc, {
    startY: 73,
    head: [["Detalles del evento", ""]],
    body: [
      ["Título", presupuesto.title],
      ["Categoría", presupuesto.event_type],
      ["Inicio", new Date(presupuesto.event_start).toLocaleString("es-ES")],
      ["Fin", new Date(presupuesto.event_end).toLocaleString("es-ES")],
    ],
    theme: "plain",
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
  });

  // Line items — only show_on_client_pdf items
  const visibleItems = (version.line_items || []).filter(
    (li) => li.show_on_client_pdf,
  );

  if (visibleItems.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Servicio", "Cantidad", "Precio unit.", "Total"]],
      body: visibleItems.map((li) => [
        li.display_name ||
          li.client_display_name ||
          li.catalog_item_name ||
          "Servicio",
        `${li.quantity} ${li.unit_label}`,
        `${parseFloat(li.unit_price).toFixed(2)}€`,
        `${parseFloat(li.line_total).toFixed(2)}€`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 3: { halign: "right" } },
    });
  }

  const finalY = doc.lastAutoTable?.finalY || 120;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text(
    `Total: ${parseFloat(version.total_amount).toFixed(2)}€`,
    14,
    finalY + 16,
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150);
  doc.text(
    `Depósito (50%): ${(parseFloat(version.total_amount) / 2).toFixed(2)}€`,
    14,
    finalY + 26,
  );

  return doc;
};

// ---------------------------------------------------------------------------
// Line item builder — used in both create and new-version modal
// ---------------------------------------------------------------------------

function LineItemBuilder({ catalogItems, lineItems, setLineItems, eventType }) {
  // Filter catalog by event type if one is selected
  const relevant = eventType
    ? catalogItems.filter(
        (ci) =>
          ci.category === eventType || ci.category === "Catering & others",
      )
    : catalogItems;

  const addItem = (catalogItem) => {
    // Don't add duplicates
    if (lineItems.find((li) => li.catalog_item_id === catalogItem.id)) return;
    setLineItems([
      ...lineItems,
      {
        catalog_item_id: catalogItem.id,
        catalog_item: catalogItem, // kept locally for display
        quantity: 1,
        show_on_client_pdf: true,
        client_display_name: "",
        // computed preview
        _resolved_band: null,
        _line_total: null,
      },
    ]);
  };

  const removeItem = (id) => {
    setLineItems(lineItems.filter((li) => li.catalog_item_id !== id));
  };

  const updateItem = (id, field, value) => {
    setLineItems(
      lineItems.map((li) => {
        if (li.catalog_item_id !== id) return li;
        const updated = { ...li, [field]: value };
        // Re-resolve band whenever quantity changes
        if (field === "quantity") {
          const band = resolveBand(li.catalog_item, parseFloat(value));
          updated._resolved_band = band;
          updated._line_total = band
            ? parseFloat(band.price_per_unit) * parseFloat(value) +
              parseFloat(band.flat_fee || 0)
            : null;
        }
        return updated;
      }),
    );
  };

  const resolveBand = (catalogItem, qty) => {
    if (!catalogItem?.price_bands) return null;
    return (
      catalogItem.price_bands.find((b) => {
        const aboveMin = qty >= b.min_units;
        const belowMax = b.max_units == null || qty <= b.max_units;
        return aboveMin && belowMax;
      }) || null
    );
  };

  const runningTotal = lineItems.reduce((sum, li) => {
    if (li._line_total != null) return sum + li._line_total;
    // First pass: resolve on initial add
    const band = resolveBand(li.catalog_item, parseFloat(li.quantity) || 0);
    return (
      sum +
      (band
        ? parseFloat(band.price_per_unit) * parseFloat(li.quantity) +
          parseFloat(band.flat_fee || 0)
        : 0)
    );
  }, 0);

  return (
    <div className="space-y-4">
      {/* Service picker */}
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
          {relevant.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              No hay servicios para esta categoría. Añade servicios en el
              catálogo.
            </p>
          )}
        </div>
      </div>

      {/* Line items table */}
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
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  Total
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((li) => {
                const band =
                  li._resolved_band ||
                  resolveBand(li.catalog_item, parseFloat(li.quantity) || 0);
                const lineTotal = band
                  ? parseFloat(band.price_per_unit) * parseFloat(li.quantity) +
                    parseFloat(band.flat_fee || 0)
                  : null;
                const noBand = !band && li.quantity > 0;

                return (
                  <tr key={li.catalog_item_id} className="bg-white">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800 text-xs">
                        {li.catalog_item.internal_name}
                      </div>
                      {band && (
                        <div className="text-xs text-gray-400">
                          {band.price_per_unit}€/{band.unit_label}
                          {parseFloat(band.flat_fee) > 0 &&
                            ` + ${band.flat_fee}€ fijo`}
                        </div>
                      )}
                      {noBand && (
                        <div className="text-xs text-red-500">
                          Sin banda de precio para esta cantidad
                        </div>
                      )}
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
                      {band && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {band.unit_label}
                        </div>
                      )}
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
                        className="w-full p-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400 outline-none text-gray-700 placeholder-gray-300"
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
                    <td className="px-3 py-2 text-right font-medium text-gray-800 text-xs">
                      {lineTotal != null ? `${lineTotal.toFixed(2)}€` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(li.catalog_item_id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Running total */}
          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex justify-end">
            <span className="text-sm font-bold text-gray-900">
              Total: {runningTotal.toFixed(2)}€
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version history list shown in the drawer
// ---------------------------------------------------------------------------

function VersionHistory({ versions, onPreview }) {
  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 w-6">
              v{v.version_number}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyle(v.status)}`}
            >
              {v.status}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(v.created_at).toLocaleDateString("es-ES")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              {parseFloat(v.total_amount).toFixed(2)}€
            </span>
            <button
              onClick={() => onPreview(v)}
              className="text-xs text-blue-600 hover:underline"
            >
              Ver PDF
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [clients, setClients] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drawer
  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null); // which version's PDF is showing
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [drawerTab, setDrawerTab] = useState("details"); // "details" | "history"

  // Create modal
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

  // New version modal
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [newVersionLineItems, setNewVersionLineItems] = useState([]);
  const [newVersionSubmitting, setNewVersionSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

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
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Drawer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (drawerItem) {
      requestAnimationFrame(() => setDrawerVisible(true));
      setDrawerTab("details");
      // Show active version PDF by default
      const active = getActiveVersion(drawerItem);
      if (active) {
        setPreviewVersion(active);
        const doc = buildPDF(drawerItem, active);
        setPdfPreviewUrl(doc.output("bloburl"));
      }
    } else {
      setDrawerVisible(false);
      setPdfPreviewUrl(null);
      setPreviewVersion(null);
    }
  }, [drawerItem]);

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerItem(null), 300);
  };

  const handlePreviewVersion = (version) => {
    setPreviewVersion(version);
    const doc = buildPDF(drawerItem, version);
    setPdfPreviewUrl(doc.output("bloburl"));
    setDrawerTab("details");
  };

  const getActiveVersion = (pres) => {
    if (!pres?.versions?.length) return null;
    return (
      pres.versions.find((v) => v.status === "Accepted") || pres.versions[0]
    );
  };

  // ---------------------------------------------------------------------------
  // Create presupuesto
  // ---------------------------------------------------------------------------

  const resetCreateModal = () => {
    setCreateForm({
      client: "",
      title: "",
      event_type: "",
      event_start: "",
      event_end: "",
      notes: "",
    });
    setCreateLineItems([]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createLineItems.length === 0) {
      alert("Añade al menos un servicio.");
      return;
    }
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
      const response = await api.post("presupuestos/", payload);
      setPresupuestos([response.data, ...presupuestos]);
      setShowCreateModal(false);
      resetCreateModal();
    } catch (error) {
      console.error(error);
      alert(
        "Error creando el presupuesto. Comprueba que todas las cantidades tienen una banda de precio.",
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // New version
  // ---------------------------------------------------------------------------

  const openNewVersionModal = () => {
    // Pre-fill with current active version's line items
    const active = getActiveVersion(drawerItem);
    if (active?.line_items) {
      setNewVersionLineItems(
        active.line_items.map((li) => {
          const catalogItem = catalogItems.find(
            (ci) => ci.id === li.catalog_item,
          );
          return {
            catalog_item_id: li.catalog_item,
            catalog_item: catalogItem || {
              id: li.catalog_item,
              internal_name: li.display_name,
              price_bands: [],
            },
            quantity: li.quantity,
            show_on_client_pdf: li.show_on_client_pdf,
            client_display_name: li.client_display_name || "",
            _resolved_band: null,
            _line_total: null,
          };
        }),
      );
    } else {
      setNewVersionLineItems([]);
    }
    setNewVersionNotes("");
    setShowNewVersionModal(true);
  };

  const handleNewVersion = async (e) => {
    e.preventDefault();
    if (newVersionLineItems.length === 0) {
      alert("Añade al menos un servicio.");
      return;
    }
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
      const response = await api.post(
        `presupuestos/${drawerItem.id}/new_version/`,
        payload,
      );
      // Refresh this presupuesto in the list and in the drawer
      const updated = await api.get(`presupuestos/${drawerItem.id}/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? updated.data : p)),
      );
      setDrawerItem(updated.data);
      setShowNewVersionModal(false);
    } catch (error) {
      console.error(error);
      alert("Error creando nueva versión.");
    } finally {
      setNewVersionSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Accept & send deposit
  // ---------------------------------------------------------------------------

  const handleAccept = async () => {
    try {
      const response = await api.post(`presupuestos/${drawerItem.id}/accept/`);
      setPresupuestos(
        presupuestos.map((p) => (p.id === drawerItem.id ? response.data : p)),
      );
      setDrawerItem(response.data);
    } catch (error) {
      alert("Error al aceptar el presupuesto.");
    }
  };

  // ---------------------------------------------------------------------------
  // Download PDF
  // ---------------------------------------------------------------------------

  const handleDownloadPDF = () => {
    if (!drawerItem || !previewVersion) return;
    const doc = buildPDF(drawerItem, previewVersion);
    doc.save(
      `Presupuesto_${drawerItem.id}_v${previewVersion.version_number}.pdf`,
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeVersion = drawerItem ? getActiveVersion(drawerItem) : null;

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
            <div className="p-20 text-center text-gray-400">
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
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {pres.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        #{pres.id} · {pres.versions?.length || 0} versión
                        {pres.versions?.length !== 1 ? "es" : ""}
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
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {pres.active_amount
                        ? `${parseFloat(pres.active_amount).toFixed(2)}€`
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(pres.active_status)}`}
                      >
                        {pres.active_status || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDrawerItem(pres)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {presupuestos.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-20 text-center text-gray-400"
                    >
                      No hay presupuestos todavía. Crea el primero.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── DRAWER ────────────────────────────────────────────────────────── */}
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
            {/* Drawer header */}
            <div className="h-16 border-b bg-gray-50 px-6 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  {drawerItem.title}
                </h3>
                <p className="text-xs text-gray-400">
                  #{drawerItem.id} · {drawerItem.client_name}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b bg-white shrink-0">
              <button
                onClick={() => setDrawerTab("details")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  drawerTab === "details"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Detalles
              </button>
              <button
                onClick={() => setDrawerTab("history")}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  drawerTab === "history"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <History size={14} />
                Versiones
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {drawerItem.versions?.length || 0}
                </span>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerTab === "details" && (
                <>
                  {/* Status + amount hero */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Estado actual
                      </p>
                      <span
                        className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusStyle(drawerItem.active_status)}`}
                      >
                        {drawerItem.active_status || "—"}
                      </span>
                      {previewVersion &&
                        previewVersion.version_number !==
                          getActiveVersion(drawerItem)?.version_number && (
                          <p className="text-xs text-blue-500 mt-1">
                            Viendo v{previewVersion.version_number}
                          </p>
                        )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Total</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {activeVersion
                          ? `${parseFloat(activeVersion.total_amount).toFixed(2)}€`
                          : "—"}
                      </p>
                      {activeVersion && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Depósito:{" "}
                          {(parseFloat(activeVersion.total_amount) / 2).toFixed(
                            2,
                          )}
                          €
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Client + event info */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-800 font-medium text-sm mb-3">
                      <User size={15} /> Cliente
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>{drawerItem.client_name}</p>
                      {drawerItem.client_email && (
                        <p className="text-gray-400">
                          {drawerItem.client_email}
                        </p>
                      )}
                      {drawerItem.client_company && (
                        <p className="text-gray-400">
                          {drawerItem.client_company}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                        <Tag size={12} /> Categoría
                      </div>
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md border ${getBadgeStyle(drawerItem.event_type)}`}
                      >
                        {drawerItem.event_type}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                        <Euro size={12} /> Versión activa
                      </div>
                      <p className="text-sm font-medium text-gray-700">
                        v{activeVersion?.version_number || "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Inicio</div>
                      <p className="text-sm text-gray-700">
                        {new Date(drawerItem.event_start).toLocaleString(
                          "es-ES",
                        )}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Fin</div>
                      <p className="text-sm text-gray-700">
                        {new Date(drawerItem.event_end).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>

                  {/* Line items of current preview version */}
                  {previewVersion?.line_items?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Servicios · v{previewVersion.version_number}
                      </p>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                Servicio
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                Cant.
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {previewVersion.line_items.map((li) => (
                              <tr
                                key={li.id}
                                className={
                                  li.show_on_client_pdf ? "" : "opacity-40"
                                }
                              >
                                <td className="px-4 py-2 text-gray-700 text-xs">
                                  {li.display_name ||
                                    li.client_display_name ||
                                    "Servicio"}
                                  {!li.show_on_client_pdf && (
                                    <span className="ml-1 text-gray-400 text-xs">
                                      (interno)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-500 text-xs">
                                  {li.quantity} {li.unit_label}
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-gray-800 text-xs">
                                  {parseFloat(li.line_total).toFixed(2)}€
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* PDF preview */}
                  {pdfPreviewUrl && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Vista previa · v{previewVersion?.version_number}
                      </p>
                      <div className="w-full h-[640px] bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                        <iframe
                          src={pdfPreviewUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {drawerTab === "history" && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                    Historial de versiones
                  </p>
                  <VersionHistory
                    versions={drawerItem.versions || []}
                    onPreview={handlePreviewVersion}
                  />
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
                <Download size={15} /> Descargar PDF
              </button>
              {/* New version — only if current is accepted */}
              {drawerItem.active_status === "Accepted" && (
                <button
                  onClick={openNewVersionModal}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <PackagePlus size={15} /> Nueva versión
                </button>
              )}
              {/* Accept — only if draft or sent */}
              {(drawerItem.active_status === "Draft" ||
                drawerItem.active_status === "Sent") && (
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <CheckCircle size={15} /> Aceptar y enviar depósito
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── CREATE MODAL ──────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                Nuevo Presupuesto
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateModal();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <select
                  required
                  value={createForm.client}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, client: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `· ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title + type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título del proyecto
                  </label>
                  <input
                    required
                    type="text"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, title: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Boda en la finca, Rodaje exterior..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full p-2 border rounded-lg outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full p-2 border rounded-lg outline-none text-sm"
                  />
                </div>
              </div>

              {/* Line item builder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Servicios
                </label>
                <LineItemBuilder
                  catalogItems={catalogItems}
                  lineItems={createLineItems}
                  setLineItems={setCreateLineItems}
                  eventType={createForm.event_type}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas internas{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, notes: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Peticiones especiales, condiciones particulares..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 shrink-0">
              <button
                onClick={handleCreate}
                disabled={createSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {createSubmitting ? "Creando..." : "Generar Presupuesto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW VERSION MODAL ─────────────────────────────────────────────── */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Nueva versión
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {drawerItem?.title} · v
                  {(getActiveVersion(drawerItem)?.version_number || 0) + 1}
                </p>
              </div>
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                La versión actual ({drawerItem?.active_status}) quedará
                archivada. El cliente no recibe nuevo depósito — solo se
                recalcula el saldo pendiente.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Servicios
                </label>
                <LineItemBuilder
                  catalogItems={catalogItems}
                  lineItems={newVersionLineItems}
                  setLineItems={setNewVersionLineItems}
                  eventType={drawerItem?.event_type}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del cambio
                </label>
                <textarea
                  rows={2}
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder="El cliente añadió catering para 10 personas más..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 shrink-0">
              <button
                onClick={handleNewVersion}
                disabled={newVersionSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {newVersionSubmitting
                  ? "Creando versión..."
                  : "Crear nueva versión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
