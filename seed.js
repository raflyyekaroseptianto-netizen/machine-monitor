const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    temperature REAL DEFAULT 0,
    pressure REAL DEFAULT 0,
    flow_rate REAL DEFAULT 0,
    power REAL DEFAULT 0,
    runtime_hours REAL DEFAULT 0,
    last_maintenance TEXT,
    next_maintenance TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS spare_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    unit_price REAL DEFAULT 0,
    location TEXT,
    supplier TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS machine_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity_used INTEGER DEFAULT 0,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (part_id) REFERENCES spare_parts(id)
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    operator TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (part_id) REFERENCES spare_parts(id)
  );

  CREATE TABLE IF NOT EXISTS machine_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    status TEXT,
    temperature REAL,
    pressure REAL,
    flow_rate REAL,
    power REAL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (machine_id) REFERENCES machines(id)
  );
`);

const insertMachine = db.prepare(`
  INSERT OR IGNORE INTO machines (name, type, status, temperature, pressure, flow_rate, power, runtime_hours, last_maintenance, next_maintenance)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const machines = [
  ['Chiller 1', 'Chiller', 'running', 7.5, 4.2, 150, 85, 12500, '2026-07-15', '2026-10-15'],
  ['Chiller 2', 'Chiller', 'running', 8.1, 4.0, 148, 82, 11800, '2026-07-20', '2026-10-20'],
  ['Chiller 3', 'Chiller', 'warning', 9.2, 4.5, 145, 88, 13200, '2026-06-10', '2026-09-10'],
  ['Chiller 4', 'Chiller', 'stopped', 0, 0, 0, 0, 14500, '2026-05-01', '2026-08-01'],
  ['AHU 1', 'AHU', 'running', 22.5, 1.2, 2500, 15, 9800, '2026-08-01', '2026-11-01'],
  ['AHU 2', 'AHU', 'running', 23.0, 1.1, 2480, 14, 9200, '2026-08-05', '2026-11-05'],
  ['AHU 3', 'AHU', 'maintenance', 0, 0, 0, 0, 10500, '2026-08-25', '2026-08-28'],
  ['PW', 'Water', 'running', 25.0, 2.5, 500, 10, 8700, '2026-07-01', '2026-10-01'],
  ['WFI', 'Water', 'running', 24.5, 3.0, 300, 12, 7600, '2026-07-10', '2026-10-10'],
  ['Boiler', 'Boiler', 'running', 150.0, 8.5, 200, 250, 6500, '2026-06-20', '2026-09-20'],
];

