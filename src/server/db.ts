import fs from 'fs';
import path from 'path';
import { DatabaseSchema, IngresoDiario, GastoOperativo, FacturaPorPagar, AbonoFactura, Mantenimiento, Autobus, Proveedor, RetiroUtilidad, AjustesSistema } from '../types/index.ts';
import { initialBackupData } from './seedData.ts';
import type { Response } from 'express';
import { pushToFirebase, pullFromFirebase, listenToFirebaseStream, getFirebaseSyncStatus, syncIngresoToFirestore, deleteIngresoFromFirestore } from './firebaseSync.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bus_control_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache + SSE clients
let database: DatabaseSchema;
const sseClients = new Set<Response>();

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db file, restoring initial data:', err);
  }

  // Fallback to initial seed
  saveDatabase(initialBackupData);
  return JSON.parse(JSON.stringify(initialBackupData));
}

function saveDatabase(data: DatabaseSchema, syncWithCloud: boolean = true): void {
  database = data;
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing database to disk:', err);
  }

  // Synchronize to Firebase Realtime Database
  if (syncWithCloud) {
    pushToFirebase(data).catch((e) => console.error('Firebase cloud push error:', e));
  }
}

// Initialize database
database = loadDatabase();

// Connect and bootstrap Firebase sync
setTimeout(async () => {
  try {
    console.log('🔄 Checking Firebase Realtime Database (buscontrol-app-ce582)...');
    const remoteData = await pullFromFirebase();
    if (remoteData && remoteData.autobuses && remoteData.autobuses.length > 0) {
      console.log('📥 Downloaded existing data from Firebase Cloud.');
      database = remoteData;
      saveDatabase(database, false);
      broadcastChange('FIREBASE_SYNCED', database);
    } else {
      console.log('📤 Seeding initial backup data to Firebase Realtime Database...');
      await pushToFirebase(database);
    }

    // Start listening to live changes from Firebase
    listenToFirebaseStream((cloudData) => {
      console.log('⚡ Received live update from Firebase Cloud!');
      database = cloudData;
      saveDatabase(database, false);
      broadcastChange('FIREBASE_LIVE_UPDATE', database);
    });
  } catch (e) {
    console.warn('Firebase bootstrap note:', e);
  }
}, 500);

