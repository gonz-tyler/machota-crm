import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, LayoutDashboard, Settings, Calendar as CalendarIcon, FileText, Receipt, Lock } from 'lucide-react';

export default function Sidebar() {
  const navLinkClass = ({ isActive }) =>
    `flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
      isActive ? 'bg-blue-600 shadow-lg shadow-blue-900/20 text-white' : 'hover:bg-slate-800 text-gray-400'
    }`;

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0 h-screen">
      <div className="p-6 text-2xl font-bold border-b border-slate-800 tracking-tight">Machota CRM</div>
      <nav className="flex-1 p-4 space-y-2 flex flex-col">
        <NavLink to="/dashboard" className={navLinkClass}><LayoutDashboard size={20} /><span>Panel de Control</span></NavLink>
        <NavLink to="/clients" className={navLinkClass}><Users size={20} /><span>Clientes</span></NavLink>
        <NavLink to="/calendar" className={navLinkClass}><CalendarIcon size={20} /><span>Calendario</span></NavLink>
        <NavLink to="/presupuestos" className={navLinkClass}><FileText size={20} /><span>Presupuestos</span></NavLink>
        <NavLink to="/invoices" className={navLinkClass}><Receipt size={20} /><span>Facturas</span></NavLink>
        <div className="mt-auto space-y-2">
          <NavLink to="/settings" className={`w-full ${navLinkClass({ isActive: false })}`}>
            <Settings size={20} />
            <span>Ajustes</span>
          </NavLink>
          <button 
            onClick={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              window.location.reload(); // Refreshing forces the app to log out
            }}
            className="w-full flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-red-500/10 text-red-400 hover:text-red-500"
          >
            <Lock size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </nav>
    </div>
  );
}