import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Euro,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  Building2,
  Shield,
  FileText,
  Clock,
  ArrowLeft,
} from "lucide-react";

const PORTAL_BASE = "http://127.0.0.1:8000/api";

const STATUS = {
  LOADING: "loading",
  READY: "ready",
  TERMS: "terms",
  WORKING: "working",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
  ERROR: "error",
};

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

export default function PresupuestoPortal() {
  const { token } = useParams();
  const [version, setVersion] = useState(null);
  const [uiStatus, setUiStatus] = useState(STATUS.LOADING);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  // Terms & Conditions States
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [confirmedTerms, setConfirmedTerms] = useState(false);
  const termsScrollRef = useRef(null);

  // Fetch version data
  useEffect(() => {
    fetch(`${PORTAL_BASE}/portal/presupuesto/${token}/`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 410) {
          setUiStatus(STATUS.EXPIRED);
          return null;
        }
        if (!res.ok) {
          setUiStatus(STATUS.ERROR);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setVersion(data);
        if (data.status === "Accepted") setUiStatus(STATUS.ACCEPTED);
        else if (data.status === "Rejected") setUiStatus(STATUS.REJECTED);
        else setUiStatus(STATUS.READY);
      })
      .catch((err) => {
        console.error("Error fetching portal data:", err);
        setUiStatus(STATUS.ERROR);
      });
  }, [token]);

  // Fetch PDF as blob once version is loaded
  useEffect(() => {
    if (!token) return;
    fetch(`${PORTAL_BASE}/portal/presupuesto/${token}/pdf/`, {
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) return null;
        return r.blob();
      })
      .then((blob) => {
        if (blob) setPdfBlobUrl(URL.createObjectURL(blob));
      })
      .catch((err) => console.error("Error fetching PDF:", err));
  }, [token]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const handleScrollTerms = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // 15px tolerance margin for cross-browser rendering accuracy
    if (scrollTop + clientHeight >= scrollHeight - 15) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAction = async (action) => {
    setUiStatus(STATUS.WORKING);

    try {
      const res = await fetch(
        `${PORTAL_BASE}/portal/presupuesto/${token}/${action}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      if (res.ok) {
        setUiStatus(action === "accept" ? STATUS.ACCEPTED : STATUS.REJECTED);
      } else {
        const errorText = await res.text();
        console.error(`Backend returned ${res.status}:`, errorText);
        setUiStatus(STATUS.ERROR);
      }
    } catch (err) {
      console.error("Network or fetch error during action:", err);
      setUiStatus(STATUS.ERROR);
    }
  };

  if (uiStatus === STATUS.LOADING)
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-20 text-center text-gray-400 animate-pulse text-sm">
          Cargando presupuesto...
        </div>
      </Shell>
    );
  if (uiStatus === STATUS.EXPIRED)
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-20 text-center text-gray-500 text-sm">
          Este enlace ha expirado.
        </div>
      </Shell>
    );
  if (uiStatus === STATUS.ERROR)
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-20 text-center text-red-500 text-sm font-medium">
          Algo ha ido mal. Contacta con nosotros.
        </div>
      </Shell>
    );

  // TERMS & CONDITIONS VIEW LAYER
  if (uiStatus === STATUS.TERMS)
    return (
      <Shell>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden p-8 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Términos y Condiciones de Contratación
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Por favor, lea atentamente los términos antes de confirmar su
                aceptación.
              </p>
            </div>
            <button
              onClick={() => setUiStatus(STATUS.READY)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={14} /> Volver
            </button>
          </div>

          {/* Scrollable Terms Box */}
          <div
            ref={termsScrollRef}
            onScroll={handleScrollTerms}
            className="h-64 overflow-y-auto border border-gray-200 rounded-xl p-5 bg-gray-50 text-xs text-gray-600 leading-relaxed space-y-4 shadow-inner"
          >
            <p className="font-bold text-gray-800">
              1. Objeto del Servicio y Alcance
            </p>
            <p>
              Las presentes condiciones generales regulan la contratación de los
              servicios detallados en el presupuesto asociado a este documento.
              La aceptación del presente presupuesto implica la conformidad
              plena y sin reservas por parte del cliente con cada uno de los
              términos aquí expuestos.
            </p>

            <p className="font-bold text-gray-800">
              2. Condiciones de Pago y Depósitos
            </p>
            <p>
              Para la reserva efectiva de las fechas y servicios indicados, se
              podrá requerir el abono de un depósito inicial o fianza según lo
              especificado en la propuesta comercial. El importe restante deberá
              liquidarse en los plazos acordados previamente a la ejecución del
              evento o servicio prestado.
            </p>

            <p className="font-bold text-gray-800">
              3. Política de Cancelaciones y Modificaciones
            </p>
            <p>
              Cualquier modificación o cancelación sobre las fechas establecidas
              o sobre los servicios contratados deberá notificarse por escrito
              con la debida antelación. Las cancelaciones efectuadas fuera de
              los plazos establecidos en la normativa interna del prestador
              podrán conllevar la retención parcial o total de los depósitos
              entregados en concepto de daños y perjuicios operativos.
            </p>

            <p className="font-bold text-gray-800">
              4. Responsabilidades y Seguros
            </p>
            <p>
              El cliente será responsable del buen uso de las instalaciones,
              equipos o espacios provistos durante el evento o estancia. En caso
              de requerirse fianza por daños, esta será reembolsada una vez
              verificado el estado óptimo de los elementos tras la finalización
              del servicio.
            </p>

            <p className="font-bold text-gray-800">
              5. Protección de Datos (RGPD)
            </p>
            <p>
              De conformidad con la normativa vigente en materia de protección
              de datos de carácter personal, le informamos que los datos
              facilitados serán tratados con la finalidad de gestionar la
              relación contractual y el mantenimiento de históricos de
              facturación y servicios.
            </p>

            <p className="font-medium text-blue-600 pt-2">
              --- Has llegado al final de los términos y condiciones ---
            </p>
          </div>

          {!hasScrolledToBottom && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-medium text-center animate-pulse">
              Desplaza la barra de texto hasta el final para habilitar la
              casilla de confirmación.
            </div>
          )}

          <div className="space-y-4 pt-2 border-t">
            <label
              className={`flex items-start gap-3 select-none ${!hasScrolledToBottom ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                disabled={!hasScrolledToBottom}
                checked={confirmedTerms}
                onChange={(e) => setConfirmedTerms(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-gray-700 leading-normal">
                Confirmo que he leído, comprendido y acepto los términos y
                condiciones de contratación, así como la política de pagos y
                cancelaciones asociada.
              </span>
            </label>

            <button
              onClick={() => handleAction("accept")}
              disabled={!confirmedTerms || uiStatus === STATUS.WORKING}
              className="w-full bg-blue-600 text-white text-sm font-bold py-3.5 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              {uiStatus === STATUS.WORKING ? (
                "Procesando aceptación..."
              ) : (
                <>
                  <CheckCircle size={18} /> Confirmar y Aceptar Presupuesto
                </>
              )}
            </button>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-md px-2.5 py-1 shadow-sm">
                Versión {version.version_number}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getBadgeStyle(version.event_type)}`}
              >
                {version.event_type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {version.title}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
              <Building2 size={15} className="text-gray-400" /> Preparado para{" "}
              <strong className="text-gray-700">{version.client_name}</strong>
            </p>
          </div>
        </div>

        {/* Project Meta Information Cards */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200 text-blue-600 shadow-sm shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Fechas del Evento
                </p>
                {version.is_date_tentative ? (
                  <p className="text-sm font-bold text-amber-700 flex items-center gap-1">
                    <Clock size={14} /> Por determinar (Reserva tentativa)
                  </p>
                ) : (
                  <div className="text-xs font-semibold text-gray-800 space-y-0.5">
                    <p>Inicio: {formatDate(version.event_start)}</p>
                    <p>Fin: {formatDate(version.event_end)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200 text-blue-600 shadow-sm shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Condiciones de Seguridad
                </p>
                {version.requires_security_deposit ? (
                  <p className="text-sm font-bold text-gray-800">
                    Fianza requerida:{" "}
                    <span className="text-amber-600">
                      {formatCurrency(version.security_deposit_amount)}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-medium text-gray-600">
                    Sin fianza requerida
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Dark Total Banner matching CRM style */}
          <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-inner border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Euro size={14} /> Importe Total de la Propuesta
              </p>
              <p className="text-xs text-slate-400">
                Impuestos incluidos según desglose en PDF
              </p>
            </div>
            <div className="text-3xl font-black text-slate-100">
              {formatCurrency(version.total_amount)}
            </div>
          </div>

          {/* Notes */}
          {version.notes && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 leading-relaxed">
              <span className="font-bold block mb-1 text-xs uppercase tracking-wide text-blue-600">
                Observaciones
              </span>
              {version.notes}
            </div>
          )}

          {/* PDF viewer */}
          {pdfBlobUrl && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-gray-50">
              <div className="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={15} /> Documento del Presupuesto (Snapshot)
                </span>
                <a
                  href={pdfBlobUrl}
                  download="presupuesto.pdf"
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors border"
                >
                  <Download size={14} /> Descargar PDF
                </a>
              </div>
              <div className="w-full bg-gray-100" style={{ height: "600px" }}>
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0"
                  title="Presupuesto PDF"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions & Status Footers */}
        {uiStatus === STATUS.ACCEPTED && (
          <div className="px-8 py-5 bg-green-50 border-t border-green-100 text-sm text-green-800 flex items-center gap-3 font-semibold">
            <CheckCircle size={20} className="text-green-600 shrink-0" />
            Has aceptado este presupuesto. Recibirás una confirmación por email
            con los siguientes pasos.
          </div>
        )}
        {uiStatus === STATUS.REJECTED && (
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 flex items-center gap-3 font-medium">
            <XCircle size={20} className="text-gray-400 shrink-0" />
            Has rechazado este presupuesto. Nos pondremos en contacto contigo si
            necesitas alternativas.
          </div>
        )}
        {uiStatus === STATUS.READY && (
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex gap-4 items-center justify-end">
            <button
              onClick={() => handleAction("reject")}
              className="text-sm font-bold text-gray-600 bg-white border border-gray-300 py-3 px-6 rounded-xl hover:bg-gray-100 transition-all shadow-sm"
            >
              Rechazar Propuesta
            </button>
            <button
              onClick={() => setUiStatus(STATUS.TERMS)}
              className="bg-blue-600 text-white text-sm font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <CheckCircle size={18} /> Aceptar Presupuesto
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span className="text-xs font-extrabold text-gray-500 tracking-widest uppercase">
            MachotaCRM Portal del Cliente
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
