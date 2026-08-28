// Global state
let ws = null;
let allMachines = [];
let allParts = [];
let charts = {};
let currentPage = 'dashboard';

// WebSocket connection
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    document.getElementById('connectionStatus').className = 'connection-status connected';
    document.getElementById('connectionStatus').innerHTML = '<span class="dot"></span> Terhubung - Real-time';
  };

  ws.onclose = () => {
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
    document.getElementById('connectionStatus').innerHTML = '<span class="dot"></span> Terputus - Coba lagi...';
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWSMessage(data);
  };
}

function handleWSMessage(msg) {
  if (msg.type === 'sensor_update') {
    updateMachineSensor(msg.data);
    if (currentPage === 'dashboard') {
      updateMachineStatus();
    }
  } else if (msg.type === 'machine_update') {
    loadMachines();
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } else if (msg.type === 'part_update' || msg.type === 'part_delete') {
    loadParts();
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
    if (currentPage === 'graphs') {
      loadGraphs();
    }
  } else if (msg.type === 'usage_update') {
    loadParts();
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
    if (currentPage === 'graphs') {
      loadGraphs();
    }
    if (currentPage === 'usage') {
      loadUsageLogs();
    }
  }
}

// API Helper
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error || 'Error');
  }
  return response.json();
}

// Navigation
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    if (page === 'dashboard' || page === 'machines' || page === 'spareparts' || page === 'graphs' || page === 'usage') {
      switchPage(page);
    }
  });
});

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.querySelector(`.nav-links a[data-page="${page}"]`)?.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    machines: 'Monitoring Mesin',
    spareparts: 'Management Spare Parts',
    graphs: 'Grafik Pemakaian',
    usage: 'Log Pemakaian'
  };
  document.getElementById('pageTitle').textContent = titles[page];

  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`${page}Section`).classList.remove('hidden');

  if (page === 'dashboard') loadDashboard();
  if (page === 'machines') loadMachines();
  if (page === 'spareparts') loadParts();
  if (page === 'graphs') loadGraphs();
  if (page === 'usage') loadUsageLogs();
}

// Dashboard
async function loadDashboard() {
  try {
    const stats = await api('/api/dashboard');
    document.getElementById('statMachines').textContent = stats.totalMachines;
    document.getElementById('statRunning').textContent = stats.running;
    document.getElementById('statWarning').textContent = stats.warning;
    document.getElementById('statStopped').textContent = stats.stopped;
    document.getElementById('statParts').textContent = stats.totalParts;
    document.getElementById('statLowStock').textContent = stats.lowStock;
    document.getElementById('statUsageToday').textContent = stats.totalUsageToday;
    document.getElementById('statValue').textContent = 'Rp ' + formatNumber(stats.totalValue);

    updateMachineStatus();
    loadLowStock();
    loadDashboardChart();
  } catch (err) {
    console.error(err);
  }
}

