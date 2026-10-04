import React, { useState } from 'react';
import { Plus, Wrench, Calendar, Bus, Bell, Trash2, Clock, CheckCircle } from 'lucide-react';
import { DatabaseSchema, Mantenimiento } from '../types/index.ts';
import { API } from '../services/api.ts';
import { getDaysRemainingBadge } from '../utils/formatters.ts';

interface MantenimientoViewProps {
  data: DatabaseSchema;
}

export const MantenimientoView: React.FC<MantenimientoViewProps> = ({ data }) => {
  const [tab, setTab] = useState<'ALARMAS' | 'HISTORIAL'>('ALARMAS');
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [autobusId, setAutobusId] = useState<number | ''>(data.autobuses[0]?.id || '');
  const [tipoMantenimiento, setTipoMantenimiento] = useState(data.tiposMantenimiento[0] || 'CAMBIO FILTROS');
  const [descripcion, setDescripcion] = useState('');
  const [alarmaActiva, setAlarmaActiva] = useState(true);
  const [diasIntervalo, setDiasIntervalo] = useState('30');
  const [kilometraje, setKilometraje] = useState('');
  const [saving, setSaving] = useState(false);

  // KPI counters
  let alDiaCount = 0;
  let porVencerCount = 0;
  let vencidoCount = 0;

  data.mantenimientos.forEach((m) => {
    const badge = getDaysRemainingBadge(m.fechaVencimiento);
    if (badge.type === 'red') vencidoCount++;
    else if (badge.type === 'amber') porVencerCount++;
    else alDiaCount++;
  });

  const displayedList =
    tab === 'ALARMAS'
      ? data.mantenimientos.filter((m) => m.alarmaActiva)
      : data.mantenimientos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autobusId) return;

    const bus = data.autobuses.find((b) => b.id === Number(autobusId));
    if (!bus) return;

    setSaving(true);
    try {
      let fechaVencimiento: string | undefined = undefined;
      if (alarmaActiva) {
        const d = new Date(fecha);
        d.setDate(d.getDate() + (parseInt(diasIntervalo) || 30));
        fechaVencimiento = d.toISOString().split('T')[0];
      }

      await API.addMantenimiento({
        fecha,
        autobusId: bus.id,
        unidadNombre: `${bus.placa} - ${bus.modelo} (${bus.transporte || bus.alias || 'Unidad'})`,
        tipoMantenimiento,
        descripcion,
        alarmaActiva,
        fechaVencimiento,
        kilometraje: kilometraje ? Number(kilometraje) : undefined,
      });

      setShowModal(false);
      setDescripcion('');
      setKilometraje('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar este registro de mantenimiento?')) {
      await API.deleteMantenimiento(id);
    }
  };

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* 3 KPI Counters: AL DÍA, POR VENCER, VENCIDO */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Al Día */}
        <div className="bg-[#1C2541]/90 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider block">
            AL DÍA
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 block mt-0.5">
            {alDiaCount}
          </span>
        </div>

        {/* Por Vencer */}
        <div className="bg-[#1C2541]/90 border border-amber-500/50 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider block">
            POR VENCER
          </span>
          <span className="text-2xl sm:text-3xl font-black text-amber-400 block mt-0.5">
            {porVencerCount}
          </span>
        </div>

        {/* Vencido */}
        <div className="bg-[#1C2541]/90 border border-rose-500/40 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider block">
            VENCIDO
          </span>
          <span className="text-2xl sm:text-3xl font-black text-rose-400 block mt-0.5">
            {vencidoCount}
          </span>
        </div>
      </div>

      {/* Tabs: ALARMAS / HISTORIAL */}
      <div className="flex space-x-2 bg-[#1C2541]/80 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setTab('ALARMAS')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            tab === 'ALARMAS'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ALARMAS ({data.mantenimientos.filter((m) => m.alarmaActiva).length})
        </button>
        <button
          onClick={() => setTab('HISTORIAL')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            tab === 'HISTORIAL'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          HISTORIAL ({data.mantenimientos.length})
        </button>
      </div>

      {/* Table / List */}
      <div className="bg-[#1C2541]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#0B132B]/80 text-slate-400 uppercase text-[10px] sm:text-xs font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Vehículo</th>
                <th className="py-3 px-3">Tipo de Mantenimiento</th>
                <th className="py-3 px-3">Descripción</th>
                <th className="py-3 px-3 text-center">Días p / Vencer</th>
                <th className="py-3 px-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {displayedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                    No hay mantenimientos activos
                  </td>
                </tr>
              ) : (
                displayedList.map((item, index) => {
                  const badge = getDaysRemainingBadge(item.fechaVencimiento);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        #{index + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        #{item.id}
                      </td>
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-xs mr-1.5">
                          {item.unidadNombre}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-amber-300 whitespace-nowrap">
                        {item.tipoMantenimiento}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-xs">
                        <span className="block max-w-xs truncate">{item.descripcion}</span>
                        {item.kilometraje && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Km: {item.kilometraje.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.fechaVencimiento ? (
                          <div>
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide ${
                                badge.type === 'red'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : badge.type === 'amber'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {badge.text}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Vence: {item.fechaVencimiento}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Sin alarma</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Eliminar mantenimiento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-4 sm:right-8 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all"
        aria-label="Registrar Mantenimiento"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal: Registrar Mantenimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-2 border-b border-slate-700 pb-3">
              <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Registrar Mantenimiento</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Fecha del Mantenimiento:
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

              {/* Autobus Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Bus className="w-3.5 h-3.5 text-slate-400" />
                  Seleccione Autobús:
                </label>
                <select
                  value={autobusId}
                  onChange={(e) => setAutobusId(Number(e.target.value))}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
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

              {/* Tipo de Mantenimiento */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Mantenimiento:
                </label>
                <select
                  value={tipoMantenimiento}
                  onChange={(e) => setTipoMantenimiento(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  {data.tiposMantenimiento.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción / Repuestos Utilizados:
                </label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalles del trabajo realizado..."
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Kilometraje */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kilometraje actual (opcional):
                </label>
                <input
                  type="number"
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                  placeholder="Ej: 142500"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Programar Alarma Toggle */}
              <div className="p-3 bg-[#0B132B] rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Programar Alarma</span>
                      <span className="text-[10px] text-slate-400">Alarma activa para próximos días</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alarmaActiva}
                      onChange={(e) => setAlarmaActiva(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {alarmaActiva && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Intervalo para próximo vencimiento (Días):
                    </label>
                    <div className="flex items-center space-x-2">
                      {['7', '15', '30', '60'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDiasIntervalo(d)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            diasIntervalo === d
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {d} d
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !autobusId}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg"
                >
                  {saving ? 'Guardando...' : 'Guardar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
