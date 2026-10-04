import React, { useState } from 'react';
import { Plus, Receipt, Calendar, Bus, Store, FileText, Trash2, Tag } from 'lucide-react';
import { DatabaseSchema } from '../types/index.ts';
import { API } from '../services/api.ts';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface GastosViewProps {
  data: DatabaseSchema;
}

export const GastosView: React.FC<GastosViewProps> = ({ data }) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('TODAS');

  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState(data.categoriasGastos[0] || 'REPUESTOS');
  const [autobusId, setAutobusId] = useState<string>('flota_general');
  const [proveedor, setProveedor] = useState(data.proveedores[0]?.nombre || 'GENERAL');
  const [tipoPago, setTipoPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [montoInput, setMontoInput] = useState('');
  const [concepto, setConcepto] = useState('');
  const [saving, setSaving] = useState(false);

  const tasa = data.ajustes.tasaDolar;

  // Filtered expenses
  const filteredGastos = data.gastos.filter((g) => {
    if (selectedCategoryFilter === 'TODAS') return true;
    return g.categoria.toUpperCase() === selectedCategoryFilter.toUpperCase();
  });

  const totalGastosVES = data.gastos.reduce((sum, g) => sum + g.montoVES, 0);
  const totalGastosUSD = data.gastos.reduce((sum, g) => sum + g.montoUSD, 0);

  // Form live calculation
  const parsedVal = parseFloat(montoInput.replace(',', '.')) || 0;
  const liveVES = tipoPago === 'CONTADO' ? parsedVal : parsedVal * tasa;
  const liveUSD = tipoPago === 'CONTADO' ? (parsedVal > 0 ? parsedVal / tasa : 0) : parsedVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedVal <= 0) return;

    setSaving(true);
    try {
      const selectedBus =
        autobusId === 'flota_general'
          ? null
          : data.autobuses.find((b) => b.id === Number(autobusId));

      const busName = selectedBus
        ? `${selectedBus.placa} - ${selectedBus.modelo} (${selectedBus.transporte || selectedBus.alias || 'Unidad'})`
        : 'Flota General';

      await API.addGasto({
        fecha,
        categoria,
        autobusId: selectedBus ? selectedBus.id : null,
        unidadNombre: busName,
        proveedor,
        tipoPago,
        montoVES: liveVES,
        montoUSD: liveUSD,
        tasaCambio: tasa,
        concepto,
      });

      setShowModal(false);
      setMontoInput('');
      setConcepto('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar este registro de gasto?')) {
      await API.deleteGasto(id);
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'REPUESTOS':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DIESEL':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'ADMINISTRATIVO':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'LUBRICANTES':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'NEUMÁTICOS':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Gastos Totales */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Gastos Totales
            </span>
            <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {formatVES(totalGastosVES)}
          </div>
          <div className="text-xs sm:text-sm font-semibold text-rose-400 mt-0.5">
            {formatUSD(totalGastosUSD)}
          </div>
        </div>

        {/* Card 2: Registros */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Registros
            </span>
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {data.gastos.length} facturas
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5">
            Gastos Operativos
          </div>
        </div>
      </div>

      {/* Category Filter and Add Button */}
      <div className="bg-[#1C2541]/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-md">
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
            Categorías de Egresos
          </label>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="TODAS">TODAS LAS CATEGORÍAS</option>
            {data.categoriasGastos.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="self-end px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-sm transition-all shadow flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Gasto</span>
        </button>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            HISTORIAL DE GASTOS
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {filteredGastos.length} registros
            </span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Desliza la tabla para ver más • Toca una fila para ver detalles
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1C2541]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#0B132B]/80 text-slate-400 uppercase text-[10px] sm:text-xs font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3">Unidad / Destino</th>
                <th className="py-3 px-3">Proveedor</th>
                <th className="py-3 px-3 text-right">Monto (VES)</th>
                <th className="py-3 px-3 text-right">USD</th>
                <th className="py-3 px-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filteredGastos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-medium">
                    No hay gastos en esta categoría
                  </td>
                </tr>
              ) : (
                filteredGastos.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {item.id}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      {item.fecha}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md border font-black text-[11px] tracking-wider ${getCategoryBadgeClass(
                          item.categoria
                        )}`}
                      >
                        {item.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-white whitespace-nowrap">
                      {item.unidadNombre}
                      {item.concepto && (
                        <span className="block text-[10px] text-slate-400 truncate max-w-xs">
                          {item.concepto}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs whitespace-nowrap">
                      {item.proveedor}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap">
                      {formatVES(item.montoVES)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-rose-400 whitespace-nowrap">
                      {formatUSD(item.montoUSD)}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                        title="Eliminar gasto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-4 sm:right-8 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all"
        aria-label="Registrar Gasto"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal: Registrar Gasto Operativo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-2 border-b border-slate-700 pb-3">
              <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Registrar Gasto Operativo</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Fecha del Gasto:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="flex-1 bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setFecha(new Date().toISOString().split('T')[0])}
                    className="px-2.5 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg text-xs font-bold"
                  >
                    HOY
                  </button>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  Categoría del Gasto:
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  {data.categoriasGastos.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unidad / Autobús */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Bus className="w-3.5 h-3.5 text-slate-400" />
                  Unidad / Autobús:
                </label>
                <select
                  value={autobusId}
                  onChange={(e) => setAutobusId(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="flota_general">Flota General (Sin unidad)</option>
                  {data.autobuses.map((bus) => (
                    <option key={bus.id} value={bus.id.toString()}>
                      {bus.placa} - {bus.modelo} ({bus.transporte || bus.alias || 'Unidad'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  Nombre del Proveedor:
                </label>
                <select
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  {data.proveedores.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre} ({p.categoria})
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Contado / Crédito */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Modalidad de Pago:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoPago('CONTADO')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                      tipoPago === 'CONTADO'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                        : 'bg-[#0B132B] text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    AL CONTADO (VES)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoPago('CREDITO')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                      tipoPago === 'CREDITO'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                        : 'bg-[#0B132B] text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    A CRÉDITO (USD)
                  </button>
                </div>
              </div>

              {/* Monto input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tipoPago === 'CONTADO' ? 'Monto en Bolívares (VES):' : 'Monto en Dólares (USD):'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-amber-400 font-bold text-sm">
                    {tipoPago === 'CONTADO' ? 'Bs.' : '$'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={montoInput}
                    onChange={(e) => setMontoInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-white font-black text-lg focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="p-3 bg-[#0B132B]/80 rounded-xl border border-slate-700/60 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">
                    {tipoPago === 'CONTADO' ? 'Equivalencia USD:' : 'Equivalencia VES:'}
                  </span>
                  <span className="text-white font-bold">
                    {tipoPago === 'CONTADO' ? formatUSD(liveUSD) : formatVES(liveVES)}
                  </span>
                </div>
                {tipoPago === 'CREDITO' && (
                  <p className="text-[11px] text-cyan-300 font-medium">
                    ⓘ Se creará automáticamente una Factura por Pagar a {data.ajustes.plazoVencimientoDias} días.
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción / Concepto:
                </label>
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Ej: Compra de repuestos o carga diesel"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={saving || parsedVal <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg"
                >
                  {saving ? 'REGISTRANDO...' : 'REGISTRAR GASTO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
