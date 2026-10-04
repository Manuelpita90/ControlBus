import React, { useState, useMemo } from 'react';
import {
  Lock,
  DollarSign,
  TrendingUp,
  Wallet,
  Calendar,
  Trash2,
  AlertCircle,
  Plus,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertTriangle,
  History,
} from 'lucide-react';
import { DatabaseSchema, RetiroUtilidad } from '../types/index.ts';
import { API } from '../services/api.ts';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface ContabilidadViewProps {
  data: DatabaseSchema;
}

export const ContabilidadView: React.FC<ContabilidadViewProps> = ({ data }) => {
  const [subTab, setSubTab] = useState<'RETIROS' | 'AUTOBUS' | 'GASTOS' | 'CIERRES'>('RETIROS');
  const [selectedPeriod, setSelectedPeriod] = useState<'ESTE_MES' | 'HISTORIAL' | 'MES_ANTERIOR'>('ESTE_MES');

  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [showFondoModal, setShowFondoModal] = useState(false);
  const [deletingRetiro, setDeletingRetiro] = useState<RetiroUtilidad | null>(null);
  const [deletingRetiroLoading, setDeletingRetiroLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Retiro form
  const [fechaRetiro, setFechaRetiro] = useState(new Date().toISOString().split('T')[0]);
  const [beneficiario, setBeneficiario] = useState('Dueño / Propietario');
  const [montoRetiroVES, setMontoRetiroVES] = useState('');
  const [conceptoRetiro, setConceptoRetiro] = useState('Retiro de utilidad');
  const [savingRetiro, setSavingRetiro] = useState(false);

  // Fondo form
  const [montoFondoVES, setMontoFondoVES] = useState('');
  const [motivoFondo, setMotivoFondo] = useState('');
  const [savingFondo, setSavingFondo] = useState(false);

  const tasa = data.ajustes.tasaDolar;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Determine current active month and previous month
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const prevMonthKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const getMonthName = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    const names: Record<string, string> = {
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
    return `${names[m] || m} ${y}`;
  };

  const currentMonthLabel = getMonthName(currentMonthKey);
  const prevMonthLabel = getMonthName(prevMonthKey);

  // Previous monthly closure baseline balance (saldo inicial arrastrado del cierre anterior)
  const closuresList = useMemo(() => {
    return (data.monthlyClosures || []).filter((c: any) => c && c.closureDate);
  }, [data.monthlyClosures]);

  const latestClosure = useMemo(() => {
    if (!closuresList || closuresList.length === 0) return null;
    // Prefer closure with valid positive remaining balance and latest timestamp/date
    return [...closuresList].sort((a: any, b: any) => {
      // Prioritize positive balances over 0
      if ((b.remainingBalanceVES || 0) > 0 && (a.remainingBalanceVES || 0) <= 0) return 1;
      if ((a.remainingBalanceVES || 0) > 0 && (b.remainingBalanceVES || 0) <= 0) return -1;
      const dateA = new Date(a.updatedAt || a.closureDate || 0).getTime();
      const dateB = new Date(b.updatedAt || b.closureDate || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    })[0];
  }, [closuresList]);

  // Financial calculations filtered dynamically by period
  const accounting = useMemo(() => {
    if (selectedPeriod === 'ESTE_MES') {
      const ingresos = data.ingresos.filter((i) => (i.fecha || (i as any).date || '').startsWith(currentMonthKey));
      const gastos = data.gastos.filter((g) => (g.fecha || (g as any).date || '').startsWith(currentMonthKey));
      const abonos = data.abonos.filter((a) => (a.fecha || (a as any).date || '').startsWith(currentMonthKey));
      const retiros = data.retiros.filter((r) => (r.fecha || (r as any).date || '').startsWith(currentMonthKey));

      const totalIngresosVES = ingresos.reduce((s, i) => s + (i.montoVES || 0), 0);
      const gastosContadoVES = gastos
        .filter((g) => g.tipoPago === 'CONTADO')
        .reduce((s, g) => s + (g.montoVES || 0), 0);
      const abonosVES = abonos.reduce(
        (s, a) => s + (a.montoVES || ((a.montoUSD || 0) * (a.tasaCambio || tasa)) || 0),
        0
      );
      const totalRetiradoVES = retiros.reduce((s, r) => s + (r.montoVES || 0), 0);

      // Saldo inicial en caja que viene del cierre de mes anterior (Septiembre 2026: Bs. 297.722,15)
      const saldoInicialCajaVES = latestClosure?.remainingBalanceVES ?? 297722.15;
      const saldoInicialCajaUSD = Number((saldoInicialCajaVES / tasa).toFixed(2));

      // Utilidad operativa del mes actual = Ingresos - Gastos Contado - Abonos
      const utilidadOperativaVES = totalIngresosVES - gastosContadoVES - abonosVES;
      const utilidadOperativaUSD = Number((utilidadOperativaVES / tasa).toFixed(2));

      // Disponibilidad en Caja = Saldo inicial + Utilidad del mes - Retiros
      const saldoRemanenteVES = Math.max(0, saldoInicialCajaVES + utilidadOperativaVES - totalRetiradoVES);
      const saldoRemanenteUSD = Number((saldoRemanenteVES / tasa).toFixed(2));

      return {
        label: `${currentMonthLabel} (Mes actual en curso)`,
        saldoInicialCajaVES,
        saldoInicialCajaUSD,
        hasSaldoInicial: saldoInicialCajaVES > 0,
        totalIngresosVES,
        totalIngresosUSD: Number((totalIngresosVES / tasa).toFixed(2)),
        gastosContadoVES,
        gastosContadoUSD: Number((gastosContadoVES / tasa).toFixed(2)),
        abonosVES,
        abonosUSD: Number((abonosVES / tasa).toFixed(2)),
        utilidadOperativaVES,
        utilidadOperativaUSD,
        totalRetiradoVES,
        totalRetiradoUSD: Number((totalRetiradoVES / tasa).toFixed(2)),
        saldoRemanenteVES,
        saldoRemanenteUSD,
        ingresos,
        gastos,
        retiros,
      };
    }

    if (selectedPeriod === 'MES_ANTERIOR') {
      const ingresos = data.ingresos.filter((i) => (i.fecha || (i as any).date || '').startsWith(prevMonthKey));
      const gastos = data.gastos.filter((g) => (g.fecha || (g as any).date || '').startsWith(prevMonthKey));
      const abonos = data.abonos.filter((a) => (a.fecha || (a as any).date || '').startsWith(prevMonthKey));
      const retiros = data.retiros.filter((r) => (r.fecha || (r as any).date || '').startsWith(prevMonthKey));

      const totalIngresosVES = ingresos.reduce((s, i) => s + (i.montoVES || 0), 0);
      const gastosContadoVES = gastos
        .filter((g) => g.tipoPago === 'CONTADO')
        .reduce((s, g) => s + (g.montoVES || 0), 0);
      const abonosVES = abonos.reduce(
        (s, a) => s + (a.montoVES || ((a.montoUSD || 0) * (a.tasaCambio || tasa)) || 0),
        0
      );
      const totalRetiradoVES = retiros.reduce((s, r) => s + (r.montoVES || 0), 0);

      const utilidadOperativaVES = totalIngresosVES - gastosContadoVES - abonosVES;
      const utilidadOperativaUSD = Number((utilidadOperativaVES / tasa).toFixed(2));

      const saldoRemanenteVES = Math.max(0, utilidadOperativaVES - totalRetiradoVES);
      const saldoRemanenteUSD = Number((saldoRemanenteVES / tasa).toFixed(2));

      return {
        label: `${prevMonthLabel} (Mes cerrado)`,
        saldoInicialCajaVES: 0,
        saldoInicialCajaUSD: 0,
        hasSaldoInicial: false,
        totalIngresosVES,
        totalIngresosUSD: Number((totalIngresosVES / tasa).toFixed(2)),
        gastosContadoVES,
        gastosContadoUSD: Number((gastosContadoVES / tasa).toFixed(2)),
        abonosVES,
        abonosUSD: Number((abonosVES / tasa).toFixed(2)),
        utilidadOperativaVES,
        utilidadOperativaUSD,
        totalRetiradoVES,
        totalRetiradoUSD: Number((totalRetiradoVES / tasa).toFixed(2)),
        saldoRemanenteVES,
        saldoRemanenteUSD,
        ingresos,
        gastos,
        retiros,
      };
    }

    // Default: 'HISTORIAL' (All Time Real DB Calculation)
    const ingresos = data.ingresos;
    const gastos = data.gastos;
    const abonos = data.abonos;
    const retiros = data.retiros;

    const totalIngresosVES = ingresos.reduce((s, i) => s + (i.montoVES || 0), 0);
    const gastosContadoVES = gastos
      .filter((g) => g.tipoPago === 'CONTADO')
      .reduce((s, g) => s + (g.montoVES || 0), 0);
    const abonosVES = abonos.reduce(
      (s, a) => s + (a.montoVES || ((a.montoUSD || 0) * (a.tasaCambio || tasa)) || 0),
      0
    );
    const totalRetiradoVES = retiros.reduce((s, r) => s + (r.montoVES || 0), 0);

    const utilidadOperativaVES = totalIngresosVES - gastosContadoVES - abonosVES;
    const utilidadOperativaUSD = Number((utilidadOperativaVES / tasa).toFixed(2));

    const saldoRemanenteVES = Math.max(0, utilidadOperativaVES - totalRetiradoVES);
    const saldoRemanenteUSD = Number((saldoRemanenteVES / tasa).toFixed(2));

    return {
      label: 'Todo el Historial (Acumulado Total)',
      saldoInicialCajaVES: 0,
      saldoInicialCajaUSD: 0,
      hasSaldoInicial: false,
      totalIngresosVES,
      totalIngresosUSD: Number((totalIngresosVES / tasa).toFixed(2)),
      gastosContadoVES,
      gastosContadoUSD: Number((gastosContadoVES / tasa).toFixed(2)),
      abonosVES,
      abonosUSD: Number((abonosVES / tasa).toFixed(2)),
      utilidadOperativaVES,
      utilidadOperativaUSD,
      totalRetiradoVES,
      totalRetiradoUSD: Number((totalRetiradoVES / tasa).toFixed(2)),
      saldoRemanenteVES,
      saldoRemanenteUSD,
      ingresos,
      gastos,
      retiros,
    };
  }, [selectedPeriod, data.ingresos, data.gastos, data.abonos, data.retiros, currentMonthKey, prevMonthKey, currentMonthLabel, prevMonthLabel, latestClosure, tasa]);

  const handleRetiroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(montoRetiroVES.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    if (val > accounting.saldoRemanenteVES) {
      showToast('El monto supera la disponibilidad en caja disponible.', 'error');
      return;
    }

    setSavingRetiro(true);
    try {
      await API.addRetiro({
        fecha: fechaRetiro,
        beneficiario,
        concepto: conceptoRetiro,
        montoVES: val,
        tasaCambio: tasa,
      });
      showToast('Retiro de utilidad registrado correctamente', 'success');
      setShowRetiroModal(false);
      setMontoRetiroVES('');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al registrar retiro', 'error');
    } finally {
      setSavingRetiro(false);
    }
  };

  const handleConfirmDeleteRetiro = async () => {
    if (!deletingRetiro) return;
    setDeletingRetiroLoading(true);
    try {
      await API.deleteRetiro(deletingRetiro.id);
      showToast(`Retiro #${deletingRetiro.id} eliminado correctamente`, 'success');
      setDeletingRetiro(null);
    } catch (err: any) {
      console.error(err);
      showToast('Error al eliminar retiro', 'error');
    } finally {
      setDeletingRetiroLoading(false);
    }
  };

  const handleUsarFondo = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(montoFondoVES.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    setSavingFondo(true);
    try {
      const ok = await API.usarFondoReserva(val, motivoFondo);
      if (!ok) {
        showToast('Saldo insuficiente en el fondo de reserva.', 'error');
      } else {
        showToast('Uso de fondo de reserva registrado exitosamente', 'success');
        setShowFondoModal(false);
        setMontoFondoVES('');
        setMotivoFondo('');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al procesar fondo', 'error');
    } finally {
      setSavingFondo(false);
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

      {/* Top Banner Tasa Oficial */}
      <div className="bg-[#1C2541]/90 border border-amber-500/30 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-amber-200 flex items-center space-x-2.5 shadow-md">
        <DollarSign className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="font-medium">
          Atención: Tasa Oficial en Sistema:{' '}
          <strong className="text-white font-bold">
            Bs. {tasa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} por USD
          </strong>{' '}
          (Valores y conversiones calculados en tiempo real)
        </span>
      </div>

      {/* Period Selector Tabs */}
      <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-md">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-300">Período Contable:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedPeriod('ESTE_MES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedPeriod === 'ESTE_MES'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Este mes ({currentMonthLabel})
          </button>
          <button
            onClick={() => setSelectedPeriod('HISTORIAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedPeriod === 'HISTORIAL'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todo el Historial (Acumulado)
          </button>
          <button
            onClick={() => setSelectedPeriod('MES_ANTERIOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedPeriod === 'MES_ANTERIOR'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Mes anterior ({prevMonthLabel})
          </button>
        </div>
      </div>

      {/* Cierre de Mes y Período */}
      <div className="bg-[#1C2541]/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Cierre de Mes y Período Contable
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-bold text-cyan-300">
            {accounting.label}
          </span>
        </div>

        <div className="bg-[#0B132B]/80 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Cierre de mes desactivado. Se activa automáticamente los días 1 de cada mes para consolidar el período.
            </span>
          </div>
          <button
            onClick={() => setSubTab('CIERRES')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-colors"
          >
            Cierres ({closuresList.length})
          </button>
        </div>
      </div>

      {/* Disponibilidad en Caja (Saldo Remanente) */}
      <div className="bg-gradient-to-br from-[#1C2541] to-[#121B36] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Disponibilidad en Caja (Saldo Remanente)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
            Efectivo Disponible
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-2">
          Fondo real en efectivo disponible en caja de la empresa para {accounting.label}
        </p>

        <div className="my-3 bg-[#0B132B]/80 p-4 rounded-xl border border-emerald-500/30 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Monto en Efectivo Disponible:
          </span>
          <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
            {formatVES(accounting.saldoRemanenteVES)}
          </div>
          <div className="inline-block px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-xs font-bold text-emerald-300">
            Equivalencia en Dólares: {formatUSD(accounting.saldoRemanenteUSD)}
          </div>
        </div>

        {/* Breakdown of Cash Flow */}
        <div className="bg-[#0B132B]/60 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 mt-2">
          {accounting.hasSaldoInicial && (
            <div className="flex justify-between items-center text-cyan-300 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
              <span className="font-semibold">(+) Saldo Inicial en Caja (Cierre Anterior):</span>
              <span className="font-bold">{formatVES(accounting.saldoInicialCajaVES)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-slate-400">
            <span>(+) Total Ingresos en Efectivo ({accounting.ingresos.length} jornadas):</span>
            <span className="font-bold text-emerald-400">{formatVES(accounting.totalIngresosVES)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span>(-) Gastos de Contado Pagados:</span>
            <span className="font-bold text-rose-400">-{formatVES(accounting.gastosContadoVES)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span>(-) Abonos a Facturas Pagados:</span>
            <span className="font-bold text-rose-400">-{formatVES(accounting.abonosVES)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-300 pt-1.5 border-t border-slate-800 font-semibold">
            <span>(=) Utilidad Operativa del Período:</span>
            <span className="font-bold text-cyan-400">
              {formatVES(accounting.utilidadOperativaVES)} ({formatUSD(accounting.utilidadOperativaUSD)})
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-400">
            <span>(-) Total Retirado por Dueño ({accounting.retiros.length} retiros):</span>
            <span className="font-bold text-rose-400">
              -{formatVES(accounting.totalRetiradoVES)} ({formatUSD(accounting.totalRetiradoUSD)})
            </span>
          </div>

          <div className="flex justify-between items-center text-white pt-2 border-t border-emerald-500/40 font-bold bg-emerald-950/30 p-2 rounded-lg">
            <span className="text-emerald-300">(=) Saldo Remanente en Caja:</span>
            <span className="text-emerald-400 font-black text-sm sm:text-base">
              {formatVES(accounting.saldoRemanenteVES)}
            </span>
          </div>
        </div>
      </div>

      {/* Distribución de Utilidades */}
      <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-sm sm:text-base text-white">
            Distribución de Utilidades
          </h3>
        </div>

        <div className="space-y-2 bg-[#0B132B]/60 p-3.5 rounded-xl border border-slate-800 text-xs sm:text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Utilidad Operativa del Período:</span>
            <div className="text-right">
              <span className="font-black text-cyan-400 block">{formatVES(accounting.utilidadOperativaVES)}</span>
              <span className="text-[11px] text-slate-400 font-semibold">{formatUSD(accounting.utilidadOperativaUSD)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
            <span className="text-slate-400">Retiros del Período:</span>
            <div className="text-right">
              <span className="font-black text-rose-400 block">{formatVES(accounting.totalRetiradoVES)}</span>
              <span className="text-[11px] text-slate-400 font-semibold">{formatUSD(accounting.totalRetiradoUSD)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 font-semibold">Total Histórico Retirado:</span>
            <div className="text-right">
              <span className="font-black text-white block">
                {formatVES(data.retiros.reduce((s, r) => s + (r.montoVES || 0), 0))}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {formatUSD(Number((data.retiros.reduce((s, r) => s + (r.montoVES || 0), 0) / tasa).toFixed(2)))}
              </span>
            </div>
          </div>
        </div>

        {/* Realizar Retiro de Utilidad Button */}
        <button
          onClick={() => setShowRetiroModal(true)}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2"
        >
          <ArrowDownRight className="w-5 h-5" />
          <span>Realizar Retiro de Utilidad</span>
        </button>
      </div>

      {/* Fondo de Reserva */}
      <div className="bg-[#1C2541]/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Fondo de Reserva
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {data.ajustes.fondoReservaPct}% retenido
          </span>
        </div>

        <div className="flex items-center justify-between bg-[#0B132B]/60 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Saldo Disponible:
            </span>
            <span className="text-lg font-black text-cyan-400 block">
              {formatVES(data.fondoReserva.saldoVES)}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {formatUSD(data.fondoReserva.saldoUSD)}
            </span>
          </div>

          <button
            onClick={() => setShowFondoModal(true)}
            disabled={data.fondoReserva.saldoVES <= 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Usar Fondo
          </button>
        </div>
      </div>

      {/* Sub-tabs: RETIROS / POR AUTOBÚS / GASTOS / CIERRES */}
      <div className="flex space-x-2 bg-[#1C2541]/80 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setSubTab('RETIROS')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            subTab === 'RETIROS'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          RETIROS ({data.retiros.length})
        </button>
        <button
          onClick={() => setSubTab('AUTOBUS')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            subTab === 'AUTOBUS'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          POR AUTOBÚS
        </button>
        <button
          onClick={() => setSubTab('GASTOS')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            subTab === 'GASTOS'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          GASTOS
        </button>
        <button
          onClick={() => setSubTab('CIERRES')}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            subTab === 'CIERRES'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          CIERRES ({closuresList.length})
        </button>
      </div>

      {/* Content depending on sub-tab */}
      {subTab === 'RETIROS' && (
        <div className="space-y-2.5">
          {data.retiros.length === 0 ? (
            <div className="bg-[#1C2541]/60 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 text-xs">
              No hay retiros registrados.
            </div>
          ) : (
            data.retiros.map((retiro) => (
              <div
                key={retiro.id}
                className="bg-[#1C2541]/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow hover:bg-slate-850 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-white">
                      {retiro.concepto}
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {retiro.fecha} • {retiro.beneficiario}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-sm font-black text-rose-400 block">
                      -{formatVES(retiro.montoVES)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold block">
                      -{formatUSD(retiro.montoUSD)}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeletingRetiro(retiro)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                    title="Eliminar retiro"
                    aria-label="Eliminar retiro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'AUTOBUS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.autobuses.map((bus) => {
            const busIngresos = accounting.ingresos
              .filter((i) => i.autobusId === bus.id || i.placa === bus.placa)
              .reduce((s, i) => s + i.montoVES, 0);
            const busGastos = accounting.gastos
              .filter((g) => g.autobusId === bus.id || (bus.placa && g.unidadNombre?.includes(bus.placa)))
              .reduce((s, g) => s + g.montoVES, 0);
            const busBalance = busIngresos - busGastos;

            return (
              <div
                key={bus.id}
                className="bg-[#1C2541]/90 border border-slate-800 rounded-xl p-4 space-y-2 shadow"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">
                    {bus.placa} - {bus.modelo} ({bus.transporte || bus.alias || 'Unidad'})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                    {bus.estado}
                  </span>
                </div>
                <div className="text-xs space-y-1.5 pt-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Ingresos generados:</span>
                    <span className="text-emerald-400 font-bold">{formatVES(busIngresos)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gastos directos:</span>
                    <span className="text-rose-400 font-bold">{formatVES(busGastos)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                    <span className="text-white">Rendimiento Operativo:</span>
                    <span className={busBalance >= 0 ? 'text-cyan-400' : 'text-rose-400'}>
                      {formatVES(busBalance)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'GASTOS' && (
        <div className="bg-[#1C2541]/80 rounded-xl p-4 border border-slate-800 text-xs space-y-2">
          <h4 className="font-bold text-white text-sm">Resumen de Gastos en {accounting.label}</h4>
          <div className="space-y-1 pt-1 text-slate-300">
            <p>
              Total pagado en efectivo de caja (Contado):{' '}
              <strong className="text-rose-400">{formatVES(accounting.gastosContadoVES)}</strong>
            </p>
            <p>
              Total abonos pagados a facturas:{' '}
              <strong className="text-rose-400">{formatVES(accounting.abonosVES)}</strong>
            </p>
            <p className="pt-1 text-slate-400 border-t border-slate-800">
              Registros procesados: {accounting.gastos.length} gastos operativos en el período seleccionado.
            </p>
          </div>
        </div>
      )}

      {subTab === 'CIERRES' && (
        <div className="space-y-3">
          {closuresList.length === 0 ? (
            <div className="bg-[#1C2541]/60 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 text-xs">
              No hay cierres mensuales archivados todavía.
            </div>
          ) : (
            closuresList.map((c: any) => (
              <div
                key={c.id}
                className="bg-[#1C2541]/90 border border-slate-800 rounded-xl p-4 space-y-2.5 shadow"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-sm text-white">
                      Cierre Mensual: {c.monthYear || 'Período cerrado'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Fecha de corte: {c.closureDate}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#0B132B]/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Ingresos:</span>
                    <span className="font-bold text-emerald-400">{formatVES(c.totalIncomeVES || 0)}</span>
                  </div>
                  <div className="bg-[#0B132B]/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Gastos:</span>
                    <span className="font-bold text-rose-400">-{formatVES(c.totalExpenseVES || 0)}</span>
                  </div>
                  <div className="bg-[#0B132B]/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Utilidad Neta:</span>
                    <span className="font-bold text-cyan-400">{formatVES(c.netProfitVES || 0)}</span>
                  </div>
                  <div className="bg-[#0B132B]/60 p-2.5 rounded-lg border border-emerald-500/30">
                    <span className="text-[10px] uppercase text-slate-400 block">Remanente en Caja:</span>
                    <span className="font-black text-emerald-400">{formatVES(c.remainingBalanceVES || 0)}</span>
                  </div>
                </div>

                {c.cumulativeWithdrawalsVES > 0 && (
                  <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                    <span>Retiros acumulados del período:</span>
                    <span className="font-semibold text-rose-300">-{formatVES(c.cumulativeWithdrawalsVES)}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Realizar Retiro de Utilidad */}
      {showRetiroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">Retiro de Utilidades</h3>
                  <p className="text-xs text-slate-400">Disponible: {formatVES(accounting.saldoRemanenteVES)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRetiroModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRetiroSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fecha del Retiro:
                </label>
                <input
                  type="date"
                  value={fechaRetiro}
                  onChange={(e) => setFechaRetiro(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Beneficiario / Dueño:
                </label>
                <input
                  type="text"
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Concepto del Retiro:
                </label>
                <input
                  type="text"
                  value={conceptoRetiro}
                  onChange={(e) => setConceptoRetiro(e.target.value)}
                  placeholder="Ej: Retiro de utilidades semanales"
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monto a Retirar (VES):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    max={accounting.saldoRemanenteVES}
                    value={montoRetiroVES}
                    onChange={(e) => setMontoRetiroVES(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRetiroModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRetiro || !montoRetiroVES || parseFloat(montoRetiroVES) <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  {savingRetiro ? 'Procesando...' : 'Confirmar Retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Usar Fondo de Reserva */}
      {showFondoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">Usar Fondo de Reserva</h3>
                  <p className="text-xs text-slate-400">Disponible: {formatVES(data.fondoReserva.saldoVES)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFondoModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUsarFondo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monto a Utilizar (VES):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    max={data.fondoReserva.saldoVES}
                    value={montoFondoVES}
                    onChange={(e) => setMontoFondoVES(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo / Justificación:
                </label>
                <textarea
                  value={motivoFondo}
                  onChange={(e) => setMotivoFondo(e.target.value)}
                  placeholder="Ej: Reparación de emergencia motor autobús"
                  rows={2}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFondoModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingFondo || !montoFondoVES || parseFloat(montoFondoVES) <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
                >
                  {savingFondo ? 'Procesando...' : 'Aplicar Fondo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Retiro */}
      {deletingRetiro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C2541] border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white">¿Eliminar Retiro de Utilidad?</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-semibold text-white">{deletingRetiro.fecha}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Beneficiario:</span>
                <span className="font-semibold text-white">{deletingRetiro.beneficiario}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Concepto:</span>
                <span className="text-slate-200">{deletingRetiro.concepto}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                <span className="text-slate-400">Monto:</span>
                <span className="font-bold text-rose-400 text-sm">{formatVES(deletingRetiro.montoVES)}</span>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                disabled={deletingRetiroLoading}
                onClick={() => setDeletingRetiro(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingRetiroLoading}
                onClick={handleConfirmDeleteRetiro}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingRetiroLoading ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
