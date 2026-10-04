import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  FileText,
  Bus,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  ChevronDown
} from 'lucide-react';
import { DatabaseSchema, Autobus } from '../types/index.ts';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface ReportesViewProps {
  data: DatabaseSchema;
}

export const ReportesView: React.FC<ReportesViewProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'informe_bus' | 'reportes_generales' | 'datos_detallados'>('informe_bus');
  const [selectedBusId, setSelectedBusId] = useState<number>(data.autobuses[1]?.id || data.autobuses[0]?.id || 1);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Este mes');

  const tasa = data.ajustes.tasaDolar;

  // Determine available months in chronological order
  const allDates = [
    ...data.ingresos.map((i) => i.fecha || i.date || ''),
    ...data.gastos.map((g) => g.fecha || g.date || ''),
  ].filter(Boolean);

  const availableMonths = Array.from(new Set(allDates.map((d) => d.slice(0, 7)))).sort().reverse();
  const currentMonthKey = availableMonths[0] || '2026-10';
  const prevMonthKey = availableMonths[1] || '2026-09';

  const getMonthLabel = (m: string) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const monthsNames: Record<string, string> = {
      '01': 'Enero',
      '02': 'Febrero',
      '03': 'Marzo',
      '04': 'Abril',
      '05': 'Mayo',
      '06': 'Junio',
      '07': 'Julio',
      '08': 'Agosto',
      '09': 'Septiembre',
      '10': 'Octubre',
      '11': 'Noviembre',
      '12': 'Diciembre',
    };
    return `${monthsNames[mo] || mo} ${y}`;
  };

  // Filter items by selected period
  const filterByPeriod = <T extends { fecha?: string; date?: string }>(items: T[]): T[] => {
    if (selectedPeriod === 'Todo el historial') {
      return items;
    }
    if (selectedPeriod === 'Este mes') {
      return items.filter((item) => (item.fecha || item.date || '').startsWith(currentMonthKey));
    }
    if (selectedPeriod === 'Mes anterior') {
      return items.filter((item) => (item.fecha || item.date || '').startsWith(prevMonthKey));
    }
    return items.filter((item) => (item.fecha || item.date || '').startsWith(selectedPeriod));
  };

  const filteredIngresos = filterByPeriod(data.ingresos);
  const filteredGastos = filterByPeriod(data.gastos);

  // Selected bus calculations
  const currentBus = data.autobuses.find((b) => b.id === selectedBusId) || data.autobuses[0];
  const busIngresos = filteredIngresos.filter(
    (i) => i.autobusId === currentBus?.id || i.placa === currentBus?.placa
  );
  const busGastos = filteredGastos.filter(
    (g) => g.autobusId === currentBus?.id || (currentBus && g.unidadNombre?.includes(currentBus.placa))
  );

  const busTotalIngresosVES = busIngresos.reduce((s, i) => s + i.montoVES, 0);
  const busTotalIngresosUSD = Number((busTotalIngresosVES / tasa).toFixed(2));

  const busTotalGastosVES = busGastos.reduce((s, g) => s + g.montoVES, 0);
  const busTotalGastosUSD = Number((busTotalGastosVES / tasa).toFixed(2));

  const busUtilidadVES = busTotalIngresosVES - busTotalGastosVES;
  const busUtilidadUSD = Number((busUtilidadVES / tasa).toFixed(2));

  const busDiasTrabajados = busIngresos.length;
  const busPromedioDiarioVES = busDiasTrabajados > 0 ? busTotalIngresosVES / busDiasTrabajados : 0;
  const busPromedioDiarioUSD = Number((busPromedioDiarioVES / tasa).toFixed(2));

  const busMargenPct = busTotalIngresosVES > 0 ? ((busUtilidadVES / busTotalIngresosVES) * 100).toFixed(1) : '0.0';
  const busTotalRegistros = busIngresos.length + busGastos.length;

  // Global fleet calculations
  const globalTotalIngresosVES = filteredIngresos.reduce((s, i) => s + i.montoVES, 0);
  const globalTotalIngresosUSD = Number((globalTotalIngresosVES / tasa).toFixed(2));

  const globalTotalGastosVES = filteredGastos.reduce((s, g) => s + g.montoVES, 0);
  const globalTotalGastosUSD = Number((globalTotalGastosVES / tasa).toFixed(2));

  const globalGananciaNetaVES = globalTotalIngresosVES - globalTotalGastosVES;
  const globalGananciaNetaUSD = Number((globalGananciaNetaVES / tasa).toFixed(2));

  // Global expenses by category
  const expensesByCategory: Record<string, { totalVES: number; count: number }> = {};
  filteredGastos.forEach((g) => {
    const cat = g.categoria || 'VARIOS';
    if (!expensesByCategory[cat]) {
      expensesByCategory[cat] = { totalVES: 0, count: 0 };
    }
    expensesByCategory[cat].totalVES += g.montoVES;
    expensesByCategory[cat].count += 1;
  });

  const sortedCategories = Object.entries(expensesByCategory).sort((a, b) => b[1].totalVES - a[1].totalVES);

  // Combined Operations for "Datos Detallados"
  type Operation = {
    id: string;
    fecha: string;
    autobusPlaca: string;
    concepto: string;
    categoria: string;
    tipo: 'INGRESO' | 'GASTO';
    montoVES: number;
    montoUSD: number;
  };

  const allOperations: Operation[] = [
    ...filteredIngresos.map((i) => ({
      id: `ing-${i.id}`,
      fecha: i.fecha,
      autobusPlaca: i.placa || (data.autobuses.find((b) => b.id === i.autobusId)?.placa || 'FLOTA'),
      concepto: i.observaciones || 'Ingreso Diario Ruta',
      categoria: 'Ingreso',
      tipo: 'INGRESO' as const,
      montoVES: i.montoVES,
      montoUSD: i.montoUSD || Number((i.montoVES / tasa).toFixed(2)),
    })),
    ...filteredGastos.map((g) => {
      const bus = data.autobuses.find((b) => b.id === g.autobusId);
      return {
        id: `gas-${g.id}`,
        fecha: g.fecha,
        autobusPlaca: bus ? bus.placa : (g.unidadNombre ? g.unidadNombre.split(' - ')[0] : 'FLOTA'),
        concepto: g.concepto,
        categoria: g.categoria,
        tipo: 'GASTO' as const,
        montoVES: g.montoVES,
        montoUSD: g.montoUSD || Number((g.montoVES / tasa).toFixed(2)),
      };
    }),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id.localeCompare(a.id));

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Header bar matching Android App */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <span>Generación de Reportes</span>
          </h2>
          <p className="text-[11px] text-slate-400">Auditoría financiera y desempeño operacional</p>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Tasa: Bs. {tasa.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Tabs Menu matching Android */}
      <div className="flex items-center gap-1.5 p-1 bg-[#1C2541]/90 rounded-2xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('informe_bus')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'informe_bus'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>Informe Autobús</span>
        </button>

        <button
          onClick={() => setActiveTab('reportes_generales')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'reportes_generales'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reportes Generales</span>
        </button>

        <button
          onClick={() => setActiveTab('datos_detallados')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'datos_detallados'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Datos Detallados</span>
        </button>
      </div>

      {/* Global Period Selector Bar */}
      <div className="bg-[#1C2541]/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-md">
        <div className="flex items-center space-x-2 text-xs text-slate-300">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">Filtro de Período Activo:</span>
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-[11px]">
            {selectedPeriod === 'Este mes'
              ? `Este mes (${getMonthLabel(currentMonthKey)})`
              : selectedPeriod === 'Mes anterior'
              ? `Mes anterior (${getMonthLabel(prevMonthKey)})`
              : 'Todo el historial (Completo)'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-slate-400 hidden sm:inline">Cambiar período:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-[#0B132B] border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500 shadow-inner"
          >
            <option value="Este mes">Este mes ({getMonthLabel(currentMonthKey)})</option>
            <option value="Mes anterior">Mes anterior ({getMonthLabel(prevMonthKey)})</option>
            <option value="Todo el historial">Todo el historial ({allDates.length} registros)</option>
          </select>
        </div>
      </div>

      {/* TAB 1: INFORME AUTOBÚS (Matches Screenshot 3) */}
      {activeTab === 'informe_bus' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Período
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="Este mes">Este mes ({getMonthLabel(currentMonthKey)})</option>
                <option value="Mes anterior">Mes anterior ({getMonthLabel(prevMonthKey)})</option>
                <option value="Todo el historial">Todo el historial</option>
              </select>
            </div>

            <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Días Trabajados
              </span>
              <span className="text-xl font-black text-cyan-400 mt-0.5">{busDiasTrabajados}</span>
            </div>
          </div>

          {/* Bus Selector */}
          <div className="bg-[#1C2541]/90 border border-amber-500/30 rounded-2xl p-3.5">
            <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5" />
              <span>Autobús Seleccionado:</span>
            </label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(Number(e.target.value))}
              className="w-full bg-[#0B132B] border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white font-black tracking-wide focus:outline-none focus:border-amber-500"
            >
              {data.autobuses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.placa} - {bus.transporte || bus.alias || bus.modelo}
                </option>
              ))}
            </select>
          </div>

          {/* 6 Financial Summary Cards matching Screenshot 3 */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Resumen Financiero:
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* INGRESOS */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Ingresos</span>
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-400">
                  {formatVES(busTotalIngresosVES)}
                </div>
                <div className="text-xs font-bold text-emerald-300 mt-0.5">
                  $ {busTotalIngresosUSD.toFixed(2)}
                </div>
              </div>

              {/* GASTOS */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Gastos</span>
                </div>
                <div className="text-base sm:text-lg font-black text-rose-400">
                  {formatVES(busTotalGastosVES)}
                </div>
                <div className="text-xs font-bold text-rose-300 mt-0.5">
                  $ {busTotalGastosUSD.toFixed(2)}
                </div>
              </div>

              {/* UTILIDAD */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Utilidad</span>
                </div>
                <div className={`text-base sm:text-lg font-black ${busUtilidadVES >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatVES(busUtilidadVES)}
                </div>
                <div className="text-xs font-bold text-cyan-300 mt-0.5">
                  $ {busUtilidadUSD.toFixed(2)}
                </div>
              </div>

              {/* PROM. DIARIO */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Prom. Diario</span>
                </div>
                <div className="text-base sm:text-lg font-black text-amber-400">
                  {formatVES(busPromedioDiarioVES)}
                </div>
                <div className="text-xs font-bold text-amber-300 mt-0.5">
                  $ {busPromedioDiarioUSD.toFixed(2)}
                </div>
              </div>

              {/* RENTABILIDAD */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <Percent className="w-3.5 h-3.5" />
                  <span>Rentabilidad</span>
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-400">
                  +{busMargenPct}%
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Margen Neto</div>
              </div>

              {/* REGISTROS */}
              <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
                <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-black uppercase tracking-wider mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Registros</span>
                </div>
                <div className="text-base sm:text-lg font-black text-white">
                  {busTotalRegistros} Total
                </div>
                <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  {busIngresos.length} Ing. • {busGastos.length} Gas.
                </div>
              </div>
            </div>
          </div>

          {/* Desglose de Gastos del Autobús */}
          <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Desglose de Gastos ({currentBus?.placa})
              </h4>
              <span className="text-xs font-black text-rose-400">
                Total: {formatVES(busTotalGastosVES)}
              </span>
            </div>

            <div className="space-y-2">
              {busGastos.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  No hay gastos específicos registrados para esta unidad
                </div>
              ) : (
                busGastos.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B132B]/80 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{g.concepto}</span>
                      <span className="text-[10px] text-slate-400">
                        {g.fecha} • {g.categoria}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-rose-400 block">{formatVES(g.montoVES)}</span>
                      <span className="text-[10px] text-slate-400">$ {g.montoUSD?.toFixed(2)} USD</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPORTES GENERALES (Matches Screenshot 2) */}
      {activeTab === 'reportes_generales' && (
        <div className="space-y-4">
          {/* RESUMEN DE FLOTA CARD (Exact match with Screenshot 2) */}
          <div className="bg-gradient-to-br from-[#1C2541] via-[#111827] to-[#0B132B] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">
                Resumen de Flota
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                {selectedPeriod === 'Este mes'
                  ? getMonthLabel(currentMonthKey)
                  : selectedPeriod === 'Mes anterior'
                  ? getMonthLabel(prevMonthKey)
                  : 'Historial Completo'}
              </span>
            </div>

            {/* Ingresos Brutos */}
            <div className="space-y-0.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-300">Ingresos Brutos de Flota:</span>
                <span className="text-lg sm:text-xl font-black text-emerald-400">
                  {formatVES(globalTotalIngresosVES)}
                </span>
              </div>
              <div className="text-right text-xs font-bold text-slate-400">
                $ {globalTotalIngresosUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
            </div>

            {/* Gastos Operativos */}
            <div className="space-y-0.5 border-t border-slate-800 pt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-300">Gastos Operativos Totales:</span>
                <span className="text-lg sm:text-xl font-black text-rose-400">
                  {formatVES(globalTotalGastosVES)}
                </span>
              </div>
              <div className="text-right text-xs font-bold text-slate-400">
                $ {globalTotalGastosUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
            </div>

            {/* Ganancia Neta */}
            <div className="space-y-0.5 border-t border-slate-800 pt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-300">Ganancia Neta Consolidada:</span>
                <span className={`text-lg sm:text-xl font-black ${globalGananciaNetaVES >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatVES(globalGananciaNetaVES)}
                </span>
              </div>
              <div className="text-right text-xs font-bold text-slate-400">
                $ {globalGananciaNetaUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
            </div>
          </div>

          {/* DESGLOSE GLOBAL DE GASTOS (Exact match with Screenshot 2) */}
          <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Desglose Global de Gastos</h3>
                <p className="text-[10px] text-slate-400">Distribución porcentual por categoría</p>
              </div>
              <span className="text-xs font-black text-rose-400">
                Total: {formatVES(globalTotalGastosVES)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B132B] text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-right">Monto VES</th>
                    <th className="py-2.5 px-3 text-right">% Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {sortedCategories.map(([cat, info], index) => {
                    const pct = globalTotalGastosVES > 0 ? (info.totalVES / globalTotalGastosVES) * 100 : 0;
                    const catUSD = info.totalVES / tasa;

                    return (
                      <tr key={cat} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-amber-500 font-bold">{index + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-black text-white uppercase block">{cat}</span>
                          <span className="text-[10px] text-slate-400">
                            {info.count} gasto{info.count > 1 ? 's' : ''} • ${catUSD.toFixed(2)} USD
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-white">
                          {formatVES(info.totalVES)}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-amber-400">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATOS DETALLADOS (Exact match with Screenshot 1) */}
      {activeTab === 'datos_detallados' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Historial Detallado de Operaciones:
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedPeriod === 'Todo el historial'
                  ? 'Mostrando todo el historial consolidado'
                  : `Filtrado por: ${selectedPeriod === 'Este mes' ? getMonthLabel(currentMonthKey) : getMonthLabel(prevMonthKey)}`}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {allOperations.length} transacciones
            </span>
          </div>

          <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B132B] text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Fecha / Autobús</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {allOperations.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-400 text-[10px] block font-mono">{op.fecha}</span>
                        <span className="font-bold text-white text-xs">{op.autobusPlaca}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white block text-xs truncate max-w-xs">
                          {op.concepto}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            op.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {op.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-xs sm:text-sm block ${
                            op.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {op.tipo === 'INGRESO' ? '+' : '-'}
                          {formatVES(op.montoVES)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          $ {op.montoUSD.toFixed(2)} USD
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
