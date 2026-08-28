const express = require('express');
const db = require('./db');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connections
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// --- API Routes ---

// Get all machines
app.get('/api/machines', (req, res) => {
  const machines = db.prepare('SELECT * FROM machines ORDER BY id').all();
  res.json(machines);
});

// Get single machine
app.get('/api/machines/:id', (req, res) => {
  const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  res.json(machine);
});

// Update machine status/sensor data
app.put('/api/machines/:id', (req, res) => {
  const { status, temperature, pressure, flow_rate, power } = req.body;
  const stmt = db.prepare(`
    UPDATE machines SET status = COALESCE(?, status), temperature = COALESCE(?, temperature),
    pressure = COALESCE(?, pressure), flow_rate = COALESCE(?, flow_rate),
    power = COALESCE(?, power), updated_at = datetime('now','localtime') WHERE id = ?
  `);
  stmt.run(status, temperature, pressure, flow_rate, power, req.params.id);
  
  const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(req.params.id);
  
  // Log the data
  db.prepare(`INSERT INTO machine_logs (machine_id, status, temperature, pressure, flow_rate, power) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(req.params.id, machine.status, machine.temperature, machine.pressure, machine.flow_rate, machine.power);
  
  broadcast({ type: 'machine_update', data: machine });
  res.json(machine);
});

// Get machine logs
app.get('/api/machines/:id/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM machine_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(logs);
});

// Get all spare parts
app.get('/api/parts', (req, res) => {
  const parts = db.prepare('SELECT * FROM spare_parts ORDER BY category, name').all();
  res.json(parts);
});

// Get single part
app.get('/api/parts/:id', (req, res) => {
  const part = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(req.params.id);
  if (!part) return res.status(404).json({ error: 'Part not found' });
  res.json(part);
});

// Add spare part
app.post('/api/parts', (req, res) => {
  const { part_number, name, category, stock, min_stock, unit, unit_price, location, supplier } = req.body;
  const stmt = db.prepare(`INSERT INTO spare_parts (part_number, name, category, stock, min_stock, unit, unit_price, location, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const info = stmt.run(part_number, name, category, stock || 0, min_stock || 0, unit || 'pcs', unit_price || 0, location, supplier);
  const part = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(info.lastInsertRowid);
  broadcast({ type: 'part_update', data: part });
  res.json(part);
});

// Update spare part
app.put('/api/parts/:id', (req, res) => {
  const { part_number, name, category, stock, min_stock, unit, unit_price, location, supplier } = req.body;
  const stmt = db.prepare(`UPDATE spare_parts SET part_number = COALESCE(?, part_number), name = COALESCE(?, name), category = COALESCE(?, category), stock = COALESCE(?, stock), min_stock = COALESCE(?, min_stock), unit = COALESCE(?, unit), unit_price = COALESCE(?, unit_price), location = COALESCE(?, location), supplier = COALESCE(?, supplier) WHERE id = ?`);
  stmt.run(part_number, name, category, stock, min_stock, unit, unit_price, location, supplier, req.params.id);
  const part = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(req.params.id);
  broadcast({ type: 'part_update', data: part });
  res.json(part);
});

// Delete spare part
app.delete('/api/parts/:id', (req, res) => {
  db.prepare('DELETE FROM spare_parts WHERE id = ?').run(req.params.id);
  broadcast({ type: 'part_delete', data: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// Log spare part usage
app.post('/api/usage', (req, res) => {
  const { machine_id, part_id, quantity, operator, notes } = req.body;
  const part = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(part_id);
  if (!part) return res.status(404).json({ error: 'Part not found' });
  if (part.stock < quantity) return res.status(400).json({ error: 'Stock tidak mencukupi' });

  db.prepare('UPDATE spare_parts SET stock = stock - ? WHERE id = ?').run(quantity, part_id);
  db.prepare(`INSERT INTO usage_logs (machine_id, part_id, quantity, operator, notes) VALUES (?, ?, ?, ?, ?)`).run(machine_id, part_id, quantity, operator, notes);
  
  // Update machine_parts
  const mp = db.prepare('SELECT * FROM machine_parts WHERE machine_id = ? AND part_id = ?').get(machine_id, part_id);
  if (mp) {
    db.prepare('UPDATE machine_parts SET quantity_used = quantity_used + ? WHERE machine_id = ? AND part_id = ?').run(quantity, machine_id, part_id);
  } else {
    db.prepare('INSERT INTO machine_parts (machine_id, part_id, quantity_used) VALUES (?, ?, ?)').run(machine_id, part_id, quantity);
  }

  const updatedPart = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(part_id);
  broadcast({ type: 'usage_update', data: { part: updatedPart, machine_id, quantity } });
  res.json({ success: true, remaining_stock: updatedPart.stock });
});

// Get usage logs
app.get('/api/usage', (req, res) => {
  const { machine_id, part_id, start_date, end_date, limit } = req.query;
  let query = `SELECT ul.*, m.name as machine_name, sp.name as part_name, sp.part_number
    FROM usage_logs ul
    JOIN machines m ON ul.machine_id = m.id
    JOIN spare_parts sp ON ul.part_id = sp.id WHERE 1=1`;
  const params = [];
  if (machine_id) { query += ' AND ul.machine_id = ?'; params.push(machine_id); }
  if (part_id) { query += ' AND ul.part_id = ?'; params.push(part_id); }
  if (start_date) { query += ' AND ul.created_at >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND ul.created_at <= ?'; params.push(end_date); }
  query += ' ORDER BY ul.created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 200);
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// Get usage stats by part
app.get('/api/usage/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT sp.id, sp.name, sp.part_number, sp.category, sp.stock, sp.min_stock, sp.unit,
    COALESCE(SUM(ul.quantity), 0) as total_used,
    COUNT(DISTINCT ul.machine_id) as used_by_machines
    FROM spare_parts sp
    LEFT JOIN usage_logs ul ON sp.id = ul.part_id
    GROUP BY sp.id ORDER BY total_used DESC
  `).all();
  res.json(stats);
});

// Get daily usage stats (for graphs)
app.get('/api/usage/daily', (req, res) => {
  const { days, part_id, machine_id } = req.query;
  let query = `SELECT date(ul.created_at) as date, SUM(ul.quantity) as total_qty, COUNT(*) as usage_count
    FROM usage_logs ul WHERE 1=1`;
  const params = [];
  if (part_id) { query += ' AND ul.part_id = ?'; params.push(part_id); }
  if (machine_id) { query += ' AND ul.machine_id = ?'; params.push(machine_id); }
  query += ` GROUP BY date(ul.created_at) ORDER BY date(ul.created_at) DESC LIMIT ?`;
  params.push(parseInt(days) || 90);
  const stats = db.prepare(query).all(...params);
  res.json(stats.reverse());
});

// Get machine-parts usage matrix
app.get('/api/machine-parts', (req, res) => {
  const data = db.prepare(`
    SELECT mp.*, m.name as machine_name, sp.name as part_name, sp.part_number, sp.unit, sp.stock
    FROM machine_parts mp
    JOIN machines m ON mp.machine_id = m.id
    JOIN spare_parts sp ON mp.part_id = sp.id
    ORDER BY mp.quantity_used DESC
  `).all();
  res.json(data);
});

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const totalMachines = db.prepare('SELECT COUNT(*) as count FROM machines').get().count;
  const running = db.prepare("SELECT COUNT(*) as count FROM machines WHERE status = 'running'").get().count;
  const warning = db.prepare("SELECT COUNT(*) as count FROM machines WHERE status = 'warning'").get().count;
  const stopped = db.prepare("SELECT COUNT(*) as count FROM machines WHERE status IN ('stopped', 'maintenance')").get().count;
  const totalParts = db.prepare('SELECT COUNT(*) as count FROM spare_parts').get().count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM spare_parts WHERE stock <= min_stock').get().count;
  const totalUsageToday = db.prepare("SELECT COALESCE(SUM(quantity), 0) as count FROM usage_logs WHERE date(created_at) = date('now','localtime')").get().count;
  const totalValue = db.prepare('SELECT COALESCE(SUM(stock * unit_price), 0) as total FROM spare_parts').get().total;
  
  res.json({ totalMachines, running, warning, stopped, totalParts, lowStock, totalUsageToday, totalValue });
});

// Get low stock parts
app.get('/api/parts/low-stock', (req, res) => {
  const parts = db.prepare('SELECT * FROM spare_parts WHERE stock <= min_stock ORDER BY stock ASC').all();
  res.json(parts);
});

// Simulate real-time data
setInterval(() => {
  const machines = db.prepare("SELECT * FROM machines WHERE status = 'running'").all();
  machines.forEach(m => {
    const tempDelta = (Math.random() - 0.5) * 0.5;
    const pressureDelta = (Math.random() - 0.5) * 0.1;
    const flowDelta = (Math.random() - 0.5) * 5;
    const powerDelta = (Math.random() - 0.5) * 2;
    
    const newTemp = Math.round((m.temperature + tempDelta) * 10) / 10;
    const newPressure = Math.round((m.pressure + pressureDelta) * 100) / 100;
    const newFlow = Math.round(m.flow_rate + flowDelta);
    const newPower = Math.round((m.power + powerDelta) * 10) / 10;
    
    db.prepare(`UPDATE machines SET temperature = ?, pressure = ?, flow_rate = ?, power = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(newTemp, newPressure, newFlow, newPower, m.id);
    
    broadcast({
      type: 'sensor_update',
      data: { id: m.id, name: m.name, temperature: newTemp, pressure: newPressure, flow_rate: newFlow, power: newPower }
    });
  });
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});