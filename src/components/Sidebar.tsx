import React from 'react';
import {
  TrendingUp,
  Receipt,
  FileText,
  Wrench,
  Landmark,
  Bus,
  Store,
  BarChart3,
  Settings,
  DollarSign,
  X,
  Radio,
} from 'lucide-react';

export type NavView =
  | 'ingresos'
  | 'gastos'
  | 'facturas'
  | 'mantenimiento'
  | 'contabilidad'
  | 'autobuses'
  | 'proveedores'
  | 'reportes'
  | 'ajustes';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  tasaDolar: number;
  isDesktop?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentView,
  onSelectView,
  tasaDolar,
  isDesktop = false,
}) => {
  const menuItems = [
    { id: 'ingresos' as NavView, label: 'Ingresos Diarios', icon: TrendingUp },
    { id: 'gastos' as NavView, label: 'Gastos Operativos', icon: Receipt },
    { id: 'facturas' as NavView, label: 'Facturas por Pagar', icon: FileText },
    { id: 'mantenimiento' as NavView, label: 'Mantenimiento', icon: Wrench },
    { id: 'contabilidad' as NavView, label: 'Contabilidad', icon: Landmark },
    { id: 'autobuses' as NavView, label: 'Gestión de Autobuses', icon: Bus },
    { id: 'proveedores' as NavView, label: 'Proveedores', icon: Store },
    { id: 'reportes' as NavView, label: 'Informes y Reportes', icon: BarChart3 },
  ];

  const sidebarContent = (
    <div className="w-72 bg-[#0E172E] border-r border-slate-800 h-full flex flex-col shadow-2xl">
      {/* Header with Bus Logo */}
      <div className="p-5 border-b border-slate-800/80 bg-gradient-to-b from-[#1C2541] to-[#0E172E]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-lg shadow-cyan-500/10">
              <Bus className="w-7 h-7 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-1.5">
                BusControl
              </h2>
              <div className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 tracking-wider">
                • AJP-Logic •
              </div>
            </div>
          </div>
          {!isDesktop && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectView(item.id);
                if (!isDesktop) onClose();
              }}
              className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/40 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-amber-400' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Dollar Rate Banner in Sidebar */}
        <div className="pt-2 px-1">
          <div className="p-3 rounded-xl bg-[#1C2541]/80 border border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tasa Oficial del Dólar
              </span>
              <span className="text-base font-black text-amber-400">
                Bs. {tasaDolar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / USD
              </span>
            </div>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="pt-2 pb-1">
          <div className="h-px bg-slate-800/90 mx-2" />
        </div>

        {/* Settings */}
        <button
          onClick={() => {
            onSelectView('ajustes');
            if (!isDesktop) onClose();
          }}
          className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left ${
            currentView === 'ajustes'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/40 shadow-inner'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-5 h-5 shrink-0 text-slate-400" />
          <span>Ajustes</span>
        </button>
      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-slate-800/90 bg-[#0B132B] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-300">BD Sincronizada en Vivo</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">v2.6 Room</span>
      </div>
    </div>
  );

  // If rendering for desktop (permanent left column)
  if (isDesktop) {
    return <aside className="hidden lg:block h-screen sticky top-0 shrink-0 z-20">{sidebarContent}</aside>;
  }

  // Mobile modal overlay
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative z-10 animate-in slide-in-from-left duration-200">
        {sidebarContent}
      </div>
    </div>
  );
};