// Real-time SSE helpers
export function addSseClient(res: Response) {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastChange(action: string, payload?: any) {
  const message = `event: change\ndata: ${JSON.stringify({ action, payload, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Recalculate maintenance statuses based on current date
export function refreshMaintenanceStatuses() {
  const today = new Date().toISOString().split('T')[0];
  database.mantenimientos.forEach((m) => {
    if (m.fechaVencimiento) {
      const diffTime = new Date(m.fechaVencimiento).getTime() - new Date(today).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        m.estado = 'vencido';
      } else if (diffDays <= 7) {
        m.estado = 'por_vencer';
      } else {
        m.estado = 'al_dia';
      }
    }
  });
}

// Recalculate invoice debts
export function refreshInvoices() {
  database.facturas.forEach((f) => {
    const abonos = database.abonos.filter((a) => Number(a.facturaId || a.invoiceId) === Number(f.id));
    const totalAbonado = abonos.length > 0
      ? abonos.reduce((sum, a) => sum + (a.montoUSD || a.amountUSD || 0), 0)
      : (f.estado === 'PAGADA' || f.status === 'PAGADA' ? (f.montoTotalUSD || f.totalAmountUSD || 0) : (f.montoAbonadoUSD || f.paidAmountUSD || 0));
    const totalUSD = f.montoTotalUSD || f.totalAmountUSD || 0;
    f.montoTotalUSD = totalUSD;
    f.totalAmountUSD = totalUSD;
    f.montoAbonadoUSD = Number(totalAbonado.toFixed(2));
    f.paidAmountUSD = f.montoAbonadoUSD;
    f.deudaRestanteUSD = Number(Math.max(0, totalUSD - f.montoAbonadoUSD).toFixed(2));
    f.deudaRestanteVES = Number((f.deudaRestanteUSD * (f.tasaCambio || database.ajustes.tasaDolar)).toFixed(2));
    f.estado = f.deudaRestanteUSD <= 0 ? 'PAGADA' : 'PENDIENTE';
    f.status = f.estado;
    f.abonos = abonos;
  });
}

export const DB = {
  getSnapshot(): DatabaseSchema {
    refreshMaintenanceStatuses();
    refreshInvoices();
    return database;
  },

  // Ajustes
  getAjustes(): AjustesSistema {
    return database.ajustes;
  },

  updateAjustes(newAjustes: Partial<AjustesSistema>): AjustesSistema {
    database.ajustes = { ...database.ajustes, ...newAjustes };
    // If exchange rate updated, update currency conversions for active debts and live rate
    if (newAjustes.tasaDolar) {
      refreshInvoices();
    }
    saveDatabase(database);
    broadcastChange('AJUSTES_UPDATED', database.ajustes);
    return database.ajustes;
  },

  // Autobuses
  getAutobuses(): Autobus[] {
    return database.autobuses;
  },

  addAutobus(bus: Omit<Autobus, 'id'>): Autobus {
    const nextId = database.autobuses.length > 0 ? Math.max(...database.autobuses.map((b) => b.id)) + 1 : 1;
    const newBus: Autobus = { id: nextId, ...bus };
    database.autobuses.push(newBus);
    saveDatabase(database);
    broadcastChange('AUTOBUS_ADDED', newBus);
    return newBus;
  },

  updateAutobus(id: number, data: Partial<Autobus>): Autobus | null {
    const index = database.autobuses.findIndex((b) => b.id === id);
    if (index === -1) return null;
    const updatedBus: Autobus = {
      ...database.autobuses[index],
      ...data,
      alias: data.transporte || data.alias || database.autobuses[index].alias || '',
    };
    database.autobuses[index] = updatedBus;

    // Propagate updates to linked ingresos, gastos, and mantenimientos
    const newTransporte = updatedBus.transporte || updatedBus.alias || '';
    const newPlaca = updatedBus.placa;
    const newModelo = updatedBus.modelo;
    const formattedUnidad = `${newPlaca} - ${newTransporte}${newModelo ? ` (${newModelo})` : ''}`;

    database.ingresos.forEach((ing) => {
      if (ing.autobusId === id) {
        ing.placa = newPlaca;
        ing.unidadAlias = newTransporte;
      }
    });

    database.gastos.forEach((g) => {
      if (g.autobusId === id) {
        g.unidadNombre = formattedUnidad;
      }
    });

    database.mantenimientos.forEach((m) => {
      if (m.autobusId === id) {
        m.unidadNombre = formattedUnidad;
      }
    });

    saveDatabase(database);
    broadcastChange('AUTOBUS_UPDATED', updatedBus);
    return updatedBus;
  },

  deleteAutobus(id: number): boolean {
    const index = database.autobuses.findIndex((b) => b.id === id);
    if (index === -1) return false;
    database.autobuses.splice(index, 1);
    saveDatabase(database);
    broadcastChange('AUTOBUS_DELETED', { id });
    return true;
  },

  // Ingresos
  getIngresos(): IngresoDiario[] {
    return [...database.ingresos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id);
  },

  addIngreso(data: Omit<IngresoDiario, 'id' | 'createdAt'>): IngresoDiario {
    const bus = database.autobuses.find((b) => b.id === Number(data.autobusId));
    const busPlaca = bus ? bus.placa : (data.placa || '');
    const busTransporte = bus ? (bus.transporte || bus.alias || '') : (data.unidadAlias || '');
    const targetBusId = data.autobusId ? Number(data.autobusId) : (bus?.id || 1);

    // Validation: a bus cannot have two incomes on the same day
    const duplicate = database.ingresos.find((i) =>
      i.fecha === data.fecha &&
      (Number(i.autobusId) === targetBusId || (busPlaca && i.placa === busPlaca))
    );
    if (duplicate) {
      throw new Error(`El autobús ${busPlaca || data.placa} ya tiene un ingreso registrado para el día ${data.fecha}. No se permite más de un ingreso diario por unidad.`);
    }

    const nextId = database.ingresos.length > 0 ? Math.max(...database.ingresos.map((i) => Number(i.id) || 0)) + 1 : 1;
    const tasa = data.tasaCambio || database.ajustes.tasaDolar;
    const montoUSD = Number((data.montoVES / tasa).toFixed(2));
    const pctReserva = data.porcentajeReserva ?? database.ajustes.fondoReservaPct;
    const montoReservaVES = Number(((data.montoVES * pctReserva) / 100).toFixed(2));
    const montoNetoVES = Number((data.montoVES - montoReservaVES).toFixed(2));

    const newIngreso: IngresoDiario = {
      id: nextId,
      fecha: data.fecha,
      autobusId: targetBusId,
      placa: busPlaca,
      unidadAlias: busTransporte,
      montoVES: Number(data.montoVES),
      tasaCambio: tasa,
      montoUSD,
      porcentajeReserva: pctReserva,
      montoReservaVES,
      montoNetoVES,
      observaciones: data.observaciones,
      createdAt: new Date().toISOString(),
    };

    database.ingresos.unshift(newIngreso);

    if (montoReservaVES > 0) {
      database.fondoReserva.saldoVES += montoReservaVES;
      database.fondoReserva.saldoUSD += Number((montoReservaVES / tasa).toFixed(2));
      database.fondoReserva.historial.push({
        id: Date.now(),
        fecha: data.fecha,
        montoVES: montoReservaVES,
        montoUSD: Number((montoReservaVES / tasa).toFixed(2)),
        motivo: `Retención ${pctReserva}% de ingreso #${nextId} (${newIngreso.placa})`,
      });
    }

    saveDatabase(database);
    syncIngresoToFirestore(newIngreso).catch((e) => console.warn('Firestore sync error on add:', e));
    broadcastChange('INGRESO_ADDED', newIngreso);
    return newIngreso;
  },

  updateIngreso(id: number | string, data: Partial<IngresoDiario>): IngresoDiario | null {
    const numId = Number(id);
    const index = database.ingresos.findIndex((i) => Number(i.id) === numId || String(i.id) === String(id));
    if (index === -1) return null;

    const existing = database.ingresos[index];
    const oldReserva = existing.montoReservaVES || 0;
    const tasa = data.tasaCambio || existing.tasaCambio || database.ajustes.tasaDolar;
    const montoVES = data.montoVES !== undefined ? Number(data.montoVES) : existing.montoVES;
    const montoUSD = Number((montoVES / tasa).toFixed(2));
    const pctReserva = data.porcentajeReserva !== undefined ? Number(data.porcentajeReserva) : (existing.porcentajeReserva ?? database.ajustes.fondoReservaPct);
    const montoReservaVES = Number(((montoVES * pctReserva) / 100).toFixed(2));
    const montoNetoVES = Number((montoVES - montoReservaVES).toFixed(2));

    const autobusId = data.autobusId !== undefined ? Number(data.autobusId) : existing.autobusId;
    const bus = database.autobuses.find((b) => b.id === autobusId);
    const busPlaca = bus ? bus.placa : (data.placa || existing.placa);
    const busTransporte = bus ? (bus.transporte || bus.alias || '') : (data.unidadAlias || existing.unidadAlias);
    const targetFecha = data.fecha || existing.fecha;

    // Validation: a bus cannot have two incomes on the same day (excluding this record)
    const duplicate = database.ingresos.find((i) =>
      Number(i.id) !== numId &&
      String(i.id) !== String(id) &&
      i.fecha === targetFecha &&
      (Number(i.autobusId) === autobusId || (busPlaca && i.placa === busPlaca))
    );
    if (duplicate) {
      throw new Error(`El autobús ${busPlaca} ya tiene un ingreso registrado para el día ${targetFecha}. No se permite más de un ingreso diario por unidad.`);
    }

    const updatedIngreso: IngresoDiario = {
      ...existing,
      fecha: data.fecha || existing.fecha,
      autobusId,
      placa: busPlaca,
      unidadAlias: busTransporte,
      montoVES,
      tasaCambio: tasa,
      montoUSD,
      porcentajeReserva: pctReserva,
      montoReservaVES,
      montoNetoVES,
      observaciones: data.observaciones !== undefined ? data.observaciones : existing.observaciones,
      updatedAt: new Date().toISOString(),
    };

    database.ingresos[index] = updatedIngreso;

    // Adjust reservation fund
    const diffReserva = montoReservaVES - oldReserva;
    if (diffReserva !== 0) {
      database.fondoReserva.saldoVES = Math.max(0, database.fondoReserva.saldoVES + diffReserva);
      database.fondoReserva.saldoUSD = Math.max(0, database.fondoReserva.saldoUSD + (diffReserva / tasa));
    }

    saveDatabase(database);
    syncIngresoToFirestore(updatedIngreso).catch((e) => console.warn('Firestore sync error on update:', e));
    broadcastChange('INGRESO_UPDATED', updatedIngreso);
    return updatedIngreso;
  },

  deleteIngreso(id: number | string): boolean {
    const numId = Number(id);
    const index = database.ingresos.findIndex((i) => Number(i.id) === numId || String(i.id) === String(id));
    if (index === -1) return false;
    const [deleted] = database.ingresos.splice(index, 1);
    if (deleted.montoReservaVES && deleted.montoReservaVES > 0) {
      const deletedRate = deleted.tasaCambio || database.ajustes.tasaDolar;
      database.fondoReserva.saldoVES = Math.max(0, database.fondoReserva.saldoVES - deleted.montoReservaVES);
      database.fondoReserva.saldoUSD = Math.max(0, database.fondoReserva.saldoUSD - (deleted.montoReservaVES / deletedRate));
    }
    saveDatabase(database);
    deleteIngresoFromFirestore(String(deleted.id)).catch((e) => console.warn('Firestore delete error on delete:', e));
    broadcastChange('INGRESO_DELETED', { id: deleted.id });
    return true;
  },

  // Gastos
  getGastos(): GastoOperativo[] {
    return [...database.gastos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id);
  },

  addGasto(data: Omit<GastoOperativo, 'id' | 'createdAt'>): GastoOperativo {
    const nextId = database.gastos.length > 0 ? Math.max(...database.gastos.map((g) => g.id)) + 1 : 1;
    const tasa = data.tasaCambio || database.ajustes.tasaDolar;
    let montoVES = data.montoVES;
    let montoUSD = data.montoUSD;

    if (montoVES && !montoUSD) {
      montoUSD = Number((montoVES / tasa).toFixed(2));
    } else if (montoUSD && !montoVES) {
      montoVES = Number((montoUSD * tasa).toFixed(2));
    }

    let facturaId = data.facturaId || null;

    // If payment type is CREDITO, automatically create a FacturaPorPagar!
    if (data.tipoPago === 'CREDITO') {
      const nextFacturaId = database.facturas.length > 0 ? Math.max(...database.facturas.map((f) => f.id)) + 1 : 1;
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const facturaNum = `F-${randomNum}`;

      const fechaEmision = data.fecha;
      const plazo = database.ajustes.plazoVencimientoDias || 30;
      const emisionDate = new Date(fechaEmision);
      emisionDate.setDate(emisionDate.getDate() + plazo);
      const fechaVencimiento = emisionDate.toISOString().split('T')[0];

      const newFactura: FacturaPorPagar = {
        id: nextFacturaId,
        numeroFactura: facturaNum,
        proveedor: data.proveedor,
        concepto: data.concepto,
        montoTotalUSD: montoUSD,
        montoAbonadoUSD: 0,
        deudaRestanteUSD: montoUSD,
        montoTotalVES: montoVES,
        deudaRestanteVES: montoVES,
        tasaCambio: tasa,
        fechaEmision,
        fechaVencimiento,
        estado: 'PENDIENTE',
        createdAt: new Date().toISOString(),
        abonos: [],
      };
      database.facturas.push(newFactura);
      facturaId = nextFacturaId;
    }

    const newGasto: GastoOperativo = {
      id: nextId,
      ...data,
      montoVES,
      montoUSD,
      tasaCambio: tasa,
      facturaId,
      createdAt: new Date().toISOString(),
    };

    database.gastos.unshift(newGasto);
    saveDatabase(database);
    broadcastChange('GASTO_ADDED', newGasto);
    return newGasto;
  },

  deleteGasto(id: number): boolean {
    const index = database.gastos.findIndex((g) => g.id === id);
    if (index === -1) return false;
    database.gastos.splice(index, 1);
    saveDatabase(database);
    broadcastChange('GASTO_DELETED', { id });
    return true;
  },

  // Facturas y Abonos
  getFacturas(): FacturaPorPagar[] {
    refreshInvoices();
    return [...database.facturas].sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime() || b.id - a.id);
  },

  addAbono(facturaId: number, montoUSD: number, metodoPago: string, nota?: string): AbonoFactura | null {
    const factura = database.facturas.find((f) => f.id === facturaId);
    if (!factura) return null;

    const nextId = database.abonos.length > 0 ? Math.max(...database.abonos.map((a) => a.id)) + 1 : 1;
    const tasa = database.ajustes.tasaDolar;
    const montoVES = Number((montoUSD * tasa).toFixed(2));
    const fecha = new Date().toISOString().split('T')[0];

    const newAbono: AbonoFactura = {
      id: nextId,
      facturaId,
      fecha,
      montoUSD,
      montoVES,
      tasaCambio: tasa,
      metodoPago,
      nota: nota || `Abono a ${factura.numeroFactura}`,
      createdAt: new Date().toISOString(),
    };

    database.abonos.push(newAbono);
    refreshInvoices();
    saveDatabase(database);
    broadcastChange('ABONO_ADDED', newAbono);
    return newAbono;
  },

  // Mantenimiento
  getMantenimientos(): Mantenimiento[] {
    refreshMaintenanceStatuses();
    return [...database.mantenimientos].sort((a, b) => {
      if (a.fechaVencimiento && b.fechaVencimiento) {
        return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
      }
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  },

  addMantenimiento(data: Omit<Mantenimiento, 'id' | 'createdAt' | 'estado'>): Mantenimiento {
    const nextId = database.mantenimientos.length > 0 ? Math.max(...database.mantenimientos.map((m) => m.id)) + 1 : 1;
    let estado: Mantenimiento['estado'] = 'al_dia';
    if (data.fechaVencimiento) {
      const today = new Date().toISOString().split('T')[0];
      const diffTime = new Date(data.fechaVencimiento).getTime() - new Date(today).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) estado = 'vencido';
      else if (diffDays <= 7) estado = 'por_vencer';
      else estado = 'al_dia';
    }

    const newMantenimiento: Mantenimiento = {
      id: nextId,
      ...data,
      estado,
      createdAt: new Date().toISOString(),
    };

    database.mantenimientos.push(newMantenimiento);
    saveDatabase(database);
    broadcastChange('MANTENIMIENTO_ADDED', newMantenimiento);
    return newMantenimiento;
  },

  deleteMantenimiento(id: number): boolean {
    const index = database.mantenimientos.findIndex((m) => m.id === id);
    if (index === -1) return false;
    database.mantenimientos.splice(index, 1);
    saveDatabase(database);
    broadcastChange('MANTENIMIENTO_DELETED', { id });
    return true;
  },

  // Retiros de Utilidad
  getRetiros(): RetiroUtilidad[] {
    return [...database.retiros].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id);
  },

  addRetiro(data: Omit<RetiroUtilidad, 'id' | 'createdAt'>): RetiroUtilidad {
    const nextId = database.retiros.length > 0 ? Math.max(...database.retiros.map((r) => r.id)) + 1 : 1;
    const tasa = data.tasaCambio || database.ajustes.tasaDolar;
    const montoUSD = Number((data.montoVES / tasa).toFixed(2));

    const newRetiro: RetiroUtilidad = {
      id: nextId,
      ...data,
      montoUSD,
      tasaCambio: tasa,
      createdAt: new Date().toISOString(),
    };

    database.retiros.unshift(newRetiro);
    saveDatabase(database);
    broadcastChange('RETIRO_ADDED', newRetiro);
    return newRetiro;
  },

  deleteRetiro(id: number): boolean {
    const index = database.retiros.findIndex((r) => r.id === id);
    if (index === -1) return false;
    database.retiros.splice(index, 1);
    saveDatabase(database);
    broadcastChange('RETIRO_DELETED', { id });
    return true;
  },

  // Proveedores
  getProveedores(): Proveedor[] {
    return database.proveedores || [];
  },

  addProveedor(p: any): Proveedor {
    const list = database.proveedores || [];
    const nextId = list.length > 0 ? Math.max(...list.map((pr) => pr.id)) + 1 : 1;
    const name = (p.name || p.nombre || '').toUpperCase();
    const contact = (p.contactPerson || p.contacto || p.contact || 'NO APLICA').toUpperCase();
    const phone = p.phone || p.telefono || 'NO APLICA';
    const category = (p.category || p.categoria || 'GENERAL').toUpperCase();
    const registerCount = Number(p.registerCount ?? p.cantidadOperaciones ?? 1);

    const newProv: Proveedor = {
      id: nextId,
      name,
      nombre: name,
      contactPerson: contact,
      contacto: contact,
      phone,
      telefono: phone,
      category,
      categoria: category,
      registerCount,
      direccion: p.direccion || '',
      rif: p.rif || '',
    };
    database.proveedores = [...list, newProv];
    saveDatabase(database);
    broadcastChange('PROVEEDOR_ADDED', newProv);
    return newProv;
  },

  updateProveedor(id: number, p: any): Proveedor | null {
    const list = database.proveedores || [];
    const idx = list.findIndex((pr) => pr.id === id);
    if (idx === -1) return null;
    const current = list[idx];
    const name = (p.name || p.nombre || current.name || current.nombre || '').toUpperCase();
    const contact = (p.contactPerson || p.contacto || p.contact || current.contactPerson || current.contacto || 'NO APLICA').toUpperCase();
    const phone = p.phone || p.telefono || current.phone || current.telefono || 'NO APLICA';
    const category = (p.category || p.categoria || current.category || current.categoria || 'GENERAL').toUpperCase();
    const registerCount = Number(p.registerCount ?? current.registerCount ?? 1);

    const updated: Proveedor = {
      ...current,
      ...p,
      name,
      nombre: name,
      contactPerson: contact,
      contacto: contact,
      phone,
      telefono: phone,
      category,
      categoria: category,
      registerCount,
    };
    database.proveedores[idx] = updated;
    saveDatabase(database);
    broadcastChange('PROVEEDOR_UPDATED', updated);
    return updated;
  },

  deleteProveedor(id: number): boolean {
    const list = database.proveedores || [];
    const initialLen = list.length;
    database.proveedores = list.filter((pr) => pr.id !== id);
    if (database.proveedores.length !== initialLen) {
      saveDatabase(database);
      broadcastChange('PROVEEDOR_DELETED', { id });
      return true;
    }
    return false;
  },

  // Fondo de Reserva egreso
  usarFondoReserva(montoVES: number, motivo: string): boolean {
    if (montoVES > database.fondoReserva.saldoVES) return false;
    const tasa = database.ajustes.tasaDolar;
    const montoUSD = Number((montoVES / tasa).toFixed(2));
    database.fondoReserva.saldoVES = Number((database.fondoReserva.saldoVES - montoVES).toFixed(2));
    database.fondoReserva.saldoUSD = Number((database.fondoReserva.saldoUSD - montoUSD).toFixed(2));
    database.fondoReserva.historial.push({
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      montoVES,
      montoUSD,
      motivo,
    });
    saveDatabase(database);
    broadcastChange('FONDO_RESERVA_UPDATED', database.fondoReserva);
    return true;
  },

  // Backup & Reset
  restoreBackup(backup: DatabaseSchema): boolean {
    if (!backup || !backup.autobuses || !backup.ingresos) {
      return false;
    }
    database = backup;
    saveDatabase(database);
    broadcastChange('DATABASE_RESTORED', database);
    return true;
  },

  resetDatabase(): DatabaseSchema {
    // Reset to empty structure for clean testing
    database = {
      ajustes: {
        tasaDolar: 857.01,
        actualizacionAutomatica: true,
        ultimaFechaTasa: new Date().toLocaleDateString('es-VE'),
        tasaFuente: 'BCV Oficial',
        fondoReservaPct: 0.0,
        plazoVencimientoDias: 30,
      },
      autobuses: [],
      categoriasGastos: initialBackupData.categoriasGastos,
      tiposMantenimiento: initialBackupData.tiposMantenimiento,
      proveedores: [],
      ingresos: [],
      gastos: [],
      facturas: [],
      abonos: [],
      mantenimientos: [],
      retiros: [],
      fondoReserva: { saldoVES: 0, saldoUSD: 0, historial: [] },
    };
    saveDatabase(database);
    broadcastChange('DATABASE_RESET');
    return database;
  },

  restoreOriginalDemo(): DatabaseSchema {
    database = JSON.parse(JSON.stringify(initialBackupData));
    saveDatabase(database);
    broadcastChange('DATABASE_RESTORED', database);
    return database;
  },

  getCloudStatus() {
    return getFirebaseSyncStatus();
  },

  async syncFromCloudNow(): Promise<boolean> {
    const remote = await pullFromFirebase();
    if (remote && remote.autobuses) {
      database = remote;
      saveDatabase(database, false);
      broadcastChange('FIREBASE_SYNCED', database);
      return true;
    }
    return false;
  },

  async syncToCloudNow(): Promise<boolean> {
    return await pushToFirebase(database);
  },
};
