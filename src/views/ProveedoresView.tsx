import React, { useState } from 'react';
import { Store, Plus, Phone, MapPin, Edit2, Trash2, ShieldCheck, User, Hash, CheckCircle2 } from 'lucide-react';
import { DatabaseSchema, Proveedor } from '../types/index.ts';
import { API } from '../services/api.ts';

interface ProveedoresViewProps {
  data: DatabaseSchema;
}

export const ProveedoresView: React.FC<ProveedoresViewProps> = ({ data }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Proveedor | null>(null);

  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [categoria, setCategoria] = useState(data.categoriasGastos[0] || 'GENERAL');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = () => {
    setEditingProvider(null);
    setNombre('');
    setContacto('');
    setCategoria('GENERAL');
    setTelefono('');
    setDireccion('');
    setShowModal(true);
  };

  const handleOpenEdit = (p: Proveedor) => {
    setEditingProvider(p);
    setNombre(p.name || p.nombre || '');
    setContacto(p.contactPerson || p.contacto || '');
    setCategoria(p.category || p.categoria || 'GENERAL');
    setTelefono(p.phone || p.telefono || '');
    setDireccion(p.direccion || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setSaving(true);
    try {
      if (editingProvider) {
        await API.updateProveedor(editingProvider.id, {
          name: nombre.trim().toUpperCase(),
          nombre: nombre.trim().toUpperCase(),
          contactPerson: contacto.trim().toUpperCase() || 'NO APLICA',
          contacto: contacto.trim().toUpperCase() || 'NO APLICA',
          category: categoria.trim().toUpperCase(),
          categoria: categoria.trim().toUpperCase(),
          phone: telefono.trim() || 'NO APLICA',
          telefono: telefono.trim() || 'NO APLICA',
          direccion: direccion.trim(),
        });
      } else {
        await API.addProveedor({
          name: nombre.trim().toUpperCase(),
          nombre: nombre.trim().toUpperCase(),
          contactPerson: contacto.trim().toUpperCase() || 'NO APLICA',
          contacto: contacto.trim().toUpperCase() || 'NO APLICA',
          category: categoria.trim().toUpperCase(),
          categoria: categoria.trim().toUpperCase(),
          phone: telefono.trim() || 'NO APLICA',
          telefono: telefono.trim() || 'NO APLICA',
          registerCount: 1,
          direccion: direccion.trim(),
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error guardando proveedor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Proveedor) => {
    const provName = (p.name || p.nombre || '').toUpperCase();
    const relatedExpenses = data.gastos.filter(
      (g) => (g.providerName || g.proveedor || '').toUpperCase() === provName
    ).length;
    const relatedInvoices = data.facturas.filter(
      (f) => (f.providerName || f.proveedor || '').toUpperCase() === provName
    ).length;

    let confirmMsg = `¿Eliminar el proveedor oficial "${provName}"?`;
    if (relatedExpenses > 0 || relatedInvoices > 0) {
      confirmMsg += `\n\nAtención: Tiene ${relatedExpenses} gasto(s) y ${relatedInvoices} factura(s) asociadas.`;
    }

    if (window.confirm(confirmMsg)) {
      try {
        await API.deleteProveedor(p.id);
      } catch (err) {
        console.error('Error eliminando proveedor:', err);
      }
    }
  };

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-400" />
              <span>Proveedores Registrados ({data.proveedores.length})</span>
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              100% Reales (SQLite & Firestore)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Registro oficial de proveedores sin entidades inferidas ni duplicadas
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {data.proveedores.map((p) => {
          const provName = p.name || p.nombre || '';
          const contactPerson = p.contactPerson || p.contacto || 'NO APLICA';
          const phone = p.phone || p.telefono || 'NO APLICA';
          const category = p.category || p.categoria || 'GENERAL';
          const registerCount = p.registerCount ?? 1;

          const relatedExpenses = data.gastos.filter(
            (g) => (g.providerName || g.proveedor || '').toUpperCase() === provName.toUpperCase()
          ).length;
          const relatedInvoices = data.facturas.filter(
            (f) => (f.providerName || f.proveedor || '').toUpperCase() === provName.toUpperCase()
          ).length;

          return (
            <div
              key={p.id}
              className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 shadow-lg space-y-2.5 relative overflow-hidden group hover:border-amber-500/50 transition-colors"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-[#0B132B] text-amber-400 border border-slate-800 shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        #{p.id}
                      </span>
                      <h4 className="font-black text-sm text-white truncate">{provName}</h4>
                    </div>
                    <span className="inline-block text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-0.5">
                      {category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors"
                    title="Editar Proveedor"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                    title="Eliminar Proveedor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Provider Info */}
              <div className="text-xs text-slate-300 space-y-1.5 pt-0.5">
                <div className="flex items-center space-x-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    <span className="text-slate-400 text-[11px]">Contacto:</span>{' '}
                    <strong className="text-white font-medium">{contactPerson}</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="font-mono text-slate-200 text-[11px]">{phone}</span>
                </div>

                {p.direccion && (
                  <div className="flex items-center space-x-2 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate text-[11px]">{p.direccion}</span>
                  </div>
                )}
              </div>

              {/* Counts footer */}
              <div className="bg-[#0B132B]/70 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span>Reg: <strong className="text-white">{registerCount}</strong></span>
                </div>
                <div>
                  <span>Gastos: <strong className="text-emerald-400">{relatedExpenses}</strong></span>
                </div>
                <div>
                  <span>Facturas: <strong className="text-amber-400">{relatedInvoices}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit Provider */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-white">
                  {editingProvider ? 'Editar Proveedor' : 'Registrar Proveedor Real'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Comercial / Razón Social:</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: LA FORTALEZA, DIESEL CENTRAL, etc."
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm uppercase focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Persona de Contacto / Encargado:</label>
                <input
                  type="text"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Ej: NOELVIS, YARELIS, ANGEL SANGRONIS"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs uppercase focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría:</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="REPUESTOS">REPUESTOS</option>
                    <option value="LUBRICANTES">LUBRICANTES</option>
                    <option value="DIESEL">DIESEL</option>
                    <option value="CAUCHERA">CAUCHERA</option>
                    <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                    <option value="FINANZAS">FINANZAS</option>
                    <option value="OTROS">OTROS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono:</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="(0412-853,45,98)"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección / Ubicación (Opcional):</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Zona industrial o avenida principal"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl text-sm hover:from-amber-600 hover:to-orange-700 transition-all shadow-md"
                >
                  {saving ? 'Guardando...' : editingProvider ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
