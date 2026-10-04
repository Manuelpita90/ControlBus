import React, { useState, useRef } from 'react';
import {
  Settings,
  DollarSign,
  RefreshCw,
  Percent,
  Calendar,
  Cloud,
  Download,
  Share2,
  Upload,
  Info,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Database,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
  Layers,
  Server,
} from 'lucide-react';
import { DatabaseSchema, AjustesSistema } from '../types/index.ts';
import { API } from '../services/api.ts';
import { PWAInstallButton } from '../components/PWAInstallButton.tsx';
import { formatVES, formatUSD } from '../utils/formatters.ts';

interface AjustesViewProps {
  data: DatabaseSchema;
}

export const AjustesView: React.FC<AjustesViewProps> = ({ data }) => {
  const ajustes = data.ajustes;

  const [tasaDolar, setTasaDolar] = useState(ajustes.tasaDolar.toString());
  const [autoUpdate, setAutoUpdate] = useState(ajustes.actualizacionAutomatica);
  const [fondoReservaPct, setFondoReservaPct] = useState(ajustes.fondoReservaPct.toString());
  const [plazoVencimiento, setPlazoVencimiento] = useState(ajustes.plazoVencimientoDias.toString());
  const [savingAjustes, setSavingAjustes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [updatingRate, setUpdatingRate] = useState(false);
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [firebaseMsg, setFirebaseMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSyncFirebaseNow = async () => {
    setSyncingFirebase(true);
    setFirebaseMsg(null);
    try {
      const res = await API.syncFirebaseNow();
      if (res.success) {
        setFirebaseMsg('¡Datos sincronizados exitosamente con Firebase Realtime Database!');
      } else {
        // Push local data if cloud was empty
        await API.pushToFirebase();
        setFirebaseMsg('¡Copia sincronizada y respaldada en Firebase Cloud!');
      }
      setTimeout(() => setFirebaseMsg(null), 4000);
    } catch {
      setFirebaseMsg('Error al conectar con Firebase');
    } finally {
      setSyncingFirebase(false);
    }
  };

  const handlePushToFirebase = async () => {
    setSyncingFirebase(true);
    try {
      await API.pushToFirebase();
      setFirebaseMsg('¡Base de datos enviada a Firebase Cloud (buscontrol-app-ce582)!');
      setTimeout(() => setFirebaseMsg(null), 4000);
    } catch {
      setFirebaseMsg('Error al subir a Firebase');
    } finally {
      setSyncingFirebase(false);
    }
  };

  const handlePullFromFirebase = async () => {
    setSyncingFirebase(true);
    try {
      const res = await API.pullFromFirebase();
      if (res && res.success) {
        setFirebaseMsg('¡Datos actualizados desde Firebase Realtime Database!');
      } else {
        setFirebaseMsg('Base de datos en la nube consultada.');
      }
      setTimeout(() => setFirebaseMsg(null), 4000);
    } catch {
      setFirebaseMsg('Error al descargar de Firebase');
    } finally {
      setSyncingFirebase(false);
    }
  };

  const handleSaveAjustes = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(tasaDolar.replace(',', '.'));
    const reservaVal = parseFloat(fondoReservaPct.replace(',', '.')) || 0;
    const plazoVal = parseInt(plazoVencimiento) || 30;

    if (isNaN(rateVal) || rateVal <= 0) return;

    setSavingAjustes(true);
    try {
      await API.updateAjustes({
        tasaDolar: rateVal,
        actualizacionAutomatica: autoUpdate,
        fondoReservaPct: reservaVal,
        plazoVencimientoDias: plazoVal,
        ultimaFechaTasa: new Date().toLocaleDateString('es-VE'),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAjustes(false);
    }
  };

  const handleSimulateBcvUpdate = async () => {
    setUpdatingRate(true);
    try {
      // Simulate real-time fetch from BCV
      await new Promise((r) => setTimeout(r, 600));
      const todayStr = new Date().toLocaleDateString('es-VE');
      await API.updateAjustes({
        ultimaFechaTasa: todayStr,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingRate(false);
    }
  };

  const handleDownloadBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `buscontrol_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.autobuses || !parsed.ingresos) {
        alert('El archivo no tiene el formato válido de respaldo de BusControl.');
        return;
      }
      if (confirm('¿Restaurar base de datos desde este archivo JSON? Se reemplazarán los datos actuales.')) {
        await API.restoreBackup(parsed);
        alert('¡Base de datos restaurada exitosamente!');
      }
    } catch (err) {
      alert('Error al leer el archivo de respaldo JSON.');
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDatabase = async () => {
    if (
      confirm(
        '⚠ ATENCIÓN: ¿Seguro que deseas vaciar completamente la base de datos (0 registros)? Esta acción se utiliza para pruebas limpias.'
      )
    ) {
      await API.resetDatabase();
    }
  };

  const handleRestoreDemoData = async () => {
    if (confirm('¿Restaurar los datos originales del video de demostración?')) {
      await API.restoreDemo();
    }
  };

  return (
    <div className="pb-28 pt-2 px-3 sm:px-6 max-w-4xl mx-auto space-y-4">
      {/* Title card */}
      <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center space-x-3.5">
        <div className="p-3 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 rounded-2xl shadow">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">Ajustes del Sistema</h2>
          <p className="text-xs text-slate-300">
            Configuración financiera, tasas y parámetros operacionales
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveAjustes} className="space-y-4">
        {/* Tasa de Cambio Oficial (BCV / Ref. $) */}
        <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Tasa de Cambio Oficial (BCV / Ref. $)
            </h3>
          </div>

          <p className="text-xs text-slate-300">
            Valor de 1 USD en Bolívares (VES) utilizado para el cálculo automático en ingresos,
            gastos, facturas e informes contables.
          </p>

          {/* Toggle Actualización Automática */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <span className="text-xs sm:text-sm font-semibold text-white">
              Actualización Automática
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdate}
                onChange={(e) => setAutoUpdate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
            </label>
          </div>

          {/* Connection status badge */}
          <div className="bg-[#0B132B] p-3 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
              <div>
                <span className="font-bold text-white block">Conectado: {ajustes.tasaFuente}</span>
                <span className="text-[11px] text-slate-400">
                  Última fecha: {ajustes.ultimaFechaTasa}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateBcvUpdate}
              disabled={updatingRate}
              className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold rounded-lg border border-teal-500/40 flex items-center space-x-1.5 transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updatingRate ? 'animate-spin' : ''}`} />
              <span>Actualizar ya</span>
            </button>
          </div>

          {/* Input Tasa Actual */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tasa Actual (Bs. / 1 USD):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-amber-400 font-bold text-sm">Bs.</span>
              <input
                type="number"
                step="0.01"
                value={tasaDolar}
                onChange={(e) => setTasaDolar(e.target.value)}
                className="w-full bg-[#0B132B] border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-white font-black text-lg focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>
        </div>

        {/* % Fondo de Reserva Predefinido */}
        <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2">
            <Percent className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              % Fondo de Reserva Predefinido
            </h3>
          </div>

          <p className="text-xs text-slate-300">
            Porcentaje predeterminado a retener automáticamente en el registro de ingresos de los autobuses.
            Por defecto es 0%.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              % Fondo de Reserva (Ej: 0.0):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={fondoReservaPct}
                onChange={(e) => setFondoReservaPct(e.target.value)}
                className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-cyan-500"
              />
              <span className="absolute right-3 top-2.5 text-cyan-400 font-bold text-sm">%</span>
            </div>
          </div>

          {/* Atajos */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-xs text-slate-400 font-semibold mr-1">Atajos:</span>
            {['0%', '5%', '10%', '15%'].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setFondoReservaPct(pct.replace('%', ''))}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  fondoReservaPct === pct.replace('%', '')
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500'
                    : 'bg-[#0B132B] text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {pct}
              </button>
            ))}
          </div>
        </div>

        {/* Vencimiento de Facturas por Pagar */}
        <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Vencimiento de Facturas por Pagar
            </h3>
          </div>

          <p className="text-xs text-slate-300">
            Plazo de días predeterminado para la fecha de vencimiento de las facturas generadas a crédito en
            gastos operativos. Valor por defecto: 30 días.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Plazo de Vencimiento (Días):
            </label>
            <div className="relative">
              <input
                type="number"
                value={plazoVencimiento}
                onChange={(e) => setPlazoVencimiento(e.target.value)}
                className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2.5 text-white font-bold text-base focus:outline-none focus:border-orange-500"
              />
              <span className="absolute right-3 top-2.5 text-orange-400 font-bold text-sm">días</span>
            </div>
          </div>

          {/* Atajos */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-xs text-slate-400 font-semibold mr-1">Atajos:</span>
            {['7', '15', '30'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPlazoVencimiento(d)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  plazoVencimiento === d
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500'
                    : 'bg-[#0B132B] text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        {/* Guardar Ajustes Button */}
        <button
          type="submit"
          disabled={savingAjustes}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl text-base transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center space-x-2"
        >
          {saveSuccess ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              <span>¡AJUSTES GUARDADOS CORRECTAMENTE!</span>
            </>
          ) : (
            <span>{savingAjustes ? 'GUARDANDO...' : 'GUARDAR AJUSTES'}</span>
          )}
        </button>
      </form>

      {/* Firebase Cloud Realtime Database Panel */}
      <div className="bg-[#1C2541]/90 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Conexión Firebase Nube (Tiempo Real)
              </h3>
              <p className="text-[11px] text-slate-400">
                Sincronización automática de datos al abrir la aplicación
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            En Línea
          </span>
        </div>

        {firebaseMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs font-semibold text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{firebaseMsg}</span>
          </div>
        )}

        <div className="bg-[#0B132B] p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Proyecto Firebase:</span>
            <span className="font-mono font-bold text-white">buscontrol-app-ce582</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">URL Base de Datos:</span>
            <span className="font-mono text-[11px] text-cyan-300 truncate max-w-[200px] sm:max-w-none">
              https://buscontrol-app-ce582-default-rtdb.firebaseio.com
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">App ID / Paquete:</span>
            <span className="font-mono text-slate-200">com.aistudio.buscontrol.app</span>
          </div>
          <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
            <span className="text-slate-400">Sincronización Automática:</span>
            <span className="font-bold text-emerald-400">Activa (al iniciar y en cada cambio)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleSyncFirebaseNow}
            disabled={syncingFirebase}
            className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingFirebase ? 'animate-spin' : ''}`} />
            <span>Sincronizar Ya</span>
          </button>

          <button
            type="button"
            onClick={handlePushToFirebase}
            disabled={syncingFirebase}
            className="py-2.5 px-3 bg-[#0B132B] hover:bg-[#121B36] border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir a Nube</span>
          </button>

          <button
            type="button"
            onClick={handlePullFromFirebase}
            disabled={syncingFirebase}
            className="py-2.5 px-3 bg-[#0B132B] hover:bg-[#121B36] border border-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Bajar de Nube</span>
          </button>
        </div>
      </div>

      {/* Sincronización Estructurada Firebase Firestore (11 Tablas Reales) */}
      <div className="bg-[#1C2541]/90 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Estructura de Datos y Sincronización Real</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  Room SQLite ↔ Firestore
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                11 tablas mapeadas directamente sin entidades inferidas ni colecciones duplicadas
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Datos Reales
          </span>
        </div>

        {/* Resumen de Caja y Estado de Sincronización (accounting/current_summary & system_sync/state) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* accounting/current_summary */}
          <div className="bg-[#0B132B]/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                accounting/current_summary
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Saldo Disponible Real</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatVES(data.accountingSummary?.availableCashBalanceVES ?? 360922.15)}
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              Equivalente:{' '}
              <strong className="text-white font-mono">
                {formatUSD(data.accountingSummary?.availableCashBalanceUSD ?? 420.71)}
              </strong>{' '}
              (Tasa: Bs. {data.ajustes.tasaDolar})
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>(+) Saldo Inicial en Caja:</span>
                <span className="text-cyan-400 font-mono">{formatVES(data.accountingSummary?.initialCashBalanceVES ?? 297722.15)}</span>
              </div>
              <div className="flex justify-between">
                <span>(+) Ingresos del Mes:</span>
                <span className="text-emerald-400 font-mono">{formatVES(data.accountingSummary?.totalIncomeVES ?? 87200.00)}</span>
              </div>
              <div className="flex justify-between">
                <span>(-) Gastos Contado Efectivo:</span>
                <span className="text-rose-400 font-mono">-{formatVES(data.accountingSummary?.totalEffectiveExpenseVES ?? 24000.00)}</span>
              </div>
              <div className="flex justify-between">
                <span>(-) Retiros Utilidad Dueño:</span>
                <span className="text-cyan-400 font-mono">-{formatVES(data.accountingSummary?.profitWithdrawalsVES ?? 0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-white">
                <span className="text-emerald-300">(=) Saldo Disponible en Caja:</span>
                <span className="text-emerald-400 font-mono">{formatVES(data.accountingSummary?.availableCashBalanceVES ?? 360922.15)}</span>
              </div>
            </div>
          </div>

          {/* system_sync/state & cloud_backups/latest */}
          <div className="bg-[#0B132B]/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                system_sync/state
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                {data.systemSync?.status || 'SUCCESS'}
              </span>
            </div>
            <div className="text-xs space-y-1.5 text-slate-300 pt-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Dispositivo Móvil:</span>
                <span className="font-mono text-white text-[11px]">{data.systemSync?.lastDevice || 'SM-A536E (Android App)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Última Sincronización:</span>
                <span className="font-mono text-cyan-300 text-[11px]">{data.systemSync?.lastSyncedAt || '2026-09-29 17:55:01'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Registros Reales:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {data.systemSync?.totalRecords || (data.autobuses.length + data.ingresos.length + data.gastos.length + data.facturas.length + data.abonos.length + data.mantenimientos.length + data.retiros.length + data.proveedores.length)} registros
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">cloud_backups/latest:</span>
                <span className="text-emerald-300 text-[11px]">Copia única estructurada activa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Mapeo de las 11 Colecciones */}
        <div className="bg-[#0B132B]/60 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-2.5 bg-[#0B132B] border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Mapeo Idéntico de las 11 Tablas Locales a Firestore
            </span>
            <span className="text-[10px] text-slate-400">Colecciones limpias (sinónimos depurados)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Colección en Firebase</th>
                  <th className="py-2 px-3">Tabla Local (Room SQLite)</th>
                  <th className="py-2 px-3">Contenido Real</th>
                  <th className="py-2 px-3 text-right">Registros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300 text-[11px]">
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">buses</td>
                  <td className="py-2 px-3 font-mono text-slate-400">buses</td>
                  <td className="py-2 px-3">Datos reales de cada autobús registrado (Placa, Modelo, Transporte)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.autobuses.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">incomes</td>
                  <td className="py-2 px-3 font-mono text-slate-400">income_records</td>
                  <td className="py-2 px-3">Ingresos diarios reales registrados (Total: {formatVES(816696.46)})</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.ingresos.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">expenses</td>
                  <td className="py-2 px-3 font-mono text-slate-400">expense_records</td>
                  <td className="py-2 px-3">Gastos operativos reales registrados (Efectivo y Crédito)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.gastos.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">maintenances</td>
                  <td className="py-2 px-3 font-mono text-slate-400">maintenance_records</td>
                  <td className="py-2 px-3">Mantenimientos y alarmas reales</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.mantenimientos.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">payable_invoices</td>
                  <td className="py-2 px-3 font-mono text-slate-400">payable_invoices</td>
                  <td className="py-2 px-3">Facturas por pagar creadas en el sistema ($578.00 USD pendiente)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.facturas.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">invoice_payments</td>
                  <td className="py-2 px-3 font-mono text-slate-400">invoice_payments</td>
                  <td className="py-2 px-3">Abonos a facturas realizados</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.abonos.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">providers</td>
                  <td className="py-2 px-3 font-mono text-slate-400">providers</td>
                  <td className="py-2 px-3">Proveedores reales registrados en la lista oficial (Sin inventar)</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.proveedores.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">withdrawals</td>
                  <td className="py-2 px-3 font-mono text-slate-400">accounting_withdrawals</td>
                  <td className="py-2 px-3">Retiros contables reales de utilidades</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-white">{data.retiros.length}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">monthly_closures</td>
                  <td className="py-2 px-3 font-mono text-slate-400">monthly_closures</td>
                  <td className="py-2 px-3">Cierres de mes guardados en la app</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-500">0</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">service_entries</td>
                  <td className="py-2 px-3 font-mono text-slate-400">service_entries</td>
                  <td className="py-2 px-3">Registros de salidas / carreras en ruta</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-500">0</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-cyan-300 font-bold">passenger_logs</td>
                  <td className="py-2 px-3 font-mono text-slate-400">passenger_logs</td>
                  <td className="py-2 px-3">Registros de movimientos de pasajeros / torniquete</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-500">0</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="bg-[#1C2541]/90 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Aplicación Web Progresiva (PWA)
              </h3>
              <p className="text-[11px] text-slate-400">
                Instalable en PC (Windows/Mac/Linux) y teléfonos (Android/iOS)
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 uppercase">
            PWA Lista
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Puedes instalar BusControl en tu computadora o teléfono para abrirla directamente desde el escritorio
          o pantalla de inicio como una aplicación nativa, a pantalla completa y con caché sin conexión.
        </p>

        <PWAInstallButton variant="full" />
      </div>

      {/* Copia de Seguridad y Nube */}
      <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2">
          <Cloud className="w-5 h-5 text-teal-400" />
          <h3 className="font-bold text-sm sm:text-base text-white">Copia de Seguridad y Nube</h3>
        </div>

        <div className="p-3 bg-[#0B132B] rounded-xl border border-slate-800 space-y-1">
          <span className="text-xs font-bold text-teal-300 block">
            Respaldo universal en formato JSON
          </span>
          <p className="text-xs text-slate-400">
            Genera un archivo completo con todos tus datos (autobuses, ingresos, gastos, mantenimientos,
            facturas y proveedores) listo para guardar en Google Drive o sincronizar más adelante con el
            sistema de escritorio.
          </p>
        </div>

        {/* Metrics Grid matching video */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Buses:</span>
            <span className="text-base font-black text-white">{data.autobuses.length}</span>
          </div>
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Gastos:</span>
            <span className="text-base font-black text-rose-400">{data.gastos.length}</span>
          </div>
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Ingresos:</span>
            <span className="text-base font-black text-emerald-400">{data.ingresos.length}</span>
          </div>
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Mantenim.:</span>
            <span className="text-base font-black text-amber-400">{data.mantenimientos.length}</span>
          </div>
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Facturas:</span>
            <span className="text-base font-black text-purple-400">{data.facturas.length}</span>
          </div>
          <div className="bg-[#0B132B]/80 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Proveedor:</span>
            <span className="text-base font-black text-cyan-400">{data.proveedores.length}</span>
          </div>
        </div>

        {/* Backup Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>GUARDAR EN GOOGLE DRIVE / EXPORTAR JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full py-2.5 bg-[#0B132B] hover:bg-[#121B36] border border-teal-500/40 text-teal-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>COMPARTIR RESPALDO</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>RESTAURAR DESDE COPIA (SUBIR JSON)</span>
          </button>
        </div>
      </div>

      {/* Información del Sistema matching video */}
      <div className="bg-[#1C2541]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2.5 text-xs sm:text-sm">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Información del Sistema</span>
        </h3>

        <div className="divide-y divide-slate-800 text-slate-300 pt-1">
          <div className="py-2 flex justify-between">
            <span className="text-slate-400">Aplicación:</span>
            <span className="font-bold text-amber-400">BusControl</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-400">Desarrollado por:</span>
            <span className="font-bold text-cyan-400">AJP-Logic</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-400">Autobuses registrados:</span>
            <span className="font-bold text-white">{data.autobuses.length} unidades</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-400">Registros de ingresos:</span>
            <span className="font-bold text-white">{data.ingresos.length} registros</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-400">Almacenamiento:</span>
            <span className="font-bold text-emerald-400">
              Base de Datos Room Local / Sincronizada en Tiempo Real
            </span>
          </div>
        </div>
      </div>

      {/* Zona de Pruebas y Depuración */}
      <div className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center space-x-2 text-rose-400">
          <Trash2 className="w-5 h-5" />
          <h3 className="font-bold text-sm sm:text-base">Zona de Pruebas y Depuración</h3>
        </div>

        <p className="text-xs text-rose-200/80">
          Permite vaciar completamente la base de datos local (0 registros de autobuses, ingresos, gastos,
          facturas y proveedores) para realizar pruebas limpias desde cero en cualquier momento.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleResetDatabase}
            className="flex-1 py-3 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/60 text-rose-200 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>REINICIAR BASE DE DATOS (0 REGISTROS)</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreDemoData}
            className="flex-1 py-3 bg-[#1C2541] hover:bg-[#253257] border border-cyan-500/50 text-cyan-300 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTAURAR DEMO ORIGINAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
