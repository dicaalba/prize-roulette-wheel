/**
 * Prize Roulette Wheel - Server Entry Point
 * Node.js HTTP server with WebSocket support, REST API, and static file serving
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

const { getDatabase } = require('./db/database');
const { getWSManager } = require('./services/wsManager');
const { handleRequest } = require('./server-handler');

// Configuration
const PORT = parseInt(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'roulette.json');

// Initialize database
const db = getDatabase(DB_PATH);

// Seed initial prizes if database is empty
function seedInitialPrizes() {
  const prizes = db.getPrizes();
  if (prizes.length === 0) {
    console.log('Seeding initial prizes...');
    const defaultPrizes = [
      { name: 'Sticker Pack', description: 'Set de stickers exclusivos', color: '#FF6B9D', stock: 10, is_no_prize: false, sort_order: 0 },
      { name: 'Camiseta', description: 'Camiseta del evento', color: '#FF9900', stock: 5, is_no_prize: false, sort_order: 1 },
      { name: 'Cupón 20%', description: 'Descuento del 20% en tienda', color: '#2ECC71', stock: 15, is_no_prize: false, sort_order: 2 },
      { name: 'Llavero', description: 'Llavero personalizado', color: '#9B59B6', stock: 8, is_no_prize: false, sort_order: 3 },
      { name: 'Sin Premio', description: '', color: '#4a5568', stock: 999, is_no_prize: true, sort_order: 4 },
      { name: 'USB Drive', description: 'Memoria USB de 16GB', color: '#3498DB', stock: 3, is_no_prize: false, sort_order: 5 }
    ];
    defaultPrizes.forEach(p => db.insertPrize(p));
    console.log('Seeded 6 initial prizes.');
  }
}

seedInitialPrizes();

// Create HTTP server
const server = http.createServer(handleRequest);

// Initialize WebSocket Manager
const wsManager = getWSManager();
wsManager.initialize(server);

// Start server
server.listen(PORT, () => {
  console.log(`\n🎰 Prize Roulette Wheel Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Roulette:  http://localhost:${PORT}/`);
  console.log(`  Admin:     http://localhost:${PORT}/admin`);
  console.log(`  Display:   http://localhost:${PORT}/display`);
  console.log(`  API:       http://localhost:${PORT}/api/prizes`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { server };
