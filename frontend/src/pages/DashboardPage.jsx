import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
  Users, FileText, Euro, TrendingUp, TrendingDown,
  Calendar, Receipt, AlertTriangle, CheckCircle, Clock,
  BarChart2, Activity, Layers, ChevronRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const fmtShort = (n) => {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n}`;
};

const statusBadge = {
  Draft:    'bg-gray-100 text-gray-600',
  Sent:     'bg-blue-50 text-blue-700',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-600',
  Paid:     'bg-emerald-50 text-emerald-700',
  Unpaid:   'bg-amber-50 text-amber-700',
  Overdue:  'bg-red-50 text-red-600',
};

const eventTypeBadge = {
  Rodajes:              'bg-indigo-50 text-indigo-700',
  Alojamiento:          'bg-emerald-50 text-emerald-700',
  AIRBNB:               'bg-orange-50 text-orange-700',
  'Talleres y retiros': 'bg-purple-50 text-purple-700',
  Celebraciones:        'bg-pink-50 text-pink-700',
  Corporativo:          'bg-blue-50 text-blue-700',
  'Catering & others':  'bg-amber-50 text-amber-700',
};

const eventTypeColors = [
  '#4f46e5','#059669','#f97316','#e11d48','#0284c7','#7c3aed','#d97706',
];

const avatarColors = [
  ['bg-indigo-100 text-indigo-700'],
  ['bg-emerald-100 text-emerald-700'],
  ['bg-amber-100 text-amber-700'],
  ['bg-pink-100 text-pink-700'],
  ['bg-sky-100 text-sky-700'],
];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// ─── sub-components ─────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, icon: Icon, iconClass, deltaUp, deltaDown }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200">
    <div className={`flex items-center gap-1.5 text-xs text-gray-500 mb-1 ${iconClass}`}>
      <Icon size={13} />
      <span>{label}</span>
    </div>
    <div className="text-2xl font-semibold text-gray-900 leading-tight">{value}</div>
    {deltaUp && (
      <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
        <TrendingUp size={11} /> {deltaUp}
      </div>
    )}
    {deltaDown && (
      <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
        <AlertTriangle size={11} /> {deltaDown}
      </div>
    )}
    {sub && !deltaUp && !deltaDown && (
      <div className="mt-1 text-xs text-gray-400">{sub}</div>
    )}
  </div>
);

const Badge = ({ label, className }) => (
  <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${className}`}>
    {label}
  </span>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
    <Icon size={13} />
    {children}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-2xl p-5 ${className}`}>
    {children}
  </div>
);

// ─── main component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState({
    clients: [],
    quotes: [],
    invoices: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [clientsRes, quotesRes, invoicesRes, eventsRes] = await Promise.all([
        api.get('clients/'),
        api.get('presupuestos/'),
        api.get('invoices/'),
        api.get('events/'),
      ]);
      setData({
        clients:  clientsRes.data,
        quotes:   quotesRes.data,
        invoices: invoicesRes.data,
        events:   eventsRes.data,
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── derived stats ──────────────────────────────────────────────────────────

  const { clients, quotes, invoices, events } = data;

  const totalClients    = clients.length;
  const totalQuotes     = quotes.length;
  const pipelineValue   = quotes.reduce((s, q) => s + parseFloat(q.amount || 0), 0);

  const paidInvoices    = invoices.filter((i) => i.status === 'Paid');
  const unpaidInvoices  = invoices.filter((i) => i.status === 'Unpaid');
  const overdueInvoices = invoices.filter((i) => i.status === 'Overdue');
  const revenueCollected = paidInvoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const overdueValue     = overdueInvoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  const draftQ    = quotes.filter((q) => q.status === 'Draft').length;
  const sentQ     = quotes.filter((q) => q.status === 'Sent').length;
  const acceptedQ = quotes.filter((q) => q.status === 'Accepted').length;
  const rejectedQ = quotes.filter((q) => q.status === 'Rejected').length;
  const invoicedQ = invoices.length;

  // funnel — relative to total quotes
  const funnelPct = (n) => (totalQuotes > 0 ? Math.round((n / totalQuotes) * 100) : 0);

  // event type breakdown for doughnut
  const eventTypeLabels = [
    'Corporativo','Rodajes','AIRBNB','Celebraciones',
    'Alojamiento','Talleres y retiros','Catering & others',
  ];
  const eventTypeCounts = eventTypeLabels.map(
    (t) => events.filter((e) => e.event_type === t).length,
  );

  // top clients by total quote value
  const clientValues = clients.map((c) => {
    const total = quotes
      .filter((q) => q.client === c.id)
      .reduce((s, q) => s + parseFloat(q.amount || 0), 0);
    const qCount = quotes.filter((q) => q.client === c.id).length;
    const iCount = invoices.filter((i) => i.client === c.id).length;
    return { ...c, total, qCount, iCount };
  });
  clientValues.sort((a, b) => b.total - a.total);
  const topClients = clientValues.slice(0, 4);

  // upcoming events — sorted by start_time
  const upcomingEvents = [...events]
    .filter((e) => new Date(e.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);

  // recent quotes
  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  // recent invoices
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  // ── chart configs ──────────────────────────────────────────────────────────

  // Revenue bar chart — last 6 months using invoices
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
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
        label: 'Invoiced',
        data: invoicedByMonth,
        backgroundColor: '#4f46e5',
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
      {
        label: 'Collected',
        data: collectedByMonth,
        backgroundColor: '#059669',
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
      tooltip: { callbacks: { label: (ctx) => ' ' + fmt(ctx.raw) } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        border: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => fmtShort(v) },
      },
    },
  };

  const donutData = {
    labels: eventTypeLabels,
    datasets: [{
      data: eventTypeCounts,
      backgroundColor: eventTypeColors,
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 4,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
    },
  };

  // ── empty state ────────────────────────────────────────────────────────────

  if (!loading && totalClients === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
        <header className="h-16 bg-white border-b flex items-center px-8 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Business Overview</h2>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-300 text-center max-w-sm">
            <TrendingUp className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-700">Your CRM is empty</h3>
            <p className="text-gray-500 mt-2 text-sm">Head over to the Clients tab to start building your database.</p>
          </div>
        </main>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">

      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Business Overview</h2>
        </div>
        <span className="text-xs text-gray-400">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 animate-pulse text-sm">
            Calculating metrics…
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-5">

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Total clients"
                value={totalClients}
                icon={Users}
                iconClass="text-indigo-500"
                deltaUp={`${clients.filter(c => {
                  const d = new Date(c.created_at);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length} this month`}
              />
              <KpiCard
                label="Total quotes"
                value={totalQuotes}
                icon={FileText}
                iconClass="text-violet-500"
                sub={`${sentQ + draftQ} active · ${acceptedQ + rejectedQ} closed`}
              />
              <KpiCard
                label="Pipeline value"
                value={fmt(pipelineValue)}
                icon={TrendingUp}
                iconClass="text-emerald-500"
                deltaUp={totalQuotes > 0 ? `${Math.round((acceptedQ / totalQuotes) * 100)}% acceptance rate` : null}
              />
              <KpiCard
                label="Revenue collected"
                value={fmt(revenueCollected)}
                icon={Euro}
                iconClass="text-sky-500"
                deltaDown={overdueValue > 0 ? `${fmt(overdueValue)} overdue` : null}
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Revenue bar chart — spans 2 cols */}
              <Card className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <SectionTitle icon={BarChart2}>Revenue — last 6 months</SectionTitle>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span>Invoiced</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"></span>Collected</span>
                  </div>
                </div>
                <div className="h-48">
                  <Bar data={revenueChartData} options={revenueChartOptions} />
                </div>
              </Card>

              {/* Donut chart */}
              <Card>
                <SectionTitle icon={Layers}>Events by type</SectionTitle>
                <div className="h-32">
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  {eventTypeLabels.map((label, i) =>
                    eventTypeCounts[i] > 0 ? (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: eventTypeColors[i] }}></span>
                          {label}
                        </span>
                        <span className="text-gray-400">{eventTypeCounts[i]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </Card>
            </div>

            {/* Pipeline + Invoice status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Quote pipeline */}
              <Card>
                <SectionTitle icon={Activity}>Quote pipeline</SectionTitle>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Draft',    count: draftQ,    bar: 'bg-gray-200' },
                    { label: 'Sent',     count: sentQ,     bar: 'bg-blue-300' },
                    { label: 'Accepted', count: acceptedQ, bar: 'bg-emerald-400' },
                    { label: 'Rejected', count: rejectedQ, bar: 'bg-red-300' },
                  ].map(({ label, count, bar }) => (
                    <div key={label} className="text-center">
                      <div className="text-xl font-semibold text-gray-900">{count}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                      <div className={`h-1 rounded-full mt-1.5 ${bar}`}></div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Conversion funnel</div>
                  {[
                    { label: 'Created',  n: totalQuotes },
                    { label: 'Sent',     n: totalQuotes - draftQ },
                    { label: 'Accepted', n: acceptedQ },
                    { label: 'Invoiced', n: invoicedQ },
                  ].map(({ label, n }) => (
                    <div key={label} className="flex items-center gap-3 mb-2">
                      <div className="text-xs text-gray-400 w-16 shrink-0">{label}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-400"
                          style={{ width: `${funnelPct(n)}%`, opacity: 0.5 + funnelPct(n) / 200 }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 w-5 text-right">{n}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Invoice health */}
              <Card>
                <SectionTitle icon={Receipt}>Invoice status</SectionTitle>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <Clock size={14} className="text-amber-500 mx-auto mb-1" />
                    <div className="text-lg font-semibold text-gray-900">{unpaidInvoices.length}</div>
                    <div className="text-xs text-amber-600 mt-0.5">Unpaid</div>
                    <div className="text-xs text-amber-500 mt-0.5">{fmt(unpaidInvoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0))}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <CheckCircle size={14} className="text-emerald-500 mx-auto mb-1" />
                    <div className="text-lg font-semibold text-gray-900">{paidInvoices.length}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Paid</div>
                    <div className="text-xs text-emerald-500 mt-0.5">{fmt(revenueCollected)}</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <AlertTriangle size={14} className="text-red-400 mx-auto mb-1" />
                    <div className="text-lg font-semibold text-gray-900">{overdueInvoices.length}</div>
                    <div className="text-xs text-red-500 mt-0.5">Overdue</div>
                    <div className="text-xs text-red-400 mt-0.5">{fmt(overdueValue)}</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent invoices</div>
                  <div className="space-y-2">
                    {recentInvoices.length === 0 && (
                      <p className="text-xs text-gray-400">No invoices yet.</p>
                    )}
                    {recentInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <div>
                          <div className="text-xs font-medium text-gray-800">{inv.invoice_number}</div>
                          <div className="text-[11px] text-gray-400">{inv.client_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-800">{fmt(inv.amount)}</div>
                          <div className="text-[11px] text-gray-400">
                            {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                          </div>
                        </div>
                        <div className="ml-3">
                          <Badge label={inv.status} className={statusBadge[inv.status] || 'bg-gray-100 text-gray-500'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent quotes + Upcoming events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Card>
                <SectionTitle icon={FileText}>Recent quotes</SectionTitle>
                <div className="space-y-2">
                  {recentQuotes.length === 0 && <p className="text-xs text-gray-400">No quotes yet.</p>}
                  {recentQuotes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-800 truncate">{q.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {q.event_type}
                          {q.event_start && ` · ${new Date(q.event_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="text-xs font-medium text-gray-800">{fmt(q.amount)}</span>
                        <Badge label={q.status} className={statusBadge[q.status] || 'bg-gray-100 text-gray-500'} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Calendar}>Upcoming events</SectionTitle>
                <div className="space-y-2">
                  {upcomingEvents.length === 0 && <p className="text-xs text-gray-400">No upcoming events.</p>}
                  {upcomingEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: eventTypeColors[eventTypeLabels.indexOf(ev.event_type)] || '#94a3b8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{ev.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {ev.start_time && new Date(ev.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <Badge
                        label={ev.event_type}
                        className={eventTypeBadge[ev.event_type] || 'bg-gray-100 text-gray-500'}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Top clients */}
            <Card>
              <SectionTitle icon={Users}>Top clients by value</SectionTitle>
              <div className="space-y-2">
                {topClients.length === 0 && <p className="text-xs text-gray-400">No clients yet.</p>}
                {topClients.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${(avatarColors[i % avatarColors.length])[0]}`}>
                      {initials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800">{c.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {c.company && `${c.company} · `}{c.qCount} quote{c.qCount !== 1 ? 's' : ''} · {c.iCount} invoice{c.iCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-gray-700 shrink-0">{fmt(c.total)}</div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        )}
      </main>
    </div>
  );
}