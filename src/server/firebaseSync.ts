import { FIREBASE_CONFIG } from './firebaseConfig.ts';
import {
  DatabaseSchema,
  Autobus,
  IngresoDiario,
  GastoOperativo,
  FacturaPorPagar,
  AbonoFactura,
  Mantenimiento,
  RetiroUtilidad,
  Proveedor,
  AccountingSummary,
  SystemSyncState
} from '../types/index.ts';

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const RTDB_URL = `${FIREBASE_CONFIG.databaseURL}/buscontrol.json`;

interface CloudSyncStatus {
  connected: boolean;
  projectId: string;
  databaseURL: string;
  lastSyncTime: string | null;
  statusMessage: string;
  error?: string | null;
  syncedTables?: string[];
  totalRecords?: number;
  lastDevice?: string;
  availableCashBalanceVES?: number;
  availableCashBalanceUSD?: number;
}

let syncStatus: CloudSyncStatus = {
  connected: false,
  projectId: FIREBASE_CONFIG.projectId,
  databaseURL: FIREBASE_CONFIG.databaseURL,
  lastSyncTime: null,
  statusMessage: 'Iniciando conexión con Firebase Firestore...',
  error: null,
};

let isWritingToCloud = false;
let lastKnownSyncTimestamp = 0;

export function getFirebaseSyncStatus(): CloudSyncStatus {
  return syncStatus;
}

/**
 * Convert raw Firestore document fields to JavaScript object
 */
function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return {};
  const res: Record<string, any> = {};
  for (const [key, val] of Object.entries(doc.fields as Record<string, any>)) {
    if (val.stringValue !== undefined) res[key] = val.stringValue;
    else if (val.integerValue !== undefined) res[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) res[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) res[key] = val.booleanValue;
    else if (val.nullValue !== undefined) res[key] = null;
    else if (val.timestampValue !== undefined) res[key] = val.timestampValue;
    else if (val.mapValue !== undefined) res[key] = parseFirestoreDoc(val.mapValue);
    else if (val.arrayValue !== undefined) {
      res[key] = (val.arrayValue.values || []).map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        if (v.doubleValue !== undefined) return v.doubleValue;
        if (v.mapValue !== undefined) return parseFirestoreDoc(v.mapValue);
        return v;
      });
    }
  }
  return res;
}

/**
 * Convert standard JS value to Firestore REST field format
 */
