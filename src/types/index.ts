export type AutobusEstado = 'activo' | 'en taller' | 'inactivo';

export interface Autobus {
  id: number;
  plate?: string;
  placa: string;
  modelAlias?: string;
  modelo: string;
  transportCompany?: string;
  transporte: string;
  status?: string;
  estado: AutobusEstado;
  capacity?: number;
  driverName?: string;
  year?: number;
  mileage?: number;
  alias?: string;
  numero?: string;
  updatedAt?: string;
}

export interface IngresoDiario {
  id: number;
  date?: string; // YYYY-MM-DD
  fecha: string; // YYYY-MM-DD
  busPlate?: string;
  placa: string;
  busAlias?: string;
  unidadAlias: string;
  amountVES?: number;
  montoVES: number;
  amountUSD?: number;
  montoUSD: number;
  netProfitVES?: number;
  montoNetoVES?: number;
  netProfitUSD?: number;
  reserveFundPercent?: number;
  porcentajeReserva?: number;
  reserveFundVES?: number;
  montoReservaVES?: number;
  isVerified?: boolean;
  note?: string;
  observaciones?: string;
  tasaCambio?: number;
  createdAt?: string;
  updatedAt?: string;
  autobusId?: number;
}

export interface GastoOperativo {
  id: number;
  date?: string; // YYYY-MM-DD
  fecha: string; // YYYY-MM-DD
  busPlate?: string;
  unidadNombre: string; // e.g. "31AB57S - VERDE OSCAR" or "Flota General"
  category?: string;
  categoria: string;
  providerName?: string;
  proveedor: string;
  paymentType?: string; // "contado" | "credito"
  tipoPago: 'CONTADO' | 'CREDITO';
  amountVES?: number;
  montoVES: number;
  amountUSD?: number;
  montoUSD: number;
  description?: string;
  concepto: string;
  invoiceNumber?: string;
  numeroFactura?: string;
  isPaid?: boolean;
  facturaId?: number | null;
  autobusId?: number | null;
  tasaCambio?: number;
  createdAt?: string;
}

export interface AbonoFactura {
  id: number;
  invoiceId?: number;
  facturaId: number;
  invoiceNumber?: string;
  date?: string;
  fecha: string;
  amountUSD?: number;
  montoUSD: number;
  amountVES?: number;
  montoVES: number;
  paymentMethod?: string;
  metodoPago: string;
  notes?: string;
  nota?: string;
  tasaCambio?: number;
  createdAt?: string;
}

export interface FacturaPorPagar {
  id: number;
  invoiceNumber?: string; // e.g. "F-50157"
  numeroFactura: string;
  date?: string;
  fechaEmision: string;
  dueDate?: string;
  fechaVencimiento: string;
  providerName?: string;
  proveedor: string;
  category?: string;
  categoria?: string;
  description?: string;
  descripcion?: string;
  concepto: string;
  totalAmountUSD?: number;
  montoTotalUSD: number;
  paidAmountUSD?: number;
  montoAbonadoUSD: number;
  deudaRestanteUSD: number;
  totalAmountVES?: number;
  montoTotalVES: number;
  paidAmountVES?: number;
  montoAbonadoVES?: number;
  deudaRestanteVES: number;
  status?: 'PENDIENTE' | 'PAGADA';
  estado: 'PENDIENTE' | 'PAGADA';
  tasaCambio?: number;
  createdAt?: string;
  abonos?: AbonoFactura[];
}

export interface Mantenimiento {
  id: number;
  busPlate?: string;
  placa?: string;
  busAlias?: string;
  unidadNombre: string; // e.g. "36AA67R • AZUL JUAN"
  date?: string;
  fecha: string;
  maintenanceType?: string;
  tipoMantenimiento: string;
  description?: string;
  descripcion: string;
  status?: string; // "AL_DIA" | "POR_VENCER" | "VENCIDO"
  estado: 'al_dia' | 'por_vencer' | 'vencido';
  nextDueDate?: string;
  fechaVencimiento?: string;
  nextDueDays?: number;
  isProgrammed?: boolean;
  alarmaActiva?: boolean;
  costVES?: number;
  costoVES?: number;
  costUSD?: number;
  kilometraje?: number;
  autobusId?: number;
  createdAt?: string;
}

export interface RetiroUtilidad {
  id: number;
  date?: string;
  fecha: string;
  type?: string;
  recipient?: string;
  beneficiario: string;
  concept?: string;
  concepto: string;
  amountVES?: number;
  montoVES: number;
  amountUSD?: number;
  montoUSD: number;
  tasaCambio?: number;
  createdAt?: string;
}

export interface Proveedor {
  id: number;
  name?: string;
  nombre: string;
  contactPerson?: string;
  contacto?: string;
  phone?: string;
  telefono?: string;
  category?: string;
  categoria: string;
  registerCount?: number;
  direccion?: string;
  rif?: string;
}

export interface AccountingSummary {
  availableCashBalanceVES: number;
  availableCashBalanceUSD: number;
  initialCashBalanceVES: number;
  totalIncomeVES: number;
  totalEffectiveExpenseVES: number;
  profitWithdrawalsVES: number;
  exchangeRate: number;
  netProfitVES?: number;
  netProfitUSD?: number;
  totalIncomeUSD?: number;
  totalEffectiveExpenseUSD?: number;
  profitWithdrawalsUSD?: number;
}

export interface SystemSyncState {
  lastSyncedAt: string;
  lastDevice: string;
  lastClientId?: string;
  totalRecords: number;
  status: string;
  availableCashBalanceVES: number;
  availableCashBalanceUSD: number;
  exchangeRate: number;
}

export interface AjustesSistema {
  tasaDolar: number;
  actualizacionAutomatica: boolean;
  ultimaFechaTasa: string;
  tasaFuente: string; // "BCV Oficial"
  fondoReservaPct: number; // default 0.0
  plazoVencimientoDias: number; // default 30
}

export interface DatabaseSchema {
  ajustes: AjustesSistema;
  autobuses: Autobus[];
  categoriasGastos: string[];
  tiposMantenimiento: string[];
  proveedores: Proveedor[];
  ingresos: IngresoDiario[];
  gastos: GastoOperativo[];
  facturas: FacturaPorPagar[];
  abonos: AbonoFactura[];
  mantenimientos: Mantenimiento[];
  retiros: RetiroUtilidad[];
  fondoReserva: {
    saldoVES: number;
    saldoUSD: number;
    historial: Array<{
      id: number;
      fecha: string;
      montoVES: number;
      montoUSD: number;
      motivo: string;
    }>;
  };
  accountingSummary?: AccountingSummary;
  systemSync?: SystemSyncState;
  monthlyClosures?: any[];
  serviceEntries?: any[];
  passengerLogs?: any[];
}