const insertParts = db.prepare(`
  INSERT OR IGNORE INTO spare_parts (part_number, name, category, stock, min_stock, unit, unit_price, location, supplier)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const parts = [
  ['REF-001', 'Refrigerant R-410A', 'Refrigerant', 25, 5, 'kg', 150000, 'Gudang A-01', 'PT Cold Indo'],
  ['REF-002', 'Refrigerant R-134a', 'Refrigerant', 18, 5, 'kg', 120000, 'Gudang A-01', 'PT Cold Indo'],
  ['FLT-001', 'Filter AHU HEPA', 'Filter', 40, 10, 'pcs', 350000, 'Gudang A-02', 'PT Filter Mas'],
  ['FLT-002', 'Filter Air Pre-filter', 'Filter', 30, 10, 'pcs', 50000, 'Gudang A-02', 'PT Filter Mas'],
  ['FLT-003', 'Filter Carbon Active', 'Filter', 20, 5, 'pcs', 75000, 'Gudang A-02', 'PT Filter Mas'],
  ['BRG-001', 'Bearing 6205', 'Bearing', 15, 5, 'pcs', 85000, 'Gudang B-01', 'PT Bearing Jaya'],
  ['BRG-002', 'Bearing 6208', 'Bearing', 12, 5, 'pcs', 120000, 'Gudang B-01', 'PT Bearing Jaya'],
  ['BRG-003', 'Bearing 6310', 'Bearing', 8, 3, 'pcs', 180000, 'Gudang B-01', 'PT Bearing Jaya'],
  ['MTR-001', 'Motor Fan 5HP', 'Motor', 4, 2, 'pcs', 4500000, 'Gudang B-02', 'PT Motor Indo'],
  ['MTR-002', 'Motor Pump 3HP', 'Motor', 3, 1, 'pcs', 3200000, 'Gudang B-02', 'PT Motor Indo'],
  ['VLV-001', 'Solenoid Valve 1/2"', 'Valve', 10, 3, 'pcs', 450000, 'Gudang C-01', 'PT Valve Prima'],
  ['VLV-002', 'Check Valve 1"', 'Valve', 8, 3, 'pcs', 380000, 'Gudang C-01', 'PT Valve Prima'],
  ['VLV-003', 'Gate Valve 2"', 'Valve', 6, 2, 'pcs', 750000, 'Gudang C-01', 'PT Valve Prima'],
  ['SNS-001', 'Sensor Temperature', 'Sensor', 20, 5, 'pcs', 250000, 'Gudang D-01', 'PT Sensor Tech'],
  ['SNS-002', 'Sensor Pressure', 'Sensor', 15, 5, 'pcs', 350000, 'Gudang D-01', 'PT Sensor Tech'],
  ['SNS-003', 'Sensor Flow Rate', 'Sensor', 10, 3, 'pcs', 420000, 'Gudang D-01', 'PT Sensor Tech'],
  ['PPE-001', 'Pipe Insulation 1"', 'Insulation', 50, 15, 'meter', 25000, 'Gudang E-01', 'PT Insul Mas'],
  ['PPE-002', 'Pipe Insulation 2"', 'Insulation', 40, 10, 'meter', 45000, 'Gudang E-01', 'PT Insul Mas'],
  ['ELC-001', 'Contactor 3P 40A', 'Electrical', 10, 3, 'pcs', 280000, 'Gudang F-01', 'PT Listrik Jaya'],
  ['ELC-002', 'Thermal Overload 40A', 'Electrical', 8, 3, 'pcs', 195000, 'Gudang F-01', 'PT Listrik Jaya'],
  ['ELC-003', 'Capacitor 50uF', 'Electrical', 15, 5, 'pcs', 85000, 'Gudang F-01', 'PT Listrik Jaya'],
  ['ELC-004', 'Relay Timer', 'Electrical', 12, 4, 'pcs', 125000, 'Gudang F-01', 'PT Listrik Jaya'],
  ['BLT-001', 'Boiler Tube', 'Boiler', 6, 2, 'pcs', 2500000, 'Gudang G-01', 'PT Boiler Indo'],
  ['BLT-002', 'Boiler Gasket', 'Boiler', 20, 5, 'pcs', 150000, 'Gudang G-01', 'PT Boiler Indo'],
  ['BLT-003', 'Burner Nozzle', 'Boiler', 8, 3, 'pcs', 850000, 'Gudang G-01', 'PT Boiler Indo'],
  ['LUB-001', 'Oil Compressor', 'Lubricant', 30, 10, 'liter', 95000, 'Gudang H-01', 'PT Oil Prima'],
  ['LUB-002', 'Grease Bearing', 'Lubricant', 25, 8, 'kg', 65000, 'Gudang H-01', 'PT Oil Prima'],
];

const insertMachineParts = db.prepare(`
  INSERT OR IGNORE INTO machine_parts (machine_id, part_id, quantity_used)
  VALUES (?, ?, ?)
`);

const insertUsageLog = db.prepare(`
  INSERT OR IGNORE INTO usage_logs (machine_id, part_id, quantity, operator, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertMachineLog = db.prepare(`
  INSERT OR IGNORE INTO machine_logs (machine_id, status, temperature, pressure, flow_rate, power, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seedAll = db.transaction(() => {
  machines.forEach(m => insertMachine.run(...m));
  parts.forEach(p => insertParts.run(...p));

  // Machine-Parts relationships
  const machineParts = [
    [1, 1, 10], [1, 6, 4], [1, 7, 2], [1, 11, 2], [1, 14, 3], [1, 21, 2], [1, 26, 15],
    [2, 1, 8], [2, 6, 4], [2, 7, 2], [2, 14, 3], [2, 21, 2], [2, 26, 12],
    [3, 2, 12], [3, 7, 3], [3, 9, 1], [3, 12, 2], [3, 15, 2], [3, 26, 14],
    [5, 3, 20], [5, 4, 15], [5, 5, 8], [5, 8, 2], [5, 10, 1], [5, 16, 2], [5, 17, 10],
    [6, 3, 18], [6, 4, 12], [6, 5, 6], [6, 8, 2], [6, 16, 2], [6, 17, 8],
    [8, 2, 5], [8, 4, 10], [8, 13, 1], [8, 16, 1], [8, 19, 2],
    [9, 2, 4], [9, 3, 8], [9, 4, 6], [9, 13, 1], [9, 16, 1],
    [10, 23, 3], [10, 24, 10], [10, 25, 4], [10, 15, 2],
  ];
  machineParts.forEach(mp => insertMachineParts.run(...mp));

  // Generate usage logs for the past 90 days
  const operators = ['Budi Santoso', 'Andi Wijaya', 'Rudi Hermawan', 'Dedi Kurniawan', 'Agus Pratama'];
  const now = new Date();
  for (let day = 90; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    const logsPerDay = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < logsPerDay; j++) {
      const machineId = Math.floor(Math.random() * 10) + 1;
      const partId = Math.floor(Math.random() * 27) + 1;
      const qty = Math.floor(Math.random() * 3) + 1;
      const operator = operators[Math.floor(Math.random() * operators.length)];
      const hour = Math.floor(Math.random() * 10) + 8;
      const minute = Math.floor(Math.random() * 60);
      insertUsageLog.run(machineId, partId, qty, operator, 'Maintenance routine', `${dateStr} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);
    }
  }

  // Generate machine logs for the past 90 days
  for (let day = 90; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    machines.forEach((m, idx) => {
      if (m[2] === 'stopped' || m[2] === 'maintenance') return;
      const baseTemp = m[3];
      const basePressure = m[4];
      const baseFlow = m[5];
      const basePower = m[6];
      for (let h = 0; h < 24; h += 4) {
        const temp = baseTemp + (Math.random() * 2 - 1);
        const pressure = basePressure + (Math.random() * 0.4 - 0.2);
        const flow = baseFlow + (Math.random() * 20 - 10);
        const power = basePower + (Math.random() * 5 - 2.5);
        insertMachineLog.run(idx + 1, 'running', temp, pressure, flow, power, `${dateStr} ${String(h).padStart(2,'0')}:00:00`);
      }
    });
  }
});

seedAll();
console.log('Database seeded successfully!');
db.close();