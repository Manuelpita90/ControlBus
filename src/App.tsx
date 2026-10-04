import React, { useEffect, useState, useMemo } from 'react';
import { DatabaseSchema, Autobus } from './types/index.ts';
import { initRealtimeSync, subscribeToDatabase } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { Sidebar, NavView } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

// Views
import { IngresosView } from './views/IngresosView.tsx';
import { GastosView } from './views/GastosView.tsx';
import { FacturasView } from './views/FacturasView.tsx';
import { MantenimientoView } from './views/MantenimientoView.tsx';
import { ContabilidadView } from './views/ContabilidadView.tsx';
import { AutobusesView } from './views/AutobusesView.tsx';
import { ProveedoresView } from './views/ProveedoresView.tsx';
import { ReportesView } from './views/ReportesView.tsx';
import { AjustesView } from './views/AjustesView.tsx';

export default function App() {
  const [data, setData] = useState<DatabaseSchema | null>(null);
  const [currentView, setCurrentView] = useState<NavView>('ingresos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [quickBusSelect, setQuickBusSelect] = useState<Autobus | null>(null);

  useEffect(() => {
    initRealtimeSync();
    const unsubscribe = subscribeToDatabase((latestData) => {
      setData(latestData);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Check buses that have not submitted an income today
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const unreportedBuses = useMemo(() => {
    if (!data) return [];
    const reportedBusIds = new Set(
      data.ingresos
        .filter((i) => i.fecha === todayStr)
        .map((i) => i.autobusId)
    );
    return data.autobuses.filter((bus) => bus.estado === 'activo' && !reportedBusIds.has(bus.id));
  }, [data, todayStr]);

  // Counts for navigation badges
  const pendingInvoicesCount = useMemo(() => {
    if (!data) return 0;
    return data.facturas.filter((f) => f.estado === 'PENDIENTE' && f.deudaRestanteUSD > 0).length;
  }, [data]);

  const maintenanceAlarmsCount = useMemo(() => {
    if (!data) return 0;
    return data.mantenimientos.filter((m) => m.alarmaActiva && (m.estado === 'por_vencer' || m.estado === 'vencido')).length;
  }, [data]);

  const handleSelectBusQuickReport = (bus: Autobus) => {
    setCurrentView('ingresos');
    setQuickBusSelect(bus);
  };

  const getTitle = (view: NavView): string => {
    switch (view) {
      case 'ingresos':
        return 'Ingresos Diarios';
      case 'gastos':
        return 'Gastos Operativos';
      case 'facturas':
        return 'Facturas por Pagar';
      case 'mantenimiento':
        return 'Mantenimiento';
      case 'contabilidad':
        return 'Contabilidad';
      case 'autobuses':
        return 'Gestión de Autobuses';
      case 'proveedores':
        return 'Proveedores';
      case 'reportes':
        return 'Informes y Reportes';
      case 'ajustes':
        return 'Ajustes';
    }
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-400">Cargando base de datos BusControl...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex selection:bg-amber-500 selection:text-white">
      <OfflineIndicator />

      {/* Permanent Sidebar for Desktop PC screens */}
      <Sidebar
        isOpen={true}
        onClose={() => {}}
        currentView={currentView}
        onSelectView={setCurrentView}
        tasaDolar={data.ajustes.tasaDolar}
        isDesktop={true}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <Header
          title={getTitle(currentView)}
          tasaDolar={data.ajustes.tasaDolar}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          unreportedBuses={unreportedBuses}
          onSelectBusQuickReport={handleSelectBusQuickReport}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto px-1 sm:px-3">
          {currentView === 'ingresos' && (
            <IngresosView
              data={data}
              quickBusSelect={quickBusSelect}
              onClearQuickBus={() => setQuickBusSelect(null)}
            />
          )}
          {currentView === 'gastos' && <GastosView data={data} />}
          {currentView === 'facturas' && <FacturasView data={data} />}
          {currentView === 'mantenimiento' && <MantenimientoView data={data} />}
          {currentView === 'contabilidad' && <ContabilidadView data={data} />}
          {currentView === 'autobuses' && (
            <AutobusesView
              data={data}
              onSelectBusQuickReport={handleSelectBusQuickReport}
            />
          )}
          {currentView === 'proveedores' && <ProveedoresView data={data} />}
          {currentView === 'reportes' && <ReportesView data={data} />}
          {currentView === 'ajustes' && <AjustesView data={data} />}
        </main>

        {/* Bottom Navigation Bar (Mobile only) */}
        <BottomNav
          currentView={currentView}
          onSelectView={setCurrentView}
          pendingInvoicesCount={pendingInvoicesCount}
          maintenanceAlarmsCount={maintenanceAlarmsCount}
        />
      </div>

      {/* Slide-out Sidebar Drawer (Mobile & Tablet) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView}
        onSelectView={setCurrentView}
        tasaDolar={data.ajustes.tasaDolar}
        isDesktop={false}
      />
    </div>
  );
}
