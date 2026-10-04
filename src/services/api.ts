import { DatabaseSchema, IngresoDiario, GastoOperativo, FacturaPorPagar, Mantenimiento, RetiroUtilidad, Autobus, Proveedor, AjustesSistema } from '../types/index.ts';

type Listener = (data: DatabaseSchema) => void;
const listeners = new Set<Listener>();

let currentData: DatabaseSchema | null = null;
let eventSource: EventSource | null = null;

const STORAGE_KEY = 'buscontrol_db_cache_v1';

function getLocalCache(): DatabaseSchema | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore cache parse errors
  }
  return null;
}

function saveLocalCache(data: DatabaseSchema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function subscribeToDatabase(listener: Listener): () => void {
  listeners.add(listener);
  if (currentData) {
    listener(currentData);
  } else {
    const cached = getLocalCache();
    if (cached) {
      currentData = cached;
      listener(cached);
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(data: DatabaseSchema) {
  currentData = data;
  saveLocalCache(data);
  listeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn('Listener notification warning:', e);
    }
  });
}

let isFetching = false;
let retryTimeout: NodeJS.Timeout | null = null;

export async function fetchSnapshot(): Promise<DatabaseSchema | null> {
  if (isFetching) return currentData;
  isFetching = true;

  try {
    const res = await fetch('/api/database');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: DatabaseSchema = await res.json();
    notifyListeners(data);
    return data;
  } catch (err: any) {
    // Graceful network handling: if server is restarting or offline, fallback to cached state
    if (!currentData) {
      const cached = getLocalCache();
      if (cached) {
        notifyListeners(cached);
      }
    }
    // Schedule a quiet retry if we don't have active eventSource
    if (!eventSource && !retryTimeout) {
      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        fetchSnapshot();
      }, 5000);
    }
    return currentData;
  } finally {
    isFetching = false;
  }
}

export function initRealtimeSync() {
  // Pre-load from local storage instantly
  const cached = getLocalCache();
  if (cached && !currentData) {
    notifyListeners(cached);
  }

  fetchSnapshot();

  if (eventSource) return;

  try {
    eventSource = new EventSource('/api/events');
    
    eventSource.onopen = () => {
      // Upon successful connection or reconnection, sync latest server data
      fetchSnapshot();
    };

    eventSource.addEventListener('change', () => {
      // Fetch latest snapshot when change occurs
      fetchSnapshot();
    });

    eventSource.onerror = () => {
      // Browser EventSource automatically reconnects after a delay
      // No aggressive console.error needed during reconnections
    };
  } catch {
    // If SSE is not supported, quietly poll periodically
    setInterval(fetchSnapshot, 10000);
  }
}

export const API = {
  // Ajustes
  async updateAjustes(ajustes: Partial<AjustesSistema>): Promise<AjustesSistema> {
    const res = await fetch('/api/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ajustes),
    });
    const updated = await res.json();
    await fetchSnapshot();
    return updated;
  },

  // Autobuses
  async addAutobus(bus: Omit<Autobus, 'id'>): Promise<Autobus> {
    const res = await fetch('/api/autobuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bus),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async updateAutobus(id: number, bus: Partial<Autobus>): Promise<Autobus> {
    const res = await fetch(`/api/autobuses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bus),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async deleteAutobus(id: number): Promise<boolean> {
    const res = await fetch(`/api/autobuses/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Ingresos
  async addIngreso(data: any): Promise<IngresoDiario> {
    const res = await fetch('/api/ingresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    if (!res.ok) {
      throw new Error(item.error || 'Error al registrar ingreso');
    }
    await fetchSnapshot();
    return item;
  },

  async updateIngreso(id: number | string, data: any): Promise<IngresoDiario> {
    const res = await fetch(`/api/ingresos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    if (!res.ok) {
      throw new Error(item.error || 'Error al actualizar ingreso');
    }
    await fetchSnapshot();
    return item;
  },

  async deleteIngreso(id: number | string): Promise<boolean> {
    const res = await fetch(`/api/ingresos/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Gastos
  async addGasto(data: any): Promise<GastoOperativo> {
    const res = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async deleteGasto(id: number): Promise<boolean> {
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Abonos a Facturas
  async addAbono(facturaId: number, montoUSD: number, metodoPago: string, nota?: string): Promise<any> {
    const res = await fetch(`/api/facturas/${facturaId}/abonos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montoUSD, metodoPago, nota }),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  // Mantenimientos
  async addMantenimiento(data: any): Promise<Mantenimiento> {
    const res = await fetch('/api/mantenimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async deleteMantenimiento(id: number): Promise<boolean> {
    const res = await fetch(`/api/mantenimientos/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Retiros
  async addRetiro(data: any): Promise<RetiroUtilidad> {
    const res = await fetch('/api/retiros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async deleteRetiro(id: number): Promise<boolean> {
    const res = await fetch(`/api/retiros/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Proveedores
  async addProveedor(data: Omit<Proveedor, 'id'>): Promise<Proveedor> {
    const res = await fetch('/api/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async updateProveedor(id: number, data: Partial<Proveedor>): Promise<Proveedor> {
    const res = await fetch(`/api/proveedores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    await fetchSnapshot();
    return item;
  },

  async deleteProveedor(id: number): Promise<boolean> {
    const res = await fetch(`/api/proveedores/${id}`, { method: 'DELETE' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Fondo Reserva
  async usarFondoReserva(montoVES: number, motivo: string): Promise<boolean> {
    const res = await fetch('/api/fondo-reserva/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montoVES, motivo }),
    });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Base de datos / Backup
  async resetDatabase(): Promise<boolean> {
    const res = await fetch('/api/database/reset', { method: 'POST' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  async restoreDemo(): Promise<boolean> {
    const res = await fetch('/api/database/restore-demo', { method: 'POST' });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  async restoreBackup(backupData: DatabaseSchema): Promise<boolean> {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    });
    const json = await res.json();
    await fetchSnapshot();
    return json.success;
  },

  // Firebase Cloud Methods
  async getFirebaseStatus(): Promise<any> {
    try {
      const res = await fetch('/api/firebase/status');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async syncFirebaseNow(): Promise<any> {
    try {
      const res = await fetch('/api/firebase/sync-now', { method: 'POST' });
      const json = await res.json();
      await fetchSnapshot();
      return json;
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  },

  async pushToFirebase(): Promise<any> {
    try {
      const res = await fetch('/api/firebase/push', { method: 'POST' });
      const json = await res.json();
      return json;
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  },

  async pullFromFirebase(): Promise<any> {
    try {
      const res = await fetch('/api/firebase/pull', { method: 'POST' });
      const json = await res.json();
      await fetchSnapshot();
      return json;
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  },
};
