import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "../api";

export default function ClientModal({
  isOpen,
  onClose,
  onSuccess,
  clientToEdit = null,
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        name: clientToEdit.name || "",
        email: clientToEdit.email || "",
        company: clientToEdit.company || "",
        phone: clientToEdit.phone || "",
      });
    } else {
      setFormData({ name: "", email: "", company: "", phone: "" });
    }
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (clientToEdit) {
        const response = await api.put(`clients/${clientToEdit.id}/`, formData);
        onSuccess(response.data, true); // true indicates it was an edit
      } else {
        const response = await api.post("clients/", formData);
        onSuccess(response.data, false); // false indicates new creation
      }
      onClose();
    } catch (error) {
      alert("Error guardando cliente. Asegúrate de que el email sea único.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {clientToEdit ? "Editar Cliente" : "Añadir Nuevo Cliente"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo
            </label>
            <input
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              required
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compañía
            </label>
            <input
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Teléfono
            </label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting
                ? "Guardando..."
                : clientToEdit
                  ? "Guardar Cambios"
                  : "Crear Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
