import React, { useState, useEffect } from "react";
import api from "../api";
import {
  Users,
  FileText,
  Euro,
  TrendingUp,
  TrendingDown,
  Calendar,
  Receipt,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart2,
  Activity,
  Layers,
  Bell,
  Star,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

// ─── helpers ─────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n,
  );

const fmtShort = (n) => {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n}`;
};

// Transalations
const statusBadge = {
  Draft: { bg: "bg-gray-100 text-gray-600", label: "Borrador" },
  Sent: { bg: "bg-blue-50 text-blue-700", label: "Enviado" },
  Accepted: { bg: "bg-emerald-50 text-emerald-700", label: "Aceptado" },
  Rejected: { bg: "bg-red-50 text-red-600", label: "Rechazado" },
  Archived: { bg: "bg-slate-100 text-slate-500", label: "Archivado" },
  Paid: { bg: "bg-emerald-50 text-emerald-700", label: "Pagada" },
  Unpaid: { bg: "bg-amber-50 text-amber-700", label: "Pendiente" },
  Overdue: { bg: "bg-red-50 text-red-600", label: "Vencida" },
};

const eventTypeBadge = {
  Rodajes: "bg-indigo-50 text-indigo-700",
  Alojamiento: "bg-emerald-50 text-emerald-700",
  AIRBNB: "bg-orange-50 text-orange-700",
  "Talleres y retiros": "bg-purple-50 text-purple-700",
  Celebraciones: "bg-pink-50 text-pink-700",
  Corporativo: "bg-blue-50 text-blue-700",
  "Catering & others": "bg-amber-50 text-amber-700",
};

const eventTypeColors = [
  "#4f46e5",
  "#059669",
  "#f97316",
  "#e11d48",
  "#0284c7",
  "#7c3aed",
  "#d97706",
];

const avatarColors = [
  ["bg-indigo-100 text-indigo-700"],
  ["bg-emerald-100 text-emerald-700"],
  ["bg-amber-100 text-amber-700"],
  ["bg-pink-100 text-pink-700"],
  ["bg-sky-100 text-sky-700"],
];

const initials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ─── Sub-components ────────────────────────────────────────────────────────

const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  deltaUp,
  deltaDown,
}) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
    <div
      className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 ${iconClass}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900 leading-tight">
      {value}
    </div>
    {deltaUp && (
      <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded-md">
        <TrendingUp size={12} /> {deltaUp}
      </div>
    )}
    {deltaDown && (
      <div className="flex items-center gap-1 mt-2 text-xs font-medium text-red-600 bg-red-50 w-max px-2 py-0.5 rounded-md">
        <TrendingDown size={12} /> {deltaDown}
      </div>
    )}
    {sub && !deltaUp && !deltaDown && (
      <div className="mt-2 text-xs font-medium text-gray-400">{sub}</div>
    )}
  </div>
);

const Badge = ({ status }) => {
  const config = statusBadge[status] || {
    bg: "bg-gray-100 text-gray-500",
    label: status,
  };
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg}`}
    >
      {config.label}
    </span>
  );
};

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
    <Icon size={14} />
    {children}
  </div>
);

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white border border-gray-200 shadow-sm rounded-2xl p-5 ${className}`}
  >
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState({
    clients: [],
    quotes: [],
    invoices: [],
    events: [],
    currentUser: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      // 1. Fetch main CRM data safely
      const [clientsRes, quotesRes, invoicesRes, eventsRes] = await Promise.all(
        [
          api.get("clients/"),
          api.get("presupuestos/"),
          api.get("invoices/"),
          api.get("events/"),
        ],
      );

      // 2. Fetch User Data separately to prevent crashes if the endpoint fails
      let userData = null;
      try {
        const userRes = await api.get("users/me/");
        userData = userRes.data;
      } catch (userErr) {
        console.warn("No se pudo cargar el perfil del usuario:", userErr);
      }

      // 3. Set state, handling paginated Django results if necessary
      setData({
        clients: Array.isArray(clientsRes.data)
          ? clientsRes.data
          : clientsRes.data?.results || [],
        quotes: Array.isArray(quotesRes.data)
          ? quotesRes.data
          : quotesRes.data?.results || [],
        invoices: Array.isArray(invoicesRes.data)
          ? invoicesRes.data
          : invoicesRes.data?.results || [],
        events: Array.isArray(eventsRes.data)
          ? eventsRes.data
          : eventsRes.data?.results || [],
        currentUser: userData,
      });
    } catch (err) {
      console.error("Error crítico cargando los datos del dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Data insight and transformations ────────────────────────────────────

  const { clients, quotes, invoices, events } = data;

  const totalClients = clients.length;
  const totalQuotes = quotes.length;

  // Filters (active_status)
  const draftQ = quotes.filter((q) => q.active_status === "Draft").length;
  const sentQ = quotes.filter((q) => q.active_status === "Sent").length;
  const acceptedQ = quotes.filter((q) => q.active_status === "Accepted").length;
  const rejectedQ = quotes.filter((q) => q.active_status === "Rejected").length;

  // Total Pipeline value ignoring archived or rejected
  const pipelineValue = quotes
    .filter((q) => ["Draft", "Sent", "Accepted"].includes(q.active_status))
    .reduce((s, q) => s + parseFloat(q.active_amount || 0), 0);

  // VTotal value of earnings
  const wonValue = quotes
    .filter((q) => q.active_status === "Accepted")
    .reduce((s, q) => s + parseFloat(q.active_amount || 0), 0);

  // (Win value / Accepted quotes)
  const avgTicketSize = acceptedQ > 0 ? wonValue / acceptedQ : 0;

  // Filters
  const paidInvoices = invoices.filter((i) => i.status === "Paid");
  const unpaidInvoices = invoices.filter((i) => i.status === "Unpaid");
  const overdueInvoices = invoices.filter((i) => i.status === "Overdue");

  const revenueCollected = paidInvoices.reduce(
    (s, i) => s + parseFloat(i.amount || 0),
    0,
  );
  const overdueValue = overdueInvoices.reduce(
    (s, i) => s + parseFloat(i.amount || 0),
    0,
  );
  const pendingValue = unpaidInvoices.reduce(
    (s, i) => s + parseFloat(i.amount || 0),
    0,
  );

  // Win Rate: Aceptados / (Aceptados + Rechazados)
  const resolvedQuotes = acceptedQ + rejectedQ;
  const winRate =
    resolvedQuotes > 0 ? Math.round((acceptedQ / resolvedQuotes) * 100) : 0;

  const eventTypeLabels = [
    "Corporativo",
    "Rodajes",
    "AIRBNB",
    "Celebraciones",
    "Alojamiento",
    "Talleres y retiros",
    "Catering & others",
  ];
  const eventTypeCounts = eventTypeLabels.map(
    (t) => events.filter((e) => e.event_type === t).length,
  );

  // Top clients by accepted value
  const clientValues = clients.map((c) => {
    const total = quotes
      .filter((q) => q.client_name === c.name && q.active_status === "Accepted")
      .reduce((s, q) => s + parseFloat(q.active_amount || 0), 0);
    const qCount = quotes.filter((q) => q.client_name === c.name).length;
    return { ...c, total, qCount };
  });
  clientValues.sort((a, b) => b.total - a.total);
  const topClients = clientValues.slice(0, 4);

  // Upcoming Events
  const upcomingEvents = [...events]
    .filter((e) => new Date(e.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);

  // Recent Quotes
  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4);

  // ── Graph Settings ─────────────────────────────────────────────

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    // capitalize first letter for spanish months
    const rawLabel = d.toLocaleString("es-ES", { month: "short" });
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    return { label, year: d.getFullYear(), month: d.getMonth() };
  });

  const invoicedByMonth = last6Months.map(({ year, month }) =>
    invoices
      .filter((inv) => {
        const d = new Date(inv.issue_date || inv.created_at);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, inv) => s + parseFloat(inv.amount || 0), 0),
  );

  const collectedByMonth = last6Months.map(({ year, month }) =>
    paidInvoices
      .filter((inv) => {
        const d = new Date(inv.issue_date || inv.created_at);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, inv) => s + parseFloat(inv.amount || 0), 0),
  );

  const revenueChartData = {
    labels: last6Months.map((m) => m.label),
    datasets: [
      {
        label: "Facturado",
        data: invoicedByMonth,
        backgroundColor: "#4f46e5",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
      {
        label: "Cobrado",
        data: collectedByMonth,
        backgroundColor: "#059669",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
    ],
  };

  const revenueChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => " " + fmt(ctx.raw) } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11, family: "Inter" } },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.05)" },
        border: { display: false },
        ticks: {
          color: "#94a3b8",
          font: { size: 11, family: "Inter" },
          callback: (v) => fmtShort(v),
        },
      },
    },
  };

  const donutData = {
    labels: eventTypeLabels,
    datasets: [
      {
        data: eventTypeCounts,
        backgroundColor: eventTypeColors,
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 4,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
    },
  };

  // ── Empty View ───────────────────────────────────────────────────────────

  if (!loading && totalClients === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
        <header className="h-16 bg-white border-b flex items-center px-8 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            Resumen de Negocio
          </h2>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="bg-white p-10 rounded-3xl border border-dashed border-gray-300 text-center max-w-sm shadow-sm">
            <Activity className="mx-auto text-blue-300 mb-5" size={56} />
            <h3 className="text-xl font-bold text-gray-800">
              Tu CRM está vacío
            </h3>
            <p className="text-gray-500 mt-2 text-sm">
              Dirígete a la pestaña de Clientes para comenzar a construir tu
              base de datos y registrar ventas.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Main View ─────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">
            Métricas y Rendimiento
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {data.currentUser?.username && (
            <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              Hola, {data.currentUser.username}
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-full text-blue-500 font-semibold animate-pulse text-sm">
            Procesando contabilidad...
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Smart Alerts */}
            {(sentQ > 0 || overdueInvoices.length > 0) && (
              <div className="flex flex-wrap gap-4 mb-4">
                {overdueInvoices.length > 0 && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-800 px-4 py-3 rounded-xl flex-1 shadow-sm">
                    <AlertTriangle size={18} className="text-red-500" />
                    <div>
                      <p className="text-sm font-bold">
                        Atención: Facturas Vencidas
                      </p>
                      <p className="text-xs text-red-600/80">
                        Tienes {overdueInvoices.length} facturas que suman{" "}
                        {fmt(overdueValue)} pendientes de cobro fuera de plazo.
                      </p>
                    </div>
                  </div>
                )}
                {sentQ > 0 && (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl flex-1 shadow-sm">
                    <Bell size={18} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-bold">Seguimiento Comercial</p>
                      <p className="text-xs text-blue-600/80">
                        Hay {sentQ} propuestas enrutadas esperando confirmación
                        del cliente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Valor en Pipeline"
                value={fmt(pipelineValue)}
                icon={TrendingUp}
                iconClass="text-blue-500"
                deltaUp={winRate > 0 ? `${winRate}% tasa de cierre real` : null}
              />
              <KpiCard
                label="Ingresos Cobrados"
                value={fmt(revenueCollected)}
                icon={Euro}
                iconClass="text-emerald-500"
                deltaDown={
                  pendingValue > 0 ? `${fmt(pendingValue)} en espera` : null
                }
              />
              <KpiCard
                label="Ticket Promedio"
                value={fmt(avgTicketSize)}
                icon={Star}
                iconClass="text-amber-500"
                sub="Por evento confirmado"
              />
              <KpiCard
                label="Total Presupuestos"
                value={totalQuotes}
                icon={FileText}
                iconClass="text-purple-500"
                sub={`${sentQ + draftQ} en curso · ${resolvedQuotes} cerrados`}
              />
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle icon={BarChart2}>
                    Flujo de Caja (Últimos 6 meses)
                  </SectionTitle>
                  <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block"></span>
                      Facturado
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span>
                      Cobrado
                    </span>
                  </div>
                </div>
                <div className="h-56">
                  <Bar data={revenueChartData} options={revenueChartOptions} />
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Layers}>
                  Distribución de Eventos
                </SectionTitle>
                <div className="h-36 mb-4">
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
                <div className="flex flex-col gap-2">
                  {eventTypeLabels.map((label, i) =>
                    eventTypeCounts[i] > 0 ? (
                      <div
                        key={label}
                        className="flex items-center justify-between text-xs font-medium"
                      >
                        <span className="flex items-center gap-2 text-gray-700">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                            style={{ background: eventTypeColors[i] }}
                          ></span>
                          {label}
                        </span>
                        <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {eventTypeCounts[i]}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              </Card>
            </div>

            {/* Commercial and Invoice State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card>
                <SectionTitle icon={Activity}>Embudo Comercial</SectionTitle>
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Borrador", count: draftQ, bar: "bg-gray-200" },
                    { label: "Enviados", count: sentQ, bar: "bg-blue-400" },
                    {
                      label: "Ganados",
                      count: acceptedQ,
                      bar: "bg-emerald-400",
                    },
                    { label: "Perdidos", count: rejectedQ, bar: "bg-red-300" },
                  ].map(({ label, count, bar }) => (
                    <div
                      key={label}
                      className="text-center bg-gray-50 p-2 rounded-lg border border-gray-100"
                    >
                      <div className="text-xl font-black text-gray-900">
                        {count}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                        {label}
                      </div>
                      <div
                        className={`h-1.5 rounded-full mt-2 w-full ${bar}`}
                      ></div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Receipt}>Salud de Facturación</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center">
                    <Clock size={16} className="text-amber-500 mx-auto mb-2" />
                    <div className="text-xl font-bold text-gray-900">
                      {unpaidInvoices.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mt-1">
                      Pendientes
                    </div>
                    <div className="text-xs font-semibold text-amber-500 mt-1">
                      {fmt(pendingValue)}
                    </div>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center">
                    <CheckCircle
                      size={16}
                      className="text-emerald-500 mx-auto mb-2"
                    />
                    <div className="text-xl font-bold text-gray-900">
                      {paidInvoices.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">
                      Saldadas
                    </div>
                    <div className="text-xs font-semibold text-emerald-500 mt-1">
                      {fmt(revenueCollected)}
                    </div>
                  </div>
                  <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-center">
                    <AlertTriangle
                      size={16}
                      className="text-red-400 mx-auto mb-2"
                    />
                    <div className="text-xl font-bold text-gray-900">
                      {overdueInvoices.length}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 mt-1">
                      Vencidas
                    </div>
                    <div className="text-xs font-semibold text-red-400 mt-1">
                      {fmt(overdueValue)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Final Data Listings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card>
                <SectionTitle icon={Users}>
                  Top Clientes (Por Volumen Aceptado)
                </SectionTitle>
                <div className="space-y-2.5 mt-2">
                  {topClients.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      No hay datos suficientes.
                    </p>
                  )}
                  {topClients.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 bg-white border border-gray-100 hover:border-gray-200 shadow-sm rounded-xl px-4 py-3 transition-colors"
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColors[i % avatarColors.length][0]}`}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800">
                          {c.name}
                        </div>
                        <div className="text-[11px] font-medium text-gray-400 truncate mt-0.5">
                          {c.qCount} proyecto{c.qCount !== 1 ? "s" : ""}{" "}
                          gestionados
                        </div>
                      </div>
                      <div className="text-sm font-black text-gray-700 shrink-0">
                        {fmt(c.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={FileText}>
                  Actividad Comercial Reciente
                </SectionTitle>
                <div className="space-y-2.5 mt-2">
                  {recentQuotes.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      No hay presupuestos recientes.
                    </p>
                  )}
                  {recentQuotes.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-3"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="text-sm font-bold text-gray-800 truncate">
                          {q.title}
                        </div>
                        <div className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {q.client_name} · {q.event_type}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <span className="text-sm font-black text-gray-900">
                          {fmt(q.active_amount)}
                        </span>
                        <Badge status={q.active_status} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
