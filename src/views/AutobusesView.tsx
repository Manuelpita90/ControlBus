import React, { useState } from 'react';
import { Bus, Plus, Edit2, Trash2, CheckCircle, Wrench, Ban, AlertCircle } from 'lucide-react';
import { DatabaseSchema, Autobus, AutobusEstado } from '../types/index.ts';
import { API } from '../services/api.ts';
import { formatVES } from '../utils/formatters.ts';

interface AutobusesViewProps {
  data: DatabaseSchema;
  onSelectBusQuickReport?: (bus: Autobus) => void;
}

export const AutobusesView: React.FC<AutobusesViewProps> = ({ data, onSelectBusQuickReport }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingBus, setEditingBus] = useState<Autobus | null>(null);

  // Form states: ONLY placa, modelo, transporte, estado
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [transporte, setTransporte] = useState('');
  const [estado, setEstado] = useState<AutobusEstado>('activo');
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = () => {
    setEditingBus(null);
    setPlaca('');
    setModelo('');
    setTransporte('');
    setEstado('activo');
    setShowModal(true);
  };

  const handleOpenEdit = (bus: Autobus) => {
    setEditingBus(bus);
    setPlaca(bus.placa);
    setModelo(bus.modelo || '');
    setTransporte(bus.transporte || bus.alias || '');
    // Normalize legacy state
    if ((bus.estado as string) === 'mantenimiento') {
      setEstado('en taller');
    } else if (bus.estado === 'inactivo' || (bus.estado as string) === 'inativo') {
      setEstado('inactivo');
    } else {
      setEstado('activo');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim() || !modelo.trim() || !transporte.trim()) return;

    setSaving(true);
    try {
      const busData = {
        placa: placa.toUpperCase().trim(),
        modelo: modelo.trim(),
        transporte: transporte.trim(),
        estado: estado,
        alias: transporte.trim(), // for backward compatibility with existing views
        numero: '',
      };

      if (editingBus) {
        await API.updateAutobus(editingBus.id, busData as any);
      } else {
        await API.addAutobus(busData as any);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error guardando autobús:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Eliminar este autobús de la flota?')) {
      try {
        await API.deleteAutobus(id);
      } catch (err) {
        console.error('Error eliminando autobús:', err);
      }
    }
  };

  const getEstadoBadge = (st: AutobusEstado | string) => {
    if (st === 'activo') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Activo</span>
        </span>
      );
    }
    if (st === 'en taller' || st === 'mantenimiento') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40">
          <Wrench className="w-3.5 h-3.5" />
          <span>En Taller</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/40">
        <Ban className="w-3.5 h-3.5" />
        <span>Inactivo</span>
      </span>
    );
  };

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Bus className="w-5 h-5 text-cyan-400" />
            <span>Gestión de Autobuses ({data.autobuses.length})</span>
          </h2>
          <p className="text-xs text-slate-400">Control de flota y asignación de unidades de transporte</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Autobús</span>
        </button>
      </div>

      {/* Grid of Buses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.autobuses.map((bus) => {
          const busTransporte = bus.transporte || bus.alias || 'Transporte General';
          const ingresosTotales = data.ingresos
            .filter((i) => i.autobusId === bus.id)
            .reduce((s, i) => s + i.montoVES, 0);
          const reportesCount = data.ingresos.filter((i) => i.autobusId === bus.id).length;

          return (
            <div
              key={bus.id}
              className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* Top Row: Placa and Status Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2.5 bg-[#0B132B] rounded-xl text-amber-400 border border-slate-800">
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      {/* Placa Badge */}
                      <span className="text-base sm:text-lg font-black text-white tracking-wider font-mono bg-slate-900/80 px-2.5 py-0.5 rounded-lg border border-slate-700 block">
                        {bus.placa}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {getEstadoBadge(bus.estado)}
                    <button
                      onClick={() => handleOpenEdit(bus)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors ml-1"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(bus.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details: Modelo & Transporte */}
                <div className="bg-[#0B132B]/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Modelo:</span>
                    <span className="font-bold text-white text-sm">{bus.modelo || 'No especificado'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Transporte:</span>
                    <span className="font-bold text-cyan-300 text-xs truncate max-w-[180px]">{busTransporte}</span>
                  </div>
                </div>

                {/* Performance stats */}
                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>Reportes: <strong className="text-white">{reportesCount}</strong></span>
                  <span>Ingresos: <strong className="text-emerald-400 font-bold">{formatVES(ingresosTotales)}</strong></span>
                </div>
              </div>

              {/* Quick Report Button */}
              {bus.estado === 'activo' && onSelectBusQuickReport && (
                <button
                  onClick={() => onSelectBusQuickReport(bus)}
                  className="w-full mt-2 py-2 bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 text-slate-200 hover:text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Reportar Ingreso Hoy</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit Bus (ONLY: Placa, Modelo, Transporte, Estado) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingBus ? 'Editar Autobús' : 'Registrar Nuevo Autobús'}
                  </h3>
                  <p className="text-xs text-slate-400">Ingrese los datos básicos de la unidad</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* 1. Placa */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Placa de la Unidad:
                </label>
                <input
                  type="text"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="Ej: 36AA67R"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm tracking-wider uppercase focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* 2. Modelo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Modelo:
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ej: Encava NT-610, Yutong, etc."
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* 3. Transporte */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transporte (Línea / Empresa / Cooperativa):
                </label>
                <input
                  type="text"
                  value={transporte}
                  onChange={(e) => setTransporte(e.target.value)}
                  placeholder="Ej: Línea Unión Central, Transporte Bolívar"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* 4. Estado */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estado Operativo:
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as AutobusEstado)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="activo">🟢 Activo</option>
                  <option value="en taller">🟡 En Taller</option>
                  <option value="inactivo">🔴 Inactivo</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  {saving ? 'Guardando...' : editingBus ? 'Guardar Cambios' : 'Registrar Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
