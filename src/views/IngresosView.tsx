import React, { useState } from 'react';
import { Plus, TrendingUp, Bus, Trash2, Pencil, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { DatabaseSchema, Autobus, IngresoDiario } from '../types/index.ts';
import { API } from '../services/api.ts';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface IngresosViewProps {
  data: DatabaseSchema;
  quickBusSelect?: Autobus | null;
  onClearQuickBus?: () => void;
}

export const IngresosView: React.FC<IngresosViewProps> = ({
  data,
  quickBusSelect,
  onClearQuickBus,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingIngreso, setEditingIngreso] = useState<IngresoDiario | null>(null);
  const [deletingIngreso, setDeletingIngreso] = useState<IngresoDiario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [autobusId, setAutobusId] = useState<number | ''>(
    quickBusSelect ? quickBusSelect.id : data.autobuses[0]?.id || ''
  );
  const [montoVES, setMontoVES] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  // If quickBusSelect is triggered from header banner, open modal
  React.useEffect(() => {
    if (quickBusSelect) {
      setEditingIngreso(null);
      setAutobusId(quickBusSelect.id);
      setFecha(new Date().toISOString().split('T')[0]);
      setMontoVES('');
      setObservaciones('');
      setShowModal(true);
      onClearQuickBus?.();
    }
  }, [quickBusSelect, onClearQuickBus]);

  const tasa = data.ajustes.tasaDolar;
  const pctReserva = data.ajustes.fondoReservaPct || 0;

  // Active month (YYYY-MM) - strictly show only current month
  const currentMonthKey = React.useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const getMonthName = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
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
    return `${monthsNames[m] || m} ${y}`;
  };

  const currentMonthLabel = getMonthName(currentMonthKey);

  // Filter incomes to show ONLY the current month
  const displayedIngresos = React.useMemo(() => {
    return data.ingresos
      .filter((item) => (item.fecha || (item as any).date || '').startsWith(currentMonthKey))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || Number(b.id) - Number(a.id));
  }, [data.ingresos, currentMonthKey]);

  // Current month totals calculations
  const totalVES = displayedIngresos.reduce((sum, item) => sum + item.montoVES, 0);
  const totalUSD = Number((totalVES / tasa).toFixed(2));
  const promedioVES = displayedIngresos.length > 0 ? totalVES / displayedIngresos.length : 0;
  const promedioUSD = Number((promedioVES / tasa).toFixed(2));

  // Live input calculations for modal
  const parsedVES = parseFloat(montoVES.replace(',', '.')) || 0;
  const calculatedUSD = parsedVES > 0 ? (parsedVES / tasa).toFixed(2) : '0.00';

  // Validation: A bus cannot have two incomes on the same day
  const existingForDateAndBus = React.useMemo(() => {
    if (!autobusId || !fecha) return null;
    const bus = data.autobuses.find((b) => b.id === Number(autobusId));
    const targetPlaca = bus?.placa;
    return data.ingresos.find((item) => {
      // If we are editing, ignore the record currently being edited
      if (
        editingIngreso &&
        (Number(item.id) === Number(editingIngreso.id) || String(item.id) === String(editingIngreso.id))
      ) {
        return false;
      }
      const itemDate = item.fecha || (item as any).date || '';
      const itemBusId = item.autobusId;
      const itemPlaca = item.placa || (item as any).busPlate;
      return (
        itemDate === fecha &&
        (itemBusId === Number(autobusId) || (targetPlaca && itemPlaca === targetPlaca))
      );
    });
  }, [data.ingresos, data.autobuses, autobusId, fecha, editingIngreso]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const handleOpenCreate = () => {
    setEditingIngreso(null);
    setFecha(new Date().toISOString().split('T')[0]);
    setAutobusId(quickBusSelect ? quickBusSelect.id : data.autobuses[0]?.id || '');
    setMontoVES('');
    setObservaciones('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: IngresoDiario) => {
    setEditingIngreso(item);
    setFecha(item.fecha || (item as any).date || '');
    const matchedBus = data.autobuses.find((b) => b.id === item.autobusId || b.placa === item.placa);
    setAutobusId(matchedBus ? matchedBus.id : item.autobusId || data.autobuses[0]?.id || '');
    setMontoVES(String(item.montoVES));
    setObservaciones(item.observaciones || (item as any).note || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autobusId || parsedVES <= 0) return;

    if (existingForDateAndBus) {
      showToast(
        `El autobús ${existingForDateAndBus.placa} ya tiene un ingreso registrado para el día ${fecha}. No se permite duplicar ingreso en la misma fecha.`,
        'error'
      );
      return;
    }

    const bus = data.autobuses.find((b) => b.id === Number(autobusId));
    if (!bus) return;

    setSaving(true);
    try {
      if (editingIngreso) {
        await API.updateIngreso(editingIngreso.id, {
          fecha,
          autobusId: bus.id,
          placa: bus.placa,
          unidadAlias: bus.transporte || bus.alias || bus.modelo,
          montoVES: parsedVES,
          tasaCambio: tasa,
          porcentajeReserva: pctReserva,
          observaciones,
        });
        showToast('Ingreso diario actualizado exitosamente en sistema y Firebase', 'success');
      } else {
        await API.addIngreso({
          fecha,
          autobusId: bus.id,
          placa: bus.placa,
          unidadAlias: bus.transporte || bus.alias || bus.modelo,
          montoVES: parsedVES,
          tasaCambio: tasa,
          porcentajeReserva: pctReserva,
          observaciones,
        });
        showToast('Ingreso diario registrado exitosamente en sistema y Firebase', 'success');
      }
      setShowModal(false);
      setEditingIngreso(null);
      setMontoVES('');
      setObservaciones('');
    } catch (err: any) {
      console.error('Error al guardar ingreso:', err);
      showToast(err.message || 'Error al guardar el ingreso en el servidor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIngreso) return;
    setDeleting(true);
    try {
      await API.deleteIngreso(deletingIngreso.id);
      showToast(`Ingreso #${deletingIngreso.id} eliminado correctamente de la base de datos y Firebase`, 'success');
      setDeletingIngreso(null);
    } catch (err) {
      console.error('Error al eliminar ingreso:', err);
      showToast('Error al eliminar el ingreso', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-lg transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-80 rounded-lg text-slate-400 hover:text-white"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Ingresos Brutos */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ingresos ({currentMonthLabel})
            </span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-400 tracking-tight">
            {formatVES(totalVES)}
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-300 mt-0.5">
            Equivalencia: <span className="text-emerald-300">{formatUSD(totalUSD)}</span>
          </div>
        </div>

        {/* Card 2: Jornadas Registradas */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Jornadas ({currentMonthLabel})
            </span>
            <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Bus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {displayedIngresos.length} <span className="text-xs sm:text-sm font-normal text-slate-400">reportes</span>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-cyan-400 mt-0.5">
            Promedio: {formatVES(promedioVES)} ({formatUSD(promedioUSD)})
          </div>
        </div>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white">
              Ingresos Diarios ({displayedIngresos.length})
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-bold text-cyan-300">
              {currentMonthLabel} (Mes actual)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Control de producción diaria por autobús - Solo mes en curso</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Ingreso</span>
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-[#1C2541]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#0B132B]/80 text-slate-400 uppercase text-[10px] sm:text-xs font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Placa</th>
                <th className="py-3 px-3">Transporte / Unidad</th>
                <th className="py-3 px-3">Modelo</th>
                <th className="py-3 px-3 text-right">Monto Diario (VES)</th>
                <th className="py-3 px-3 text-right">Equivalente (USD)</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {displayedIngresos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <p className="text-sm font-semibold text-slate-300">No hay registros de ingresos en el mes actual ({currentMonthLabel})</p>
                    <p className="text-xs text-slate-500 mt-1">Haga clic en &quot;Registrar Ingreso&quot; para añadir una jornada</p>
                  </td>
                </tr>
              ) : (
                displayedIngresos.map((item, index) => {
                  const matchedBus = data.autobuses.find((b) => b.id === item.autobusId || b.placa === item.placa);
                  const busTransporte = matchedBus?.transporte || item.unidadAlias || matchedBus?.alias || 'Transporte';
                  const busModelo = matchedBus?.modelo || 'NT';
                  const liveUSD = Number((item.montoVES / tasa).toFixed(2));

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-medium">
                        {item.fecha}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 font-mono font-bold text-xs">
                          {item.placa}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {busTransporte}
                        {item.observaciones && (
                          <span className="block text-[10px] font-normal text-slate-400 truncate max-w-xs">
                            {item.observaciones}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                          {busModelo}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-400 whitespace-nowrap text-sm">
                        {formatVES(item.montoVES)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-300 whitespace-nowrap">
                        {formatUSD(liveUSD)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                            title="Editar ingreso"
                            aria-label="Editar ingreso"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingIngreso(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                            title="Eliminar ingreso"
                            aria-label="Eliminar ingreso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={handleOpenCreate}
        className="fixed bottom-20 right-4 sm:right-8 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all"
        aria-label="Registrar Ingreso"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal: Registrar / Editar Ingreso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                  {editingIngreso ? <Pencil className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {editingIngreso ? 'Editar Ingreso Diario' : 'Registrar Ingreso Diario'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingIngreso ? `Modificando registro #${editingIngreso.id} (${editingIngreso.placa})` : 'Seleccione la unidad y el monto producido'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingIngreso(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Conflict Alert Banner */}
              {existingForDateAndBus && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-start space-x-2.5 text-rose-300 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-rose-200">
                      ¡Ingreso ya registrado para este autobús en esta fecha!
                    </div>
                    <div className="text-slate-300">
                      El autobús <span className="font-mono font-bold text-cyan-300">{existingForDateAndBus.placa}</span> ya tiene una jornada el día <span className="font-bold text-white">{existingForDateAndBus.fecha}</span> por un monto de <span className="font-bold text-emerald-400">{formatVES(existingForDateAndBus.montoVES)}</span>.
                    </div>
                    <div className="text-[11px] text-rose-300/80 font-medium">
                      Un autobús no puede tener dos ingresos del mismo día. Si desea ajustar el monto o los datos, cierre esta ventana y seleccione <strong>Editar</strong> en el registro existente.
                    </div>
                  </div>
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fecha del Ingreso:
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={`w-full bg-[#0B132B] border rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none transition-colors ${
                    existingForDateAndBus
                      ? 'border-rose-500/80 ring-1 ring-rose-500/30'
                      : 'border-slate-700 focus:border-amber-500'
                  }`}
                  required
                />
              </div>

              {/* Autobús */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Autobús (Placa - Modelo - Transporte):
                </label>
                <select
                  value={autobusId}
                  onChange={(e) => setAutobusId(Number(e.target.value))}
                  className={`w-full bg-[#0B132B] border rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none transition-colors ${
                    existingForDateAndBus
                      ? 'border-rose-500/80 ring-1 ring-rose-500/30'
                      : 'border-slate-700 focus:border-amber-500'
                  }`}
                  required
                >
                  <option value="" disabled>
                    Seleccione un autobús
                  </option>
                  {data.autobuses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.placa} - {bus.modelo} ({bus.transporte || bus.alias || 'Unidad'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto en VES */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monto Diario Producido (VES):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={montoVES}
                    onChange={(e) => setMontoVES(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                {parsedVES > 0 && (
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                    Equivalente: ~${calculatedUSD} USD (a tasa Bs. {tasa.toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observaciones / Ruta (Opcional):
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Jornada completa ruta Caracas - Maracay"
                  rows={2}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingIngreso(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || parsedVES <= 0 || !autobusId || !!existingForDateAndBus}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                  title={existingForDateAndBus ? 'El autobús ya tiene un ingreso en esta fecha' : undefined}
                >
                  {saving ? 'Guardando...' : editingIngreso ? 'Guardar Cambios' : 'Registrar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación (Sin window.confirm) */}
      {deletingIngreso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white">¿Eliminar Ingreso Diario?</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-semibold text-white">{deletingIngreso.fecha}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Unidad:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {deletingIngreso.placa} ({deletingIngreso.unidadAlias || 'Transporte'})
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Monto:</span>
                <span className="font-bold text-emerald-400 text-sm">{formatVES(deletingIngreso.montoVES)}</span>
              </div>
              {deletingIngreso.observaciones && (
                <div className="pt-2 border-t border-slate-800 text-slate-400">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Observación:</span>
                  <span>{deletingIngreso.observaciones}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300/90 leading-relaxed">
              El registro será eliminado de la base de datos y se sincronizará con Firebase Firestore en tiempo real.
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingIngreso(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