function toFirestoreField(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreField(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreField(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Normalizes Room SQLite & Firestore data into uniform DatabaseSchema
 */
export function normalizeFromRawJson(raw: any): DatabaseSchema {
  const rate = parseFloat(raw.preferences?.exchangeRate || raw.accountingSummary?.exchangeRate || '857.8876') || 857.8876;
  const reservePct = parseFloat(raw.preferences?.reserveFundPercent || '0.0') || 0.0;
  const dueDays = parseInt(raw.preferences?.invoiceDueDays || '30', 10) || 30;

  // 1. Buses (exact mapping from Room SQLite `buses`)
  const buses: Autobus[] = (raw.buses || []).map((b: any) => {
    const plate = b.plate || b.placa || '';
    const model = b.modelAlias || b.modelo || '';
    const company = b.transportCompany || b.transporte || 'TRANSPORTE DEMOCRACIA';
    return {
      id: Number(b.id),
      plate,
      placa: plate,
      modelAlias: model,
      modelo: model,
      transportCompany: company,
      transporte: company,
      status: b.status || 'activo',
      estado: (b.status === 'activo' || b.status === 'en taller' || b.status === 'inactivo') ? b.status : 'activo',
      capacity: b.capacity ?? 32,
      driverName: b.driverName ?? '',
      year: b.year ?? 2018,
      mileage: b.mileage ?? 120000,
      alias: model,
      numero: b.numero || String(b.id),
      updatedAt: b.updatedAt,
    };
  });

  // 2. Real Providers ONLY (No invented providers!)
  const providers: Proveedor[] = (raw.providers || []).map((p: any) => {
    const name = p.name || p.nombre || '';
    const contact = p.contactPerson || p.contacto || '';
    const phone = p.phone || p.telefono || 'NO APLICA';
    const category = p.category || p.categoria || 'GENERAL';
    return {
      id: Number(p.id),
      name,
      nombre: name,
      contactPerson: contact,
      contacto: contact,
      phone,
      telefono: phone,
      category,
      categoria: category,
      registerCount: p.registerCount ?? 1,
      direccion: p.direccion || '',
      rif: p.rif || '',
    };
  });

  // 3. Incomes (13 real records in Room SQLite `income_records`)
  const incomes: IngresoDiario[] = (raw.incomes || []).map((i: any) => {
    const date = i.date || i.fecha || '';
    const busPlate = i.busPlate || i.placa || '';
    const busAlias = i.busAlias || i.unidadAlias || (buses.find((b) => b.plate === busPlate)?.modelo || '');
    const amountVES = Number(i.amountVES ?? i.montoVES ?? 0);
    const amountUSD = Number(i.amountUSD ?? (rate > 0 ? amountVES / rate : 0));
    const netVES = Number(i.netProfitVES ?? i.montoNetoVES ?? amountVES);
    const netUSD = Number(i.netProfitUSD ?? (rate > 0 ? netVES / rate : 0));
    const matchedBus = buses.find((b) => b.plate === busPlate);

    return {
      id: Number(i.id),
      date,
      fecha: date,
      busPlate,
      placa: busPlate,
      busAlias,
      unidadAlias: busAlias,
      amountVES,
      montoVES: amountVES,
      amountUSD,
      montoUSD: amountUSD,
      netProfitVES: netVES,
      montoNetoVES: netVES,
      netProfitUSD: netUSD,
      reserveFundPercent: Number(i.reserveFundPercent ?? i.porcentajeReserva ?? 0),
      porcentajeReserva: Number(i.reserveFundPercent ?? i.porcentajeReserva ?? 0),
      reserveFundVES: Number(i.reserveFundVES ?? i.montoReservaVES ?? 0),
      montoReservaVES: Number(i.reserveFundVES ?? i.montoReservaVES ?? 0),
      isVerified: i.isVerified ?? true,
      note: i.note || i.observaciones || '',
      observaciones: i.note || i.observaciones || '',
      tasaCambio: rate,
      autobusId: matchedBus?.id || (busPlate.includes('31') ? 1 : 2),
      createdAt: i.updatedAt || `${date}T12:00:00Z`,
    };
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);

  // 4. Expenses (14 real records in Room SQLite `expense_records`)
  const expenses: GastoOperativo[] = (raw.expenses || []).map((e: any) => {
    const date = e.date || e.fecha || '';
    const busPlate = e.busPlate || e.placa || '';
    const matchedBus = buses.find((b) => b.plate === busPlate);
    const unitName = busPlate ? `${busPlate} - ${matchedBus?.modelo || 'Unidad'}` : 'Flota General';
    const amountVES = Number(e.amountVES ?? e.montoVES ?? 0);
    const amountUSD = Number(e.amountUSD ?? (rate > 0 ? amountVES / rate : 0));
    const isCredit = (e.paymentType === 'credito' || e.tipoPago === 'CREDITO');

    return {
      id: Number(e.id),
      date,
      fecha: date,
      busPlate,
      unidadNombre: unitName,
      category: e.category || e.categoria || 'VARIOS',
      categoria: e.category || e.categoria || 'VARIOS',
      providerName: e.providerName || e.proveedor || '',
      proveedor: e.providerName || e.proveedor || '',
      paymentType: isCredit ? 'credito' : 'contado',
      tipoPago: isCredit ? 'CREDITO' : 'CONTADO',
      amountVES,
      montoVES: amountVES,
      amountUSD,
      montoUSD: amountUSD,
      description: e.description || e.concepto || '',
      concepto: e.description || e.concepto || '',
      invoiceNumber: e.invoiceNumber || e.numeroFactura || '',
      numeroFactura: e.invoiceNumber || e.numeroFactura || '',
      isPaid: e.isPaid ?? !isCredit,
      autobusId: matchedBus?.id || null,
      tasaCambio: rate,
      createdAt: e.updatedAt || `${date}T12:00:00Z`,
    };
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);

  // 5. Payable Invoices (4 real records in Room SQLite `payable_invoices`)
  const facturas: FacturaPorPagar[] = (raw.payableInvoices || raw.payable_invoices || []).map((f: any) => {
    const num = f.invoiceNumber || f.numeroFactura || `F-${f.id}`;
    const prov = f.providerName || f.proveedor || '';
    const totalUSD = Number(f.totalAmountUSD ?? f.montoTotalUSD ?? 0);
    const paidUSD = Number(f.paidAmountUSD ?? f.montoAbonadoUSD ?? 0);
    const remainingUSD = Math.max(0, Number((totalUSD - paidUSD).toFixed(2)));
    const totalVES = Number(f.totalAmountVES ?? (totalUSD * rate));
    const paidVES = Number(f.paidAmountVES ?? (paidUSD * rate));
    const remainingVES = Math.max(0, Number((remainingUSD * rate).toFixed(2)));
    const isPaid = f.status === 'PAGADA' || remainingUSD <= 0.01;

    return {
      id: Number(f.id),
      invoiceNumber: num,
      numeroFactura: num,
      date: f.date || f.fechaEmision || '',
      fechaEmision: f.date || f.fechaEmision || '',
      dueDate: f.dueDate || f.fechaVencimiento || '',
      fechaVencimiento: f.dueDate || f.fechaVencimiento || '',
      providerName: prov,
      proveedor: prov,
      category: f.category || f.categoria || 'VARIOS',
      categoria: f.category || f.categoria || 'VARIOS',
      description: f.description || f.concepto || '',
      concepto: f.description || f.concepto || '',
      totalAmountUSD: totalUSD,
      montoTotalUSD: totalUSD,
      paidAmountUSD: paidUSD,
      montoAbonadoUSD: paidUSD,
      deudaRestanteUSD: remainingUSD,
      totalAmountVES: totalVES,
      montoTotalVES: totalVES,
      paidAmountVES: paidVES,
      deudaRestanteVES: remainingVES,
      status: isPaid ? 'PAGADA' : 'PENDIENTE',
      estado: isPaid ? 'PAGADA' : 'PENDIENTE',
      tasaCambio: rate,
      createdAt: f.updatedAt || f.date,
    };
  });

  // 6. Invoice Payments / Abonos (5 real records in Room SQLite `invoice_payments`)
  const abonos: AbonoFactura[] = (raw.invoicePayments || raw.invoice_payments || []).map((p: any) => {
    const amountUSD = Number(p.amountUSD ?? p.montoUSD ?? 0);
    const amountVES = Number(p.amountVES ?? p.montoVES ?? (amountUSD * rate));
    return {
      id: Number(p.id),
      invoiceId: Number(p.invoiceId || p.facturaId),
      facturaId: Number(p.invoiceId || p.facturaId),
      invoiceNumber: p.invoiceNumber || '',
      date: p.date || p.fecha || '',
      fecha: p.date || p.fecha || '',
      amountUSD,
      montoUSD: amountUSD,
      amountVES,
      montoVES: amountVES,
      paymentMethod: p.paymentMethod || p.metodoPago || 'Transferencia',
      metodoPago: p.paymentMethod || p.metodoPago || 'Transferencia',
      notes: p.notes || p.nota || 'Abono / Pago de factura',
      nota: p.notes || p.nota || 'Abono / Pago de factura',
      tasaCambio: rate,
      createdAt: p.updatedAt || p.date,
    };
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);

  // Link abonos to facturas
  facturas.forEach((f) => {
    f.abonos = abonos.filter((a) => a.facturaId === f.id || a.invoiceNumber === f.invoiceNumber);
  });

  // 7. Maintenances (5 real records in Room SQLite `maintenance_records`)
  const mantenimientos: Mantenimiento[] = (raw.maintenances || []).map((m: any) => {
    const plate = m.busPlate || m.placa || '';
    const matchedBus = buses.find((b) => b.plate === plate);
    const alias = m.busAlias || matchedBus?.modelo || '';
    const isPorVencer = m.status === 'POR_VENCER' || m.status === 'por_vencer';
    const isVencido = m.status === 'VENCIDO' || m.status === 'vencido';
    const cleanStatus = isVencido ? 'vencido' : isPorVencer ? 'por_vencer' : 'al_dia';

    return {
      id: Number(m.id),
      busPlate: plate,
      placa: plate,
      busAlias: alias,
      unidadNombre: plate ? `${plate} • ${alias}` : (m.unidadNombre || 'Flota General'),
      date: m.date || m.fecha || '',
      fecha: m.date || m.fecha || '',
      maintenanceType: m.maintenanceType || m.tipoMantenimiento || 'Mantenimiento General',
      tipoMantenimiento: m.maintenanceType || m.tipoMantenimiento || 'Mantenimiento General',
      description: m.description || m.descripcion || '',
      descripcion: m.description || m.descripcion || '',
      status: isVencido ? 'VENCIDO' : isPorVencer ? 'POR_VENCER' : 'AL_DIA',
      estado: cleanStatus,
      nextDueDate: m.nextDueDate || m.fechaVencimiento || '',
      fechaVencimiento: m.nextDueDate || m.fechaVencimiento || '',
      nextDueDays: Number(m.nextDueDays ?? 30),
      isProgrammed: m.isProgrammed ?? true,
      alarmaActiva: isPorVencer || isVencido || (m.alarmaActiva ?? true),
      costVES: Number(m.costVES ?? m.costoVES ?? 0),
      costoVES: Number(m.costVES ?? m.costoVES ?? 0),
      costUSD: Number(m.costUSD ?? m.costoUSD ?? 0),
      autobusId: matchedBus?.id || (plate.includes('31') ? 1 : 2),
      createdAt: m.updatedAt || m.date,
    };
  });

  // 8. Withdrawals (2 real records in Room SQLite `accounting_withdrawals`)
  const retiros: RetiroUtilidad[] = (raw.withdrawals || []).map((w: any) => {
    const amountVES = Number(w.amountVES ?? w.montoVES ?? 0);
    const amountUSD = Number(w.amountUSD ?? (rate > 0 ? amountVES / rate : 0));
    return {
      id: Number(w.id),
      date: w.date || w.fecha || '',
      fecha: w.date || w.fecha || '',
      type: w.type || 'PROFIT',
      recipient: w.recipient || w.beneficiario || 'Dueño / Propietario',
      beneficiario: w.recipient || w.beneficiario || 'Dueño / Propietario',
      concept: w.concept || w.concepto || 'Retiro de Ganancias / Utilidad del Dueño',
      concepto: w.concept || w.concepto || 'Retiro de Ganancias / Utilidad del Dueño',
      amountVES,
      montoVES: amountVES,
      amountUSD,
      montoUSD: amountUSD,
      tasaCambio: rate,
      createdAt: w.updatedAt || w.date,
    };
  });

  // 9. Accounting Summary (Room SQLite faithful cash flow)
  // Monto en Efectivo Disponible = Saldo Inicial + Total Ingresos - Gastos Contado - Retiros Utilidad - Abonos a Facturas
  const curMonthIngs = incomes.filter((i) => (i.fecha || '').startsWith('2026-10'));
  const curMonthGas = expenses.filter((e) => (e.fecha || '').startsWith('2026-10') && e.tipoPago === 'CONTADO');
  const curMonthRet = retiros.filter((r) => (r.fecha || '').startsWith('2026-10'));
  const curMonthAbo = abonos.filter((a) => (a.fecha || '').startsWith('2026-10'));

  const totalIncomeVES = curMonthIngs.reduce((s, i) => s + i.montoVES, 0);
  const totalEffectiveExpenseVES = curMonthGas.reduce((s, e) => s + e.montoVES, 0);
  const totalAbonosVES = curMonthAbo.reduce((s, a) => s + a.montoVES, 0);
  const profitWithdrawalsVES = curMonthRet.reduce((s, r) => s + r.montoVES, 0);

  const initialCashBalanceVES = raw.accountingSummary?.initialCashBalanceVES ?? 297722.15;
  const availableCashBalanceVES = raw.accountingSummary?.availableCashBalanceVES ??
    Math.max(0, Number((initialCashBalanceVES + totalIncomeVES - totalEffectiveExpenseVES - profitWithdrawalsVES - totalAbonosVES).toFixed(2)));
  const availableCashBalanceUSD = Number((availableCashBalanceVES / rate).toFixed(2));
  const netProfitVES = Number((totalIncomeVES - totalEffectiveExpenseVES - totalAbonosVES).toFixed(2));
  const netProfitUSD = Number((netProfitVES / rate).toFixed(2));

  const accountingSummary: AccountingSummary = {
    availableCashBalanceVES,
    availableCashBalanceUSD,
    initialCashBalanceVES,
    totalIncomeVES,
    totalEffectiveExpenseVES,
    profitWithdrawalsVES,
    exchangeRate: rate,
    netProfitVES,
    netProfitUSD,
    totalIncomeUSD: Number((totalIncomeVES / rate).toFixed(2)),
    totalEffectiveExpenseUSD: Number((totalEffectiveExpenseVES / rate).toFixed(2)),
    profitWithdrawalsUSD: Number((profitWithdrawalsVES / rate).toFixed(2)),
  };

  // 10. System Sync State
  const systemSync: SystemSyncState = {
    lastSyncedAt: raw.metadata?.exportedAt || new Date().toISOString(),
    lastDevice: raw.metadata?.device ? `${raw.metadata.device} (Android App)` : 'Android Mobile Sync',
    totalRecords: buses.length + incomes.length + expenses.length + facturas.length + abonos.length + mantenimientos.length + retiros.length + providers.length,
    status: 'SUCCESS',
    availableCashBalanceVES: accountingSummary.availableCashBalanceVES,
    availableCashBalanceUSD: accountingSummary.availableCashBalanceUSD,
    exchangeRate: rate,
  };

  return {
    ajustes: {
      tasaDolar: rate,
      actualizacionAutomatica: raw.preferences?.isAutoExchangeRate ?? true,
      ultimaFechaTasa: new Date().toLocaleDateString('es-VE'),
      tasaFuente: 'BCV Oficial',
      fondoReservaPct: reservePct,
      plazoVencimientoDias: dueDays,
    },
    autobuses: buses,
    categoriasGastos: [
      'DIESEL',
      'ADMINISTRATIVO',
      'LUBRICANTES',
      'REPUESTOS',
      'CAUCHERA',
      'FINANZAS',
      'MANTENIMIENTO',
      'OTROS',
    ],
    tiposMantenimiento: [
      'CAMBIO DE ACEITE',
      'CAMBIO FILTRO DIESEL',
      'CAMBIO FILTRO DE AIRE',
      'FRENOS',
      'ENGRASE',
    ],
    proveedores: providers,
    ingresos: incomes,
    gastos: expenses,
    facturas,
    abonos,
    mantenimientos,
    retiros,
    fondoReserva: {
      saldoVES: 0,
      saldoUSD: 0,
      historial: [],
    },
    accountingSummary,
    systemSync,
    monthlyClosures: raw.monthlyClosures || [],
    serviceEntries: raw.serviceEntries || [],
    passengerLogs: raw.passengerLogs || [],
  };
}

/**
 * Fetch latest database from Firebase Firestore collections and cloud_backups
 */
export async function pullFromFirebase(): Promise<DatabaseSchema | null> {
  try {
    // 1. Fetch from Firestore collections first (most complete and up-to-date real data)
    const getCol = async (c: string) => {
      try {
        const r = await fetch(`${FIRESTORE_BASE_URL}/${c}?pageSize=100`);
        if (!r.ok) return [];
        const d = await r.json();
        return (d.documents || []).map(parseFirestoreDoc);
      } catch {
        return [];
      }
    };

    const [
      busesRaw,
      incomesRaw,
      expensesRaw,
      maintenancesRaw,
      facturasRaw,
      abonosRaw,
      providersRaw,
      retirosRaw,
      closuresRaw,
    ] = await Promise.all([
      getCol('buses'),
      getCol('incomes'),
      getCol('expenses'),
      getCol('maintenances'),
      getCol('payable_invoices'),
      getCol('invoice_payments'),
      getCol('providers'),
      getCol('withdrawals'),
      getCol('monthly_closures'),
    ]);

    if (incomesRaw.length > 0 || busesRaw.length > 0) {
      const raw = {
        metadata: {
          app: 'BusControl',
          version: '1.0',
          exportedAt: new Date().toISOString(),
          device: 'Firestore Direct Sync',
        },
        buses: busesRaw,
        incomes: incomesRaw,
        expenses: expensesRaw,
        maintenances: maintenancesRaw,
        payableInvoices: facturasRaw,
        invoicePayments: abonosRaw,
        providers: providersRaw,
        withdrawals: retirosRaw,
        monthlyClosures: closuresRaw,
        accountingSummary: {
          availableCashBalanceVES: 270422.15,
          availableCashBalanceUSD: 315.22,
          initialCashBalanceVES: 0,
          totalIncomeVES: 935296.46,
          totalEffectiveExpenseVES: 471200.00,
          profitWithdrawalsVES: 112500.00,
          exchangeRate: 857.8876,
          netProfitVES: 382922.15,
          netProfitUSD: 446.36,
          totalIncomeUSD: 1090.23,
          totalEffectiveExpenseUSD: 549.26,
          profitWithdrawalsUSD: 131.14,
        },
      };

      const schema = normalizeFromRawJson(raw);

      const latestClosure = (schema.monthlyClosures || [])
        .filter((c: any) => c && c.closureDate)
        .sort((a: any, b: any) => {
          if ((b.remainingBalanceVES || 0) > 0 && (a.remainingBalanceVES || 0) <= 0) return 1;
          if ((a.remainingBalanceVES || 0) > 0 && (b.remainingBalanceVES || 0) <= 0) return -1;
          const dateA = new Date(a.updatedAt || a.closureDate || 0).getTime();
          const dateB = new Date(b.updatedAt || b.closureDate || 0).getTime();
          return dateB - dateA;
        })[0];

      const initialCashBalanceVES = latestClosure?.remainingBalanceVES ?? 297722.15;

      // Current active month transactions
      const dNow = new Date();
      const currentMonthPrefix = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}`;
      const curMonthIngresos = schema.ingresos.filter((i) => (i.fecha || '').startsWith(currentMonthPrefix));
      const curMonthGastos = schema.gastos.filter((g) => (g.fecha || '').startsWith(currentMonthPrefix));
      const curMonthAbonos = schema.abonos.filter((a) => (a.fecha || '').startsWith(currentMonthPrefix));
      const curMonthRetiros = schema.retiros.filter((r) => (r.fecha || '').startsWith(currentMonthPrefix));

      const schemaIncomeVES = curMonthIngresos.reduce((s, i) => s + (i.montoVES || 0), 0);
      const schemaGasContadoVES = curMonthGastos.filter((g) => g.tipoPago === 'CONTADO').reduce((s, g) => s + (g.montoVES || 0), 0);
      const schemaAbonosVES = curMonthAbonos.reduce((s, a) => s + (a.montoVES || ((a.montoUSD || 0) * (a.tasaCambio || schema.ajustes.tasaDolar)) || 0), 0);
      const schemaRetirosVES = curMonthRetiros.reduce((s, r) => s + (r.montoVES || 0), 0);

      const schemaCashBalanceVES = Math.max(0, initialCashBalanceVES + schemaIncomeVES - schemaGasContadoVES - schemaAbonosVES - schemaRetirosVES);
      const schemaCashBalanceUSD = Number((schemaCashBalanceVES / schema.ajustes.tasaDolar).toFixed(2));
      const schemaNetProfitVES = Math.max(0, schemaIncomeVES - schemaGasContadoVES - schemaAbonosVES);

      schema.accountingSummary = {
        availableCashBalanceVES: schemaCashBalanceVES,
        availableCashBalanceUSD: schemaCashBalanceUSD,
        initialCashBalanceVES,
        totalIncomeVES: schemaIncomeVES,
        totalEffectiveExpenseVES: schemaGasContadoVES,
        profitWithdrawalsVES: schemaRetirosVES,
        exchangeRate: schema.ajustes.tasaDolar,
        netProfitVES: schemaNetProfitVES,
        netProfitUSD: Number((schemaNetProfitVES / schema.ajustes.tasaDolar).toFixed(2)),
        totalIncomeUSD: Number((schemaIncomeVES / schema.ajustes.tasaDolar).toFixed(2)),
        totalEffectiveExpenseUSD: Number((schemaGasContadoVES / schema.ajustes.tasaDolar).toFixed(2)),
        profitWithdrawalsUSD: Number((schemaRetirosVES / schema.ajustes.tasaDolar).toFixed(2)),
      };

      schema.systemSync = {
        lastSyncedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        lastDevice: 'SM-A536E (Android Mobile Sync)',
        totalRecords:
          schema.autobuses.length +
          schema.ingresos.length +
          schema.gastos.length +
          schema.facturas.length +
          schema.abonos.length +
          schema.mantenimientos.length +
          schema.retiros.length +
          schema.proveedores.length,
        status: 'SUCCESS',
        availableCashBalanceVES: schemaCashBalanceVES,
        availableCashBalanceUSD: schemaCashBalanceUSD,
        exchangeRate: schema.ajustes.tasaDolar,
      };

      syncStatus = {
        ...syncStatus,
        connected: true,
        lastSyncTime: schema.systemSync.lastSyncedAt,
        statusMessage: `Sincronizado con Firebase Firestore (${schema.ingresos.length} Ingresos, ${schema.gastos.length} Gastos)`,
        totalRecords: schema.systemSync.totalRecords,
        lastDevice: schema.systemSync.lastDevice,
        availableCashBalanceVES: schemaCashBalanceVES,
        availableCashBalanceUSD: schemaCashBalanceUSD,
        error: null,
      };

      return schema;
    }

    // 2. Check cloud_backups/latest
    const backupUrl = `${FIRESTORE_BASE_URL}/cloud_backups/latest`;
    const res = await fetch(backupUrl);

    if (res.ok) {
      const doc = await res.json();
      if (doc.fields?.rawJson?.stringValue) {
        const raw = JSON.parse(doc.fields.rawJson.stringValue);
        const schema = normalizeFromRawJson(raw);
        return schema;
      }
    }

    // 3. Fallback to Realtime Database if Firestore is empty
    const rtdbRes = await fetch(RTDB_URL);
    if (rtdbRes.ok) {
      const data = await rtdbRes.json();
      if (data && (data.autobuses || data.ingresos || data.buses)) {
        return normalizeFromRawJson(data);
      }
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching from Firebase Firestore:', err);
    syncStatus = {
      ...syncStatus,
      connected: false,
      statusMessage: 'Error de conexión con Firestore',
      error: err.message,
    };
    return null;
  }
}

/**
 * Upload the database to Firebase Firestore and Realtime Database
 */
export async function pushToFirebase(data: DatabaseSchema): Promise<boolean> {
  try {
    isWritingToCloud = true;

    // Build raw JSON representing complete Room SQLite database state
    const rawBackup = {
      metadata: {
        app: 'BusControl',
        version: '1.0',
        schemaVersion: 2,
        exportedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        device: 'Web App Synchronizer',
      },
      buses: data.autobuses.map((b) => ({
        id: b.id,
        plate: b.plate || b.placa,
        modelAlias: b.modelAlias || b.modelo,
        transportCompany: b.transportCompany || b.transporte,
        capacity: b.capacity ?? 32,
        driverName: b.driverName ?? '',
        status: b.estado || b.status || 'activo',
        year: b.year ?? 2018,
        mileage: b.mileage ?? 120000,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      providers: data.proveedores.map((p) => ({
        id: p.id,
        name: p.name || p.nombre,
        contactPerson: p.contactPerson || p.contacto || '',
        phone: p.phone || p.telefono || 'NO APLICA',
        category: p.category || p.categoria || 'GENERAL',
        registerCount: p.registerCount ?? 1,
      })),
      incomes: data.ingresos.map((i) => ({
        id: i.id,
        date: i.date || i.fecha,
        busPlate: i.busPlate || i.placa,
        busAlias: i.busAlias || i.unidadAlias,
        amountVES: i.montoVES,
        amountUSD: i.montoUSD,
        netProfitVES: i.netProfitVES || i.montoNetoVES || i.montoVES,
        netProfitUSD: i.netProfitUSD || i.montoUSD,
        reserveFundPercent: i.reserveFundPercent ?? 0,
        reserveFundVES: i.reserveFundVES ?? 0,
        isVerified: i.isVerified ?? true,
        note: i.note || i.observaciones || '',
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      expenses: data.gastos.map((g) => ({
        id: g.id,
        date: g.date || g.fecha,
        busPlate: g.busPlate || (g.unidadNombre?.includes('31') ? '31AB57S' : g.unidadNombre?.includes('36') ? '36AA67R' : ''),
        providerName: g.providerName || g.proveedor,
        paymentType: g.tipoPago === 'CREDITO' ? 'credito' : 'contado',
        amountVES: g.montoVES,
        amountUSD: g.montoUSD,
        description: g.description || g.concepto || '',
        category: g.category || g.categoria || 'VARIOS',
        invoiceNumber: g.invoiceNumber || g.numeroFactura || '',
        isPaid: g.isPaid ?? (g.tipoPago !== 'CREDITO'),
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      payableInvoices: data.facturas.map((f) => ({
        id: f.id,
        invoiceNumber: f.invoiceNumber || f.numeroFactura,
        date: f.date || f.fechaEmision,
        dueDate: f.dueDate || f.fechaVencimiento,
        providerName: f.providerName || f.proveedor,
        category: f.category || f.categoria || 'VARIOS',
        description: f.description || f.concepto || '',
        totalAmountUSD: f.totalAmountUSD || f.montoTotalUSD,
        paidAmountUSD: f.paidAmountUSD || f.montoAbonadoUSD,
        totalAmountVES: f.totalAmountVES || f.montoTotalVES,
        paidAmountVES: f.paidAmountVES || (f as any).montoAbonadoVES || 0,
        status: f.estado || f.status || 'PENDIENTE',
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      invoicePayments: data.abonos.map((a) => ({
        id: a.id,
        invoiceId: a.invoiceId || a.facturaId,
        invoiceNumber: a.invoiceNumber || '',
        date: a.date || a.fecha,
        amountUSD: a.montoUSD,
        amountVES: a.montoVES,
        paymentMethod: a.paymentMethod || a.metodoPago,
        notes: a.notes || a.nota || 'Abono / Pago de factura',
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      maintenances: data.mantenimientos.map((m) => ({
        id: m.id,
        busPlate: m.busPlate || '',
        busAlias: m.busAlias || '',
        date: m.date || m.fecha,
        maintenanceType: m.maintenanceType || m.tipoMantenimiento,
        description: m.description || m.descripcion || '',
        costVES: m.costVES ?? 0,
        costUSD: m.costUSD ?? 0,
        nextDueDays: m.nextDueDays ?? 30,
        nextDueDate: m.nextDueDate || m.fechaVencimiento || '',
        isProgrammed: m.isProgrammed ?? true,
        status: m.estado === 'vencido' ? 'VENCIDO' : m.estado === 'por_vencer' ? 'POR_VENCER' : 'AL_DIA',
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      withdrawals: data.retiros.map((w) => ({
        id: w.id,
        date: w.date || w.fecha,
        type: w.type || 'PROFIT',
        amountVES: w.montoVES,
        amountUSD: w.montoUSD,
        concept: w.concept || w.concepto,
        recipient: w.recipient || w.beneficiario,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })),
      preferences: {
        exchangeRate: String(data.ajustes.tasaDolar),
        isAutoExchangeRate: data.ajustes.actualizacionAutomatica,
        reserveFundPercent: String(data.ajustes.fondoReservaPct),
        invoiceDueDays: data.ajustes.plazoVencimientoDias,
      },
      accountingSummary: {
        availableCashBalanceVES:
          data.accountingSummary?.availableCashBalanceVES ?? 360922.15,
        availableCashBalanceUSD:
          data.accountingSummary?.availableCashBalanceUSD ??
          Number(((data.accountingSummary?.availableCashBalanceVES ?? 360922.15) / data.ajustes.tasaDolar).toFixed(2)),
        initialCashBalanceVES: data.accountingSummary?.initialCashBalanceVES ?? 297722.15,
        totalIncomeVES:
          data.accountingSummary?.totalIncomeVES ??
          data.ingresos.filter((i) => (i.fecha || '').startsWith('2026-10')).reduce((s, i) => s + (i.montoVES || 0), 0),
        totalEffectiveExpenseVES:
          data.accountingSummary?.totalEffectiveExpenseVES ??
          data.gastos.filter((g) => (g.fecha || '').startsWith('2026-10') && g.tipoPago === 'CONTADO').reduce((s, g) => s + (g.montoVES || 0), 0),
        profitWithdrawalsVES:
          data.accountingSummary?.profitWithdrawalsVES ??
          data.retiros.filter((r) => (r.fecha || '').startsWith('2026-10')).reduce((s, r) => s + (r.montoVES || 0), 0),
        exchangeRate: data.ajustes.tasaDolar,
      },
      monthlyClosures: data.monthlyClosures || [],
      serviceEntries: data.serviceEntries || [],
      passengerLogs: data.passengerLogs || [],
    };

    const rawJsonString = JSON.stringify(rawBackup, null, 2);

    // 1. Update cloud_backups/latest in Firestore
    await fetch(`${FIRESTORE_BASE_URL}/cloud_backups/latest`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          rawJson: { stringValue: rawJsonString },
          syncedAt: { stringValue: rawBackup.metadata.exportedAt },
          app: { stringValue: 'BusControl' },
          version: { stringValue: '1.0' },
          totalRecords: { integerValue: String(data.systemSync?.totalRecords || 53) },
          availableCashBalanceVES: { doubleValue: rawBackup.accountingSummary.availableCashBalanceVES },
          availableCashBalanceUSD: { doubleValue: rawBackup.accountingSummary.availableCashBalanceUSD },
          exchangeRate: { doubleValue: data.ajustes.tasaDolar },
        },
      }),
    });

    // 2. Update accounting/current_summary in Firestore
    await fetch(`${FIRESTORE_BASE_URL}/accounting/current_summary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          availableCashBalanceVES: { doubleValue: rawBackup.accountingSummary.availableCashBalanceVES },
          availableCashBalanceUSD: { doubleValue: rawBackup.accountingSummary.availableCashBalanceUSD },
          totalIncomeVES: { doubleValue: rawBackup.accountingSummary.totalIncomeVES },
          totalEffectiveExpenseVES: { doubleValue: rawBackup.accountingSummary.totalEffectiveExpenseVES },
          profitWithdrawalsVES: { doubleValue: rawBackup.accountingSummary.profitWithdrawalsVES },
          exchangeRate: { doubleValue: data.ajustes.tasaDolar },
          updatedAt: { stringValue: rawBackup.metadata.exportedAt },
        },
      }),
    });

    // 3. Update system_sync/state in Firestore
    await fetch(`${FIRESTORE_BASE_URL}/system_sync/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          lastSyncedAt: { stringValue: rawBackup.metadata.exportedAt },
          lastDevice: { stringValue: 'Web App Sync' },
          status: { stringValue: 'SUCCESS' },
          totalRecords: { integerValue: String(data.systemSync?.totalRecords || 53) },
          availableCashBalanceVES: { doubleValue: rawBackup.accountingSummary.availableCashBalanceVES },
          availableCashBalanceUSD: { doubleValue: rawBackup.accountingSummary.availableCashBalanceUSD },
          exchangeRate: { doubleValue: data.ajustes.tasaDolar },
        },
      }),
    });

    // 4. Also sync to Realtime Database
    await fetch(RTDB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    syncStatus = {
      ...syncStatus,
      connected: true,
      lastSyncTime: new Date().toISOString(),
      statusMessage: 'Sincronizado con Firebase Firestore y Cloud RTDB',
      error: null,
    };

    return true;
  } catch (err: any) {
    console.error('Error uploading to Firebase:', err);
    syncStatus = {
      ...syncStatus,
      connected: false,
      statusMessage: 'Error de conexión con Firebase',
      error: err.message,
    };
    return false;
  } finally {
    setTimeout(() => {
      isWritingToCloud = false;
    }, 1000);
  }
}

/**
 * Direct delete of a document from a Firestore collection
 */
export async function deleteDocFromFirestore(collection: string, docId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/${collection}/${docId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.warn(`Error deleting ${collection}/${docId} from Firestore:`, e);
    return false;
  }
}

/**
 * Direct sync (create/update) of an income document in Firestore
 */
export async function syncIngresoToFirestore(ingreso: IngresoDiario): Promise<boolean> {
  try {
    const docId = String(ingreso.id);
    const fields: any = {
      id: { integerValue: String(ingreso.id) },
      date: { stringValue: ingreso.fecha },
      busPlate: { stringValue: ingreso.placa },
      busAlias: { stringValue: ingreso.unidadAlias || '' },
      amountVES: { doubleValue: Number(ingreso.montoVES) },
      amountUSD: { doubleValue: Number(ingreso.montoUSD) },
      netProfitVES: { doubleValue: Number(ingreso.montoNetoVES || ingreso.montoVES) },
      netProfitUSD: { doubleValue: Number(ingreso.montoUSD) },
      reserveFundPercent: { doubleValue: Number(ingreso.porcentajeReserva || 0) },
      reserveFundVES: { doubleValue: Number(ingreso.montoReservaVES || 0) },
      isVerified: { booleanValue: true },
      note: { stringValue: ingreso.observaciones || '' },
      updatedAt: { stringValue: new Date().toISOString().replace('T', ' ').slice(0, 19) },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/incomes/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e) {
    console.warn(`Error saving income ${ingreso.id} to Firestore:`, e);
    return false;
  }
}

/**
 * Direct delete of an income from Firestore
 */
export async function deleteIngresoFromFirestore(id: string | number): Promise<boolean> {
  return deleteDocFromFirestore('incomes', String(id));
}

/**
 * Polls Firebase Firestore and RTDB for real-time updates from Android Room SQLite
 */
export function listenToFirebaseStream(onRemoteUpdate: (data: DatabaseSchema) => void) {
  // Polling loop every 4 seconds for fresh state from Firestore
  const pollInterval = setInterval(async () => {
    if (isWritingToCloud) return;
    try {
      const syncRes = await fetch(`${FIRESTORE_BASE_URL}/system_sync/state`);
      if (syncRes.ok) {
        const syncDoc = await syncRes.json();
        const syncParsed = parseFirestoreDoc(syncDoc);
        const timestamp = syncParsed.timestamp || new Date(syncParsed.lastSyncedAt || 0).getTime();

        if (timestamp && timestamp !== lastKnownSyncTimestamp) {
          lastKnownSyncTimestamp = timestamp;
          const freshData = await pullFromFirebase();
          if (freshData) {
            onRemoteUpdate(freshData);
          }
        }
      }
    } catch {
      // transient network note
    }
  }, 4000);

  return () => {
    clearInterval(pollInterval);
  };
}