async function updateMachineStatus() {
  try {
    const machines = await api('/api/machines');
    allMachines = machines;
    const container = document.getElementById('machineStatusList');
    container.innerHTML = machines.map(m => `
      <div class="machine-item">
        <div class="machine-info">
          <span class="status-badge status-${m.status}">${m.status === 'running' ? '▶ Berjalan' : m.status === 'stopped' ? '■ Stopped' : m.status === 'warning' ? '▲ Warning' : '🔧 Maint'}</span>
          <strong>${m.name}</strong>
        </div>
        <span>${m.status === 'running' ? `${m.temperature}°C | ${m.power} kW` : ''}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function loadLowStock() {
  try {
    const parts = await api('/api/parts/low-stock');
    const container = document.getElementById('lowStockList');
    if (parts.length === 0) {
      container.innerHTML = '<p style="color:#4caf50; padding:10px;">✓ Semua stock spare parts mencukupi</p>';
    } else {
      container.innerHTML = parts.map(p => `
        <div class="low-stock-item">
          <div class="part-info">${p.name} <small style="color:#999">(${p.part_number})</small></div>
          <div class="stock-warn">Stock: ${p.stock} ${p.unit} / Min: ${p.min_stock}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadDashboardChart() {
  try {
    const data = await api('/api/usage/daily?days=30');
    const labels = data.map(d => formatDateShort(d.date));
    const values = data.map(d => d.total_qty);

    if (charts.dashboard) charts.dashboard.destroy();
    const ctx = document.getElementById('dashboardUsageChart');
    charts.dashboard = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Jumlah Pemakaian',
          data: values,
          borderColor: '#1a237e',
          backgroundColor: 'rgba(26,35,126,0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// Machines page
async function loadMachines() {
  try {
    const machines = await api('/api/machines');
    allMachines = machines;
    const container = document.getElementById('machineCards');
    container.innerHTML = machines.map(m => `
      <div class="machine-card status-${m.status}" id="mc-${m.id}">
        <div class="machine-card-header">
          <h3>${m.name}</h3>
          <select class="status-select" onchange="changeMachineStatus(${m.id}, this.value)">
            <option value="running" ${m.status === 'running' ? 'selected' : ''}>▶ Running</option>
            <option value="warning" ${m.status === 'warning' ? 'selected' : ''}>▲ Warning</option>
            <option value="stopped" ${m.status === 'stopped' ? 'selected' : ''}>■ Stopped</option>
            <option value="maintenance" ${m.status === 'maintenance' ? 'selected' : ''}>🔧 Maintenance</option>
          </select>
        </div>
        <div class="sensor-grid">
          <div class="sensor-item">
            <label>Temperature</label>
            <div class="value"><span id="temp-${m.id}">${m.temperature?.toFixed(1)}</span> <span class="unit">°C</span></div>
          </div>
          <div class="sensor-item">
            <label>Pressure</label>
            <div class="value"><span id="press-${m.id}">${m.pressure?.toFixed(2)}</span> <span class="unit">bar</span></div>
          </div>
          <div class="sensor-item">
            <label>Flow Rate</label>
            <div class="value"><span id="flow-${m.id}">${m.flow_rate}</span> <span class="unit">m³/h</span></div>
          </div>
          <div class="sensor-item">
            <label>Power</label>
            <div class="value"><span id="power-${m.id}">${m.power?.toFixed(1)}</span> <span class="unit">kW</span></div>
          </div>
          <div class="sensor-item">
            <label>Runtime</label>
            <div class="value">${formatNumber(m.runtime_hours)} <span class="unit">jam</span></div>
          </div>
          <div class="sensor-item">
            <label>Maintenance Terakhir</label>
            <div class="value" style="font-size:0.9em;">${m.last_maintenance || '-'}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function changeMachineStatus(id, status) {
  try {
    await api(`/api/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    loadMachines();
  } catch (err) {
    alert('Gagal mengubah status: ' + err.message);
  }
}

function updateMachineSensor(data) {
  const tempEl = document.getElementById(`temp-${data.id}`);
  const pressEl = document.getElementById(`press-${data.id}`);
  const flowEl = document.getElementById(`flow-${data.id}`);
  const powerEl = document.getElementById(`power-${data.id}`);

  if (tempEl) tempEl.textContent = data.temperature.toFixed(1);
  if (pressEl) pressEl.textContent = data.pressure.toFixed(2);
  if (flowEl) flowEl.textContent = data.flow_rate;
  if (powerEl) powerEl.textContent = data.power.toFixed(1);
}

// Spare Parts page
async function loadParts() {
  try {
    const parts = await api('/api/parts');
    allParts = parts;
    populateCategoryFilter();
    renderPartsTable();
  } catch (err) {
    console.error(err);
  }
}

function populateCategoryFilter() {
  const cats = [...new Set(allParts.map(p => p.category))];
  const catFilter = document.getElementById('partCategoryFilter');
  const catOptions = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  catFilter.innerHTML = `<option value="">Semua Kategori</option>${catOptions}`;
}

function filterParts() {
  renderPartsTable();
}

function renderPartsTable() {
  const search = (document.getElementById('partSearch').value || '').toLowerCase();
  const catFilter = document.getElementById('partCategoryFilter').value;
  const statusFilter = document.getElementById('partStatusFilter').value;

  const filtered = allParts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) || p.part_number.toLowerCase().includes(search);
    const matchCat = !catFilter || p.category === catFilter;
    const isLow = p.stock <= p.min_stock;
    const matchStatus = !statusFilter || (statusFilter === 'low' ? isLow : !isLow);
    return matchSearch && matchCat && matchStatus;
  });

  const tbody = document.getElementById('partsTableBody');
  tbody.innerHTML = filtered.map(p => `
    <tr style="${p.stock <= p.min_stock ? 'background:#fff3e0;' : ''}">
      <td><strong>${p.part_number}</strong></td>
      <td>${p.name}</td>
      <td><span class="status-badge" style="background:#e3f2fd; color:#1565c0;">${p.category}</span></td>
      <td>
        <span style="${p.stock <= p.min_stock ? 'color:#f44336; font-weight:700;' : ''}">${p.stock} ${p.unit}</span>
        ${p.stock <= p.min_stock ? '<span style="color:#f44336; font-size:0.75em;"> ⚠</span>' : ''}
      </td>
      <td>${p.min_stock}</td>
      <td>${p.unit}</td>
      <td>Rp ${formatNumber(p.unit_price)}</td>
      <td>${p.location || '-'}</td>
      <td>${p.supplier || '-'}</td>
      <td>
        <button onclick="editPart(${p.id})" style="margin-right:5px; padding:5px 10px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer;">Edit</button>
        <button onclick="deletePart(${p.id})" style="padding:5px 10px; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer;">Hapus</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="10" style="text-align:center; padding:20px; color:#999;">Tidak ada data</td></tr>';
}

function openAddPartModal() {
  document.getElementById('addPartModal').classList.remove('hidden');
  document.querySelectorAll('#addPartModal input').forEach(i => i.value = '');
  document.getElementById('partUnitInput').value = 'pcs';
}

function closeAddPartModal() {
  document.getElementById('addPartModal').classList.add('hidden');
}

async function addPart() {
  const data = {
    part_number: document.getElementById('partNumberInput').value,
    name: document.getElementById('partNameInput').value,
    category: document.getElementById('partCategoryInput').value,
    stock: parseInt(document.getElementById('partStockInput').value) || 0,
    min_stock: parseInt(document.getElementById('partMinStockInput').value) || 0,
    unit: document.getElementById('partUnitInput').value || 'pcs',
    unit_price: parseFloat(document.getElementById('partPriceInput').value) || 0,
    location: document.getElementById('partLocationInput').value,
    supplier: document.getElementById('partSupplierInput').value
  };

  if (!data.part_number || !data.name || !data.category) {
    alert('Mohon isi Part Number, Nama, dan Kategori');
    return;
  }

  try {
    await api('/api/parts', { method: 'POST', body: JSON.stringify(data) });
    closeAddPartModal();
    loadParts();
    alert('Spare Part berhasil ditambahkan');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deletePart(id) {
  if (!confirm('Yakin ingin menghapus spare part ini?')) return;
  try {
    await api(`/api/parts/${id}`, { method: 'DELETE' });
    loadParts();
    alert('Spare part dihapus');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function editPart(id) {
  const part = allParts.find(p => p.id === id);
  if (!part) return;

  document.getElementById('partNumberInput').value = part.part_number;
  document.getElementById('partNameInput').value = part.name;
  document.getElementById('partCategoryInput').value = part.category;
  document.getElementById('partStockInput').value = part.stock;
  document.getElementById('partMinStockInput').value = part.min_stock;
  document.getElementById('partUnitInput').value = part.unit;
  document.getElementById('partPriceInput').value = part.unit_price;
  document.getElementById('partLocationInput').value = part.location || '';
  document.getElementById('partSupplierInput').value = part.supplier || '';

  document.getElementById('addPartModal').classList.remove('hidden');

  // Override the addPart function to update
  window._editingPartId = id;
}

// Override save to handle edit
function savePart() {
  const id = window._editingPartId;
  const data = {
    name: document.getElementById('partNameInput').value,
    category: document.getElementById('partCategoryInput').value,
    stock: parseInt(document.getElementById('partStockInput').value) || 0,
    min_stock: parseInt(document.getElementById('partMinStockInput').value) || 0,
    unit: document.getElementById('partUnitInput').value || 'pcs',
    unit_price: parseFloat(document.getElementById('partPriceInput').value) || 0,
    location: document.getElementById('partLocationInput').value,
    supplier: document.getElementById('partSupplierInput').value,
    part_number: document.getElementById('partNumberInput').value
  };

  if (id) {
    api(`/api/parts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      .then(() => {
        closeAddPartModal();
        window._editingPartId = null;
        loadParts();
      })
      .catch(err => alert('Error: ' + err.message));
  } else {
    addPart();
  }
}

// Override the modal save button to use savePart
document.addEventListener('click', (e) => {
  if (e.target.id === 'addPartModal') {
    closeAddPartModal();
  }
});

// Patch: change the save button handler
// (handled directly in HTML onclick="savePart()")

// Graphs page
async function loadGraphs() {
  try {
    await populateGraphFilters();
    await loadAllGraphs();
  } catch (err) {
    console.error(err);
  }
}

async function populateGraphFilters() {
  const partFilter = document.getElementById('graphPartFilter');
  const machineFilter = document.getElementById('graphMachineFilter');

  if (allParts.length === 0 && partFilter.options.length <= 1) {
    allParts = await api('/api/parts');
  }
  if (allMachines.length === 0) {
    allMachines = await api('/api/machines');
  }

  partFilter.innerHTML = `<option value="">Semua Spare Parts</option>` +
    allParts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  machineFilter.innerHTML = `<option value="">Semua Mesin</option>` +
    allMachines.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

async function loadAllGraphs() {
  const days = document.getElementById('graphDaysFilter').value;
  const partId = document.getElementById('graphPartFilter').value;
  const machineId = document.getElementById('graphMachineFilter').value;

  let dailyUrl = `/api/usage/daily?days=${days}`;
  if (partId) dailyUrl += `&part_id=${partId}`;
  if (machineId) dailyUrl += `&machine_id=${machineId}`;

  // Daily usage
  const dailyData = await api(dailyUrl);
  renderDailyChart(dailyData);

  // Category usage - fetch all usage stats and group by category
  const statsData = await api('/api/usage/stats');
  renderCategoryChart(statsData);

  // Top parts
  renderTopPartsChart(statsData);

  // Machine usage
  const machineParts = await api('/api/machine-parts');
  renderMachineUsageChart(machineParts);
}

function renderDailyChart(data) {
  const labels = data.map(d => formatDateShort(d.date));
  const values = data.map(d => d.total_qty);

  if (charts.daily) charts.daily.destroy();
  const ctx = document.getElementById('dailyUsageChart');
  charts.daily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Pemakaian',
        data: values,
        backgroundColor: 'rgba(26,35,126,0.7)',
        borderColor: '#1a237e',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderCategoryChart(statsData) {
  const catData = {};
  statsData.forEach(s => {
    catData[s.category] = (catData[s.category] || 0) + s.total_used;
  });

  const colors = ['#1a237e', '#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0', '#795548', '#607d8b', '#e91e63', '#00bcd4'];

  if (charts.category) charts.category.destroy();
  const ctx = document.getElementById('categoryUsageChart');
  charts.category = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(catData),
      datasets: [{
        data: Object.values(catData),
        backgroundColor: colors.slice(0, Object.keys(catData).length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });
}

function renderTopPartsChart(statsData) {
  const top10 = statsData.slice(0, 10);

  if (charts.topParts) charts.topParts.destroy();
  const ctx = document.getElementById('topPartsChart');
  charts.topParts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
      datasets: [{
        label: 'Jumlah Terpakai',
        data: top10.map(s => s.total_used),
        backgroundColor: 'rgba(255,152,0,0.7)',
        borderColor: '#ff9800',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderMachineUsageChart(machineParts) {
  const machineData = {};
  machineParts.forEach(mp => {
    machineData[mp.machine_name] = (machineData[mp.machine_name] || 0) + mp.quantity_used;
  });

  const colors = ['#1a237e', '#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0', '#795548', '#607d8b', '#e91e63', '#00bcd4'];

  if (charts.machine) charts.machine.destroy();
  const ctx = document.getElementById('machineUsageChart');
  charts.machine = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(machineData),
      datasets: [{
        data: Object.values(machineData),
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });
}

// Usage Logs
async function loadUsageLogs() {
  try {
    const machineFilter = document.getElementById('usageMachineFilter');
    if (allMachines.length === 0) {
      allMachines = await api('/api/machines');
      machineFilter.innerHTML = `<option value="">Semua Mesin</option>` +
        allMachines.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }

    let url = '/api/usage?limit=200';
    const machineId = machineFilter.value;
    const dateFrom = document.getElementById('usageDateFrom').value;
    const dateTo = document.getElementById('usageDateTo').value;

    if (machineId) url += `&machine_id=${machineId}`;
    if (dateFrom) url += `&start_date=${dateFrom} 00:00:00`;
    if (dateTo) url += `&end_date=${dateTo} 23:59:59`;

    const logs = await api(url);
    const tbody = document.getElementById('usageTableBody');
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${formatDateTime(l.created_at)}</td>
        <td><strong>${l.machine_name}</strong></td>
        <td>${l.part_name} <small style="color:#999">(${l.part_number})</small></td>
        <td><span style="color:#f44336; font-weight:700;">-${l.quantity}</span></td>
        <td>${l.operator || '-'}</td>
        <td>${l.notes || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Tidak ada data</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

// Utility helpers
function formatNumber(num) {
  return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// Clock
function updateClock() {
  const now = new Date();
  document.getElementById('datetime').textContent = now.toLocaleString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

// Init
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  loadDashboard();
});