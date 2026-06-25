import React, { useState, useEffect } from "react";
import api from "../api";
import {
  Receipt,
  CheckCircle,
  Clock,
  Download,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";

export default function InvoicesPage({ onInvoiceStatusChange }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (drawerItem) {
      requestAnimationFrame(() => setDrawerVisible(true));
    } else {
      setDrawerVisible(false);
    }
  }, [drawerItem]);

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => setDrawerItem(null), 300);
  };

  const fetchInvoices = async () => {
    try {
      const response = await api.get("invoices/");
      setInvoices(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching ledger invoices dataset:", error);
      setLoading(false);
    }
  };

  const markAsPaid = async (id) => {
    try {
      const response = await api.post(`invoices/${id}/mark_paid/`);

      // Update local item row trace state variables
      setInvoices(invoices.map((inv) => (inv.id === id ? response.data : inv)));

      if (drawerItem && drawerItem.id === id) {
        setDrawerItem(response.data);
      }

      // Execute global structural update loop callback across the App router
      if (typeof onInvoiceStatusChange === "function") {
        onInvoiceStatusChange();
      }
    } catch (error) {
      alert("Error updating invoice status inside backend repository.");
    }
  };

  const handleDownloadPDF = (pdfUrl, fileName) => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.setAttribute("download", fileName || "Document.pdf");
    link.setAttribute("target", "_blank");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const statusStyle = (status) => {
    if (status === "Paid") return "bg-green-100 text-green-800";
    if (status === "Overdue") return "bg-red-100 text-red-800";
    return "bg-amber-100 text-amber-800";
  };

  const StatusIcon = ({ status }) => {
    if (status === "Paid") return <CheckCircle size={14} />;
    if (status === "Overdue") return <AlertCircle size={14} />;
    return <Clock size={14} />;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 h-screen">
      <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">Facturas</h2>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-gray-400">
              Loading database...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Invoice / Source
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Timeline
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 flex items-center space-x-2">
                        <Receipt size={16} className="text-gray-400" />
                        <span>{inv.invoice_number}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        From: {inv.presupuesto_title || "Manual Entry"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {inv.client_name}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {inv.amount}€
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        Issued: {inv.issue_date}
                      </div>
                      <div className="text-xs text-red-500 font-medium mt-1">
                        Due: {inv.due_date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full flex w-max items-center space-x-1 ${statusStyle(inv.status)}`}
                      >
                        <StatusIcon status={inv.status} />
                        <span>{inv.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setDrawerItem(inv)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() =>
                          handleDownloadPDF(
                            inv.pdf_file,
                            `${inv.invoice_number}.pdf`,
                          )
                        }
                        className="p-2 text-gray-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition"
                        title="Quick Download"
                      >
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

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
                <h3 className="text-base font-semibold text-gray-800">
                  {drawerItem.invoice_number}
                </h3>
                <p className="text-xs text-gray-400">
                  {drawerItem.client_name}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Current Status</p>
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-1.5 w-max ${statusStyle(drawerItem.status)}`}
                  >
                    <StatusIcon status={drawerItem.status} />
                    {drawerItem.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Amount Due</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {drawerItem.amount}€
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">Issued</div>
                  <p className="text-sm font-medium text-gray-700">
                    {drawerItem.issue_date}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">Due date</div>
                  <p className="text-sm font-medium text-red-500">
                    {drawerItem.due_date}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                  <div className="text-xs text-gray-400 mb-1">Source quote</div>
                  <p className="text-sm text-gray-700">
                    {drawerItem.presupuesto_title || "Manual Entry"}
                  </p>
                </div>
              </div>

              {drawerItem.pdf_file && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Immutable PDF Storage Asset Preview
                  </p>
                  <div className="w-full h-[768px] bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    <iframe
                      src={`${drawerItem.pdf_file}?t=${new Date().getTime()}`}
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                Close
              </button>
              <button
                onClick={() =>
                  handleDownloadPDF(
                    drawerItem.pdf_file,
                    `${drawerItem.invoice_number}.pdf`,
                  )
                }
                className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
              >
                <Download size={15} /> Download PDF
              </button>
              {drawerItem.status !== "Paid" && (
                <button
                  onClick={() => markAsPaid(drawerItem.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <CheckCircle size={15} /> Mark as Paid
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
