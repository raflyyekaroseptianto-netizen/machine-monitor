# Machine Monitor - Sistem Monitoring Mesin & Spare Parts Real-time

Aplikasi untuk memonitor mesin (Chiller 1-4, AHU 1-3, PW, WFI, Boiler) dan mengelola stock spare parts secara real-time melalui dashboard website.

## Fitur
- **Dashboard** - Statistik ringkasan, status mesin, stock menipis, grafik pemakaian
- **Monitoring Mesin** - Status & data sensor real-time (temp, pressure, flow, power) via WebSocket
- **Management Spare Parts** - CRUD stock, kategori, min-stock, supplier
- **Grafik Pemakaian** - Grafik harian, per kategori, top spare parts, per mesin (Chart.js)
- **Log Pemakaian** - Riwayat pemakaian spare parts dengan filter
- **Simulasi data sensor real-time** - Data mesin diperbarui otomatis setiap 5 detik

## Struktur Database
- `machines` - Data mesin & sensor
- `spare_parts` - Stock spare parts
- `machine_parts` - Relasi mesin & spare parts
- `usage_logs` - Log pemakaian spare parts
- `machine_logs` - Riwayat sensor mesin

## Cara Menjalankan

### 1. Install dependencies
```
npm install
```

### 2. Seed database (opsional, data contoh)
```
npm run seed
```
*Jika database `monitor.db` sudah ada dan lengkap, jalankan ulang seed akan menghasilkan data duplikat log. Untuk reset, hapus file `monitor.db` lalu jalankan seed kembali.*

### 3. Jalankan server
```
npm start
```
Atau langsung:
```
start.bat
```

### 4. Buka di browser
```
http://localhost:3000
```

## Requirement
- Node.js versi 22.5+ (menggunakan modul bawaan `node:sqlite`)

## Struktur File
```
machine-monitor/
├── server.js          # Server API + WebSocket
├── db.js              # Koneksi database (node:sqlite)
├── seed.js            # Data contoh
├── monitor.db         # Database SQLite
├── start.bat          # Script untuk menjalankan
└── public/
    ├── index.html     # Halaman utama (SPA)
    ├── css/style.css
    └── js/app.js
```
