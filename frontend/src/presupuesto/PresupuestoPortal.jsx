import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const PORTAL_BASE = "http://127.0.0.1:8000/api";

const STATUS = {
  LOADING: "loading",
  READY: "ready",
  WORKING: "working",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
  ERROR: "error",
};

export default function PresupuestoPortal() {
  const { token } = useParams();
  const [version, setVersion] = useState(null);
  const [uiStatus, setUiStatus] = useState(STATUS.LOADING);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

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

  const handleAction = async (action) => {
    if (uiStatus !== STATUS.READY) return;
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
        <div className="text-center py-16 text-gray-400 text-sm">
          Cargando presupuesto...
        </div>
      </Shell>
    );
  if (uiStatus === STATUS.EXPIRED)
    return (
      <Shell>
        <div className="text-center py-16 text-gray-400 text-sm">
          Este enlace ha expirado.
        </div>
      </Shell>
    );
  if (uiStatus === STATUS.ERROR)
    return (
      <Shell>
        <div className="text-center py-16 text-gray-400 text-sm">
          Algo ha ido mal. Contacta con nosotros.
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <span className="inline-block text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1 mb-3">
            Versión {version.version_number}
          </span>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {version.title}
          </h1>
          <p className="text-sm text-gray-400">
            Preparado para {version.client_name}
          </p>
        </div>

        {/* Rows */}
        <div className="px-6 divide-y divide-gray-50">
          <Row label="Cliente" value={version.client_name} />
          <Row label="Tipo de evento" value={version.event_type} />

          {version.is_date_tentative ? (
            <Row label="Fechas" value="Por determinar (Reserva tentativa)" />
          ) : (
            <>
              <Row label="Inicio" value={formatDate(version.event_start)} />
              <Row label="Fin" value={formatDate(version.event_end)} />
            </>
          )}

          {version.requires_security_deposit && (
            <Row
              label="Fianza Requerida"
              value={formatCurrency(version.security_deposit_amount)}
            />
          )}
        </div>

        {/* Total */}
        <div className="mx-6 py-5 border-t border-gray-200 flex justify-between items-baseline">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-3xl font-semibold text-gray-900">
            {formatCurrency(version.total_amount)}
          </span>
        </div>

        {/* Notes */}
        {version.notes && (
          <div className="mx-6 mb-5 px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-500 leading-relaxed">
            {version.notes}
          </div>
        )}

        {/* PDF viewer */}
        {pdfBlobUrl && (
          <div className="border-t border-gray-100">
            <div className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">Documento</span>
              <a
                href={pdfBlobUrl}
                download="presupuesto.pdf"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Descargar ↓
              </a>
            </div>
            <div
              className="mx-6 mb-5 rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
              style={{ height: "600px" }}
            >
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full"
                title="Presupuesto PDF"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {uiStatus === STATUS.ACCEPTED && (
          <div className="px-6 py-4 bg-green-50 border-t border-green-100 text-sm text-green-700 flex items-center gap-2 font-medium">
            ✓ Has aceptado este presupuesto. Recibirás una confirmación por
            email.
          </div>
        )}
        {uiStatus === STATUS.REJECTED && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-500 flex items-center gap-2">
            Has rechazado este presupuesto. Nos pondremos en contacto contigo.
          </div>
        )}
        {(uiStatus === STATUS.READY || uiStatus === STATUS.WORKING) && (
          <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => handleAction("accept")}
              disabled={uiStatus === STATUS.WORKING}
              className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 px-5 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {uiStatus === STATUS.WORKING
                ? "Procesando..."
                : "Aceptar presupuesto"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={uiStatus === STATUS.WORKING}
              className="text-sm text-gray-500 bg-white border border-gray-200 py-2.5 px-5 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <span className="text-xs font-medium text-gray-400 tracking-widest uppercase">
            MachotaCRM
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-3.5 gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">
        {value}
      </span>
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
