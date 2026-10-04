import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DB, addSseClient } from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '15mb' }));

// Server-Sent Events (SSE) for Real-Time Sync across all clients
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`);

  addSseClient(res);

  // Keep connection open with heartbeat
  const keepAlive = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Firebase Cloud Sync endpoints
app.get('/api/firebase/status', (_req: Request, res: Response) => {
  res.json(DB.getCloudStatus());
});

app.post('/api/firebase/sync-now', async (_req: Request, res: Response) => {
  const success = await DB.syncFromCloudNow();
  res.json({ success, status: DB.getCloudStatus() });
});

app.post('/api/firebase/push', async (_req: Request, res: Response) => {
  const success = await DB.syncToCloudNow();
  res.json({ success, status: DB.getCloudStatus() });
});

app.post('/api/firebase/pull', async (_req: Request, res: Response) => {
  const success = await DB.syncFromCloudNow();
  res.json({ success, status: DB.getCloudStatus() });
});

// Full database snapshot
app.get('/api/database', (_req: Request, res: Response) => {
  res.json(DB.getSnapshot());
});

// Ajustes
app.get('/api/ajustes', (_req: Request, res: Response) => {
  res.json(DB.getAjustes());
});

app.post('/api/ajustes', (req: Request, res: Response) => {
  const updated = DB.updateAjustes(req.body);
  res.json(updated);
});

// Autobuses
app.get('/api/autobuses', (_req: Request, res: Response) => {
  res.json(DB.getAutobuses());
});

app.post('/api/autobuses', (req: Request, res: Response) => {
  const bus = DB.addAutobus(req.body);
  res.status(201).json(bus);
});

app.put('/api/autobuses/:id', (req: Request, res: Response) => {
  const bus = DB.updateAutobus(parseInt(req.params.id), req.body);
  if (!bus) return res.status(404).json({ error: 'Autobús no encontrado' });
  res.json(bus);
});

app.delete('/api/autobuses/:id', (req: Request, res: Response) => {
  const ok = DB.deleteAutobus(parseInt(req.params.id));
  res.json({ success: ok });
});

// Ingresos Diarios
app.get('/api/ingresos', (_req: Request, res: Response) => {
  res.json(DB.getIngresos());
});

app.post('/api/ingresos', (req: Request, res: Response) => {
  const { fecha, autobusId, placa, unidadAlias, montoVES, tasaCambio, porcentajeReserva, observaciones } = req.body;
  if (!montoVES || !placa) {
    return res.status(400).json({ error: 'Placa y Monto en VES son obligatorios' });
  }
  try {
    const ingreso = DB.addIngreso({
      fecha: fecha || new Date().toISOString().split('T')[0],
      autobusId: Number(autobusId),
      placa,
      unidadAlias: unidadAlias || placa,
      montoVES: Number(montoVES),
      tasaCambio: Number(tasaCambio || DB.getAjustes().tasaDolar),
      montoUSD: 0,
      porcentajeReserva: Number(porcentajeReserva ?? DB.getAjustes().fondoReservaPct),
      montoReservaVES: 0,
      montoNetoVES: 0,
      observaciones,
    } as any);
    res.status(201).json(ingreso);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al registrar ingreso' });
  }
});

app.put('/api/ingresos/:id', (req: Request, res: Response) => {
  try {
    const updated = DB.updateIngreso(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al actualizar ingreso' });
  }
});

app.delete('/api/ingresos/:id', (req: Request, res: Response) => {
  const ok = DB.deleteIngreso(req.params.id);
  res.json({ success: ok });
});

// Gastos Operativos
app.get('/api/gastos', (_req: Request, res: Response) => {
  res.json(DB.getGastos());
});

app.post('/api/gastos', (req: Request, res: Response) => {
  const { fecha, categoria, autobusId, unidadNombre, proveedor, tipoPago, montoVES, montoUSD, concepto, tasaCambio } = req.body;
  const gasto = DB.addGasto({
    fecha: fecha || new Date().toISOString().split('T')[0],
    categoria: categoria || 'OTROS',
    autobusId: autobusId ? Number(autobusId) : null,
    unidadNombre: unidadNombre || 'Flota General',
    proveedor: proveedor || 'GENERAL',
    tipoPago: tipoPago || 'CONTADO',
    montoVES: Number(montoVES || 0),
    montoUSD: Number(montoUSD || 0),
    tasaCambio: Number(tasaCambio || DB.getAjustes().tasaDolar),
    concepto: concepto || '',
  } as any);
  res.status(201).json(gasto);
});

app.delete('/api/gastos/:id', (req: Request, res: Response) => {
  const ok = DB.deleteGasto(parseInt(req.params.id));
  res.json({ success: ok });
});

// Facturas por Pagar
app.get('/api/facturas', (_req: Request, res: Response) => {
  res.json(DB.getFacturas());
});

app.post('/api/facturas/:id/abonos', (req: Request, res: Response) => {
  const { montoUSD, metodoPago, nota } = req.body;
  if (!montoUSD || montoUSD <= 0) {
    return res.status(400).json({ error: 'Monto de abono inválido' });
  }
  const abono = DB.addAbono(parseInt(req.params.id), Number(montoUSD), metodoPago || 'Efectivo USD', nota);
  if (!abono) return res.status(404).json({ error: 'Factura no encontrada' });
  res.status(201).json(abono);
});

// Mantenimiento
app.get('/api/mantenimientos', (_req: Request, res: Response) => {
  res.json(DB.getMantenimientos());
});

app.post('/api/mantenimientos', (req: Request, res: Response) => {
  const { fecha, autobusId, unidadNombre, tipoMantenimiento, descripcion, costoVES, alarmaActiva, fechaVencimiento, kilometraje } = req.body;
  const mantenimiento = DB.addMantenimiento({
    fecha: fecha || new Date().toISOString().split('T')[0],
    autobusId: Number(autobusId),
    unidadNombre: unidadNombre || 'Autobús',
    tipoMantenimiento: tipoMantenimiento || 'REVISIÓN GENERAL',
    descripcion: descripcion || '',
    costoVES: costoVES ? Number(costoVES) : undefined,
    alarmaActiva: alarmaActiva ?? true,
    fechaVencimiento,
    kilometraje: kilometraje ? Number(kilometraje) : undefined,
  } as any);
  res.status(201).json(mantenimiento);
});

app.delete('/api/mantenimientos/:id', (req: Request, res: Response) => {
  const ok = DB.deleteMantenimiento(parseInt(req.params.id));
  res.json({ success: ok });
});

// Retiros
app.get('/api/retiros', (_req: Request, res: Response) => {
  res.json(DB.getRetiros());
});

app.post('/api/retiros', (req: Request, res: Response) => {
  const { fecha, beneficiario, concepto, montoVES, tasaCambio } = req.body;
  if (!montoVES || montoVES <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }
  const retiro = DB.addRetiro({
    fecha: fecha || new Date().toISOString().split('T')[0],
    beneficiario: beneficiario || 'Dueño / Propietario',
    concepto: concepto || 'Retiro de utilidades',
    montoVES: Number(montoVES),
    montoUSD: 0,
    tasaCambio: Number(tasaCambio || DB.getAjustes().tasaDolar),
  } as any);
  res.status(201).json(retiro);
});

app.delete('/api/retiros/:id', (req: Request, res: Response) => {
  const ok = DB.deleteRetiro(parseInt(req.params.id));
  res.json({ success: ok });
});

// Proveedores
app.get('/api/proveedores', (_req: Request, res: Response) => {
  res.json(DB.getProveedores());
});

app.post('/api/proveedores', (req: Request, res: Response) => {
  const p = DB.addProveedor(req.body);
  res.status(201).json(p);
});

app.put('/api/proveedores/:id', (req: Request, res: Response) => {
  const p = DB.updateProveedor(parseInt(req.params.id), req.body);
  if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(p);
});

app.delete('/api/proveedores/:id', (req: Request, res: Response) => {
  const ok = DB.deleteProveedor(parseInt(req.params.id));
  res.json({ success: ok });
});

// Fondo Reserva
app.post('/api/fondo-reserva/usar', (req: Request, res: Response) => {
  const { montoVES, motivo } = req.body;
  const ok = DB.usarFondoReserva(Number(montoVES), motivo || 'Uso de fondo');
  if (!ok) return res.status(400).json({ error: 'Saldo insuficiente en fondo de reserva' });
  res.json({ success: true });
});

// Backup & Restore
app.get('/api/backup/export', (_req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="buscontrol_backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(DB.getSnapshot(), null, 2));
});

app.post('/api/backup/restore', (req: Request, res: Response) => {
  const ok = DB.restoreBackup(req.body);
  if (!ok) return res.status(400).json({ error: 'Archivo de respaldo inválido' });
  res.json({ success: true, message: 'Base de datos restaurada correctamente' });
});

app.post('/api/database/reset', (_req: Request, res: Response) => {
  const empty = DB.resetDatabase();
  res.json({ success: true, data: empty });
});

app.post('/api/database/restore-demo', (_req: Request, res: Response) => {
  const restored = DB.restoreOriginalDemo();
  res.json({ success: true, data: restored });
});

// Start Express server and mount Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for HTML5 history API in dev mode
    app.use('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚍 BusControl backend server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
