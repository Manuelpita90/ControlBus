import React, { useState } from 'react';
import {
  DollarSign,
  FileText,
  Calendar,
  CreditCard,
  CheckCircle2,
  History,
  Receipt,
  AlignLeft,
  ArrowDownLeft,
  Clock
} from 'lucide-react';
import { DatabaseSchema, FacturaPorPagar } from '../types/index.ts';
import { API } from '../services/api.ts';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface FacturasViewProps {
  data: DatabaseSchema;
}

export const FacturasView: React.FC<FacturasViewProps> = ({ data }) => {
  const [tab, setTab] = useState<'PENDIENTES' | 'TODAS' | 'HISTORIAL'>('PENDIENTES');
  const [selectedFactura, setSelectedFactura] = useState<FacturaPorPagar | null>(null);
  const [abonoMontoUSD, setAbonoMontoUSD] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [notaAbono, setNotaAbono] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);

  const tasa = data.ajustes.tasaDolar;

  const facturasPendientes = data.facturas.filter((f) => f.estado === 'PENDIENTE' && f.deudaRestanteUSD > 0);
  const deudaTotalUSD = facturasPendientes.reduce((sum, f) => sum + f.deudaRestanteUSD, 0);
  const deudaTotalVES = Math.round(deudaTotalUSD * tasa);

  const displayedFacturas = tab === 'PENDIENTES' ? facturasPendientes : data.facturas;

  const handleOpenAbonar = (f: FacturaPorPagar) => {
    setSelectedFactura(f);
    setAbonoMontoUSD('');
    setNotaAbono('');
  };

  const handleConfirmAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactura) return;
    const monto = parseFloat(abonoMontoUSD.replace(',', '.'));
    if (isNaN(monto) || monto <= 0 || monto > selectedFactura.deudaRestanteUSD + 0.01) {
      alert('Monto de abono inválido o excede la deuda restante.');
      return;
    }

    setSavingAbono(true);
    try {
      await API.addAbono(selectedFactura.id, monto, metodoPago, notaAbono);
      setSelectedFactura(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAbono(false);
    }
  };

  const parsedAbono = parseFloat(abonoMontoUSD.replace(',', '.')) || 0;
  const newDeudaPreview = selectedFactura ? Math.max(0, selectedFactura.deudaRestanteUSD - parsedAbono) : 0;

  return (
    <div className="pb-24 pt-2 px-3 sm:px-6 max-w-7xl mx-auto space-y-4">
      {/* KPI Cards matching Screenshot 7 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Deuda Total */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Deuda Total
            </span>
            <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
            $ {deudaTotalUSD.toFixed(2)} USD
          </div>
          <div className="text-xs sm:text-sm font-bold text-rose-400 mt-0.5">
            Bs. {deudaTotalVES.toLocaleString('es-VE')}
          </div>
        </div>

        {/* Card 2: Facturas Pendientes */}
        <div className="bg-[#1C2541]/90 border border-slate-700/70 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Facturas Pendientes
            </span>
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {facturasPendientes.length} pendientes
          </div>
          <div className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5">
            Crédito a Proveedores
          </div>
        </div>
      </div>

      {/* Filter Tabs matching Screenshot 7 & 8 */}
      <div className="flex space-x-2 bg-[#1C2541]/80 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setTab('PENDIENTES')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            tab === 'PENDIENTES'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          PENDIENTES
        </button>
        <button
          onClick={() => setTab('TODAS')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
            tab === 'TODAS'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          TODAS
        </button>
        <button
          onClick={() => setTab('HISTORIAL')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
            tab === 'HISTORIAL'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>HISTORIAL DE ABONOS</span>
        </button>
      </div>

      {/* Tab: HISTORIAL DE ABONOS (Matches Screenshot 7) */}
      {tab === 'HISTORIAL' ? (
        <div className="space-y-3">
          {data.abonos.length === 0 ? (
            <div className="bg-[#1C2541]/60 border border-slate-800 p-8 rounded-2xl text-center text-slate-400">
              No hay abonos registrados en el historial
            </div>
          ) : (
            data.abonos.map((abono) => {
              const f = data.facturas.find((item) => item.id === abono.facturaId);
              return (
                <div
                  key={abono.id}
                  className="bg-[#1C2541]/95 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex items-center justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Abono a Factura {f ? f.numeroFactura : ''}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {abono.fecha} • <span className="text-slate-300 font-semibold">{abono.metodoPago}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 italic mt-0.5">
                        {abono.nota || 'Abono / Pago de factura'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap pl-2">
                    <span className="text-sm sm:text-base font-black text-emerald-400 block">
                      -${abono.montoUSD.toFixed(2)} USD
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {formatVES(abono.montoVES)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Tab: PENDIENTES / TODAS (Matches Screenshot 8 & 9) */
        <div className="space-y-3">
          {displayedFacturas.length === 0 ? (
            <div className="bg-[#1C2541]/60 border border-slate-800 p-8 rounded-2xl text-center text-slate-400">
              No hay facturas pendientes. Todas las cuentas están al día.
            </div>
          ) : (
            displayedFacturas.map((factura) => {
              const isPaid = factura.deudaRestanteUSD <= 0;
              const pctPaid = factura.montoTotalUSD > 0 ? (factura.montoAbonadoUSD / factura.montoTotalUSD) * 100 : 0;

              return (
                <div
                  key={factura.id}
                  className="bg-[#1C2541]/95 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3"
                >
                  {/* Top Line: Icon, Factura Number, Provider, Status Badge, Abonar button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                      </div>
                      <span className="font-mono font-bold text-white text-base">
                        {factura.numeroFactura}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {factura.estado}
                      </span>

                      {!isPaid && (
                        <button
                          onClick={() => handleOpenAbonar(factura)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Abonar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Provider Name in Large Orange Font */}
                  <div>
                    <h3 className="font-black text-amber-400 text-lg uppercase tracking-wide">
                      {factura.proveedor}
                    </h3>
                    {(factura.description || factura.concepto) && (
                      <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <AlignLeft className="w-3.5 h-3.5 text-slate-500" />
                        <span>{factura.description || factura.concepto}</span>
                      </p>
                    )}
                  </div>

                  {/* Inner Details Box matching Screenshot 9 */}
                  <div className="bg-[#0B132B]/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex justify-between items-baseline">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Deuda Restante
                        </span>
                        <span
                          className={`text-base sm:text-lg font-black ${
                            isPaid ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          $ {factura.deudaRestanteUSD.toFixed(2)} USD
                        </span>
                        <span className="text-xs text-cyan-400 block font-semibold">
                          ≈ {formatVES(factura.deudaRestanteVES || factura.deudaRestanteUSD * tasa)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Monto Total
                        </span>
                        <span className="text-sm sm:text-base font-black text-white block">
                          $ {factura.montoTotalUSD.toFixed(2)} USD
                        </span>
                        <span className="text-xs text-emerald-400 font-bold block">
                          Abonado: $ {factura.montoAbonadoUSD.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, pctPaid)}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates Footer */}
                  <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 font-mono">
                    <span>📅 Emisión: {factura.fechaEmision}</span>
                    <span>Vence: {factura.fechaVencimiento || 'N/A'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Abonar a Factura */}
      {selectedFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-700 pb-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  Abonar a Factura {selectedFactura.numeroFactura}
                </h3>
                <p className="text-xs text-slate-400">Proveedor: {selectedFactura.proveedor}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmAbono} className="space-y-3.5">
              {/* Resumen Deuda */}
              <div className="bg-[#0B132B] p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block">Deuda Actual:</span>
                  <span className="text-base font-black text-rose-400">
                    $ {selectedFactura.deudaRestanteUSD.toFixed(2)} USD
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Nueva Deuda:</span>
                  <span className="text-base font-black text-cyan-400">
                    $ {newDeudaPreview.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Monto del Abono */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monto a Abonar en Dólares ($ USD):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedFactura.deudaRestanteUSD}
                    value={abonoMontoUSD}
                    onChange={(e) => setAbonoMontoUSD(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                {parsedAbono > 0 && (
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                    Equivale a: {formatVES(parsedAbono * tasa)} (a tasa Bs. {tasa.toLocaleString('es-VE')})
                  </div>
                )}
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Método de Pago:
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="Transferencia">Transferencia</option>
                  <option value="Pago Móvil">Pago Móvil</option>
                  <option value="Efectivo USD">Efectivo USD</option>
                  <option value="Efectivo VES">Efectivo VES</option>
                </select>
              </div>

              {/* Nota */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nota / Referencia de Pago (Opcional):
                </label>
                <input
                  type="text"
                  value={notaAbono}
                  onChange={(e) => setNotaAbono(e.target.value)}
                  placeholder="Ej: Transferencia Banco Banesco ref 9821"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFactura(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAbono || parsedAbono <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  {savingAbono ? 'Guardando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
