import React from 'react';
import { TrendingUp, Receipt, FileText, Wrench, Landmark } from 'lucide-react';
import { NavView } from './Sidebar.tsx';

interface BottomNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  pendingInvoicesCount?: number;
  maintenanceAlarmsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  pendingInvoicesCount = 0,
  maintenanceAlarmsCount = 0,
}) => {
  const tabs = [
    { id: 'ingresos' as NavView, label: 'Ingresos', icon: TrendingUp },
    { id: 'gastos' as NavView, label: 'Gastos', icon: Receipt },
    {
      id: 'facturas' as NavView,
      label: 'Fac. Pend',
      icon: FileText,
      badge: pendingInvoicesCount > 0 ? pendingInvoicesCount : null,
    },
    {
      id: 'mantenimiento' as NavView,
      label: 'Manten.',
      icon: Wrench,
      badge: maintenanceAlarmsCount > 0 ? maintenanceAlarmsCount : null,
    },
    { id: 'contabilidad' as NavView, label: 'Contabili', icon: Landmark },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B132B]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 safe-area-pb lg:hidden">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-orange-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? 'bg-orange-500/20 scale-105' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-orange-400' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                {tab.label}
              </span>

              {/* Notification badge */}
              {tab.badge !== undefined && tab.badge !== null && tab.badge > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
