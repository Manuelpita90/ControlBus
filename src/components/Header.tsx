import React, { useState } from 'react';
import { Menu, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { Autobus } from '../types/index.ts';
import { API } from '../services/api.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { WindowControls } from './WindowControls.tsx';

interface HeaderProps {
  title: string;
  tasaDolar: number;
  onOpenSidebar: () => void;
  unreportedBuses: Autobus[];
  onSelectBusQuickReport?: (bus: Autobus) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  tasaDolar,
  onOpenSidebar,
  unreportedBuses,
  onSelectBusQuickReport,
}) => {
  const [showTasaModal, setShowTasaModal] = useState(false);
  const [newRate, setNewRate] = useState(tasaDolar.toString());
  const [savingRate, setSavingRate] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSaveRate = async () => {
    const val = parseFloat(newRate.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    setSavingRate(true);
    try {
      await API.updateAjustes({
        tasaDolar: val,
        ultimaFechaTasa: new Date().toLocaleDateString('es-VE'),
      });
      setShowTasaModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenSidebar}
              className="lg:hidden p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              aria-label="Abrir Menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white tracking-wide truncate">{title}</h1>
          </div>

          {/* Dollar exchange rate & Firebase Cloud pill & PWA Install Button */}
          <div className="flex items-center space-x-2">
            <PWAInstallButton variant="header" />

            <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold" title="Conectado a Firebase Realtime Database: buscontrol-app-ce582">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Firebase Nube</span>
            </div>

            <button
              onClick={() => {
                setNewRate(tasaDolar.toString());
                setShowTasaModal(true);
              }}
              className="flex items-center space-x-1.5 bg-[#1C2541] hover:bg-[#233157] border border-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-inner transition-all group"
              title="Tasa de cambio del día (Click para cambiar)"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bs. {tasaDolar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </button>

            {/* Desktop Window Controls: Minimize, Fullscreen/Restore, Close */}
            <WindowControls />
          </div>
        </div>

        {/* Warning banner if buses haven't reported today */}
        {unreportedBuses.length > 0 && (
          <div className="mt-2.5 max-w-7xl mx-auto bg-amber-950/40 border border-amber-500/50 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-amber-200">
            <div className="flex items-center space-x-2 font-medium mb-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Atención: Hay {unreportedBuses.length} {unreportedBuses.length === 1 ? 'autobús' : 'autobuses'} sin reporte hoy ({todayStr})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {unreportedBuses.map((bus) => (
                <button
                  key={bus.id}
                  onClick={() => onSelectBusQuickReport?.(bus)}
                  className="bg-[#1C2541]/90 hover:bg-amber-500/20 border border-amber-500/60 px-2.5 py-1 rounded text-xs font-semibold text-amber-300 hover:text-white transition-colors"
                >
                  {bus.placa} ({bus.transporte || bus.alias || bus.modelo}) +
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Quick Rate Modal */}
      {showTasaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Tasa Oficial del Dólar</h3>
                  <p className="text-xs text-slate-400">Valor de 1 USD en Bolívares (VES)</p>
                </div>
              </div>
              <button
                onClick={() => setShowTasaModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tasa Actual (Bs. / 1 USD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-4 py-2.5 text-white font-bold text-lg focus:outline-none focus:border-amber-500"
                    placeholder="857.01"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-semibold">VES</span>
                </div>
              </div>

              <div className="bg-[#0B132B]/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Referencia:</span>
                  <span className="text-emerald-400 font-medium">Banco Central de Venezuela (BCV)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sincronización:</span>
                  <span className="text-cyan-400 font-medium">En vivo a todas las pantallas</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowTasaModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRate}
                disabled={savingRate}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center space-x-1.5"
              >
                {savingRate ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                <span>Actualizar Tasa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
