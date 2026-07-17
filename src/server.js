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
const {
  loginRoute,
  getPrizesRoute,
  createPrizeRoute,
  updatePrizeRoute,
  deletePrizeRoute,
  spinRoute,
  getConfigRoute,
  sendJSON
} = require('./routes/prizes');

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
      { name: 'Sticker Pack', description: 'Set de stickers exclusivos', color: '#E74C3C', stock: 10, is_no_prize: false, sort_order: 0 },
      { name: 'Camiseta', description: 'Camiseta del evento', color: '#3498DB', stock: 5, is_no_prize: false, sort_order: 1 },
      { name: 'Cupón 20%', description: 'Descuento del 20% en tienda', color: '#2ECC71', stock: 15, is_no_prize: false, sort_order: 2 },
      { name: 'Llavero', description: 'Llavero personalizado', color: '#9B59B6', stock: 8, is_no_prize: false, sort_order: 3 },
      { name: 'Sin Premio', description: '', color: '#95A5A6', stock: 999, is_no_prize: true, sort_order: 4 },
      { name: 'USB Drive', description: 'Memoria USB de 16GB', color: '#F39C12', stock: 3, is_no_prize: false, sort_order: 5 }
    ];
    defaultPrizes.forEach(p => db.insertPrize(p));
    console.log('Seeded 6 initial prizes.');
  }
}

seedInitialPrizes();

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

/**
 * Serve static files from the public directory
 */
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return true;
    }
  } catch (e) {
    // Fall through
  }
  return false;
}

/**
 * Main request handler
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // POST /api/auth/login
      if (pathname === '/api/auth/login' && method === 'POST') {
        return await loginRoute(req, res);
      }

      // GET /api/prizes
      if (pathname === '/api/prizes' && method === 'GET') {
        return getPrizesRoute(req, res);
      }

      // POST /api/prizes
      if (pathname === '/api/prizes' && method === 'POST') {
        return await createPrizeRoute(req, res);
      }

      // PUT /api/prizes/:id
      const putMatch = pathname.match(/^\/api\/prizes\/([a-f0-9]+)$/);
      if (putMatch && method === 'PUT') {
        return await updatePrizeRoute(req, res, putMatch[1]);
      }

      // DELETE /api/prizes/:id
      const deleteMatch = pathname.match(/^\/api\/prizes\/([a-f0-9]+)$/);
      if (deleteMatch && method === 'DELETE') {
        return await deletePrizeRoute(req, res, deleteMatch[1]);
      }

      // POST /api/spin
      if (pathname === '/api/spin' && method === 'POST') {
        return spinRoute(req, res);
      }

      // GET /api/config
      if (pathname === '/api/config' && method === 'GET') {
        return getConfigRoute(req, res);
      }

      // 404 for unknown API routes
      return sendJSON(res, 404, { error: 'Not found' });
    } catch (e) {
      console.error('API Error:', e);
      return sendJSON(res, 500, { error: 'Internal server error' });
    }
  }

  // Page Routes
  const publicDir = path.join(__dirname, '..', 'public');

  // Admin panel
  if (pathname === '/admin' || pathname === '/admin/') {
    return serveStaticFile(res, path.join(publicDir, 'admin', 'index.html')) ||
      sendJSON(res, 404, { error: 'Not found' });
  }

  // QR Display screen
  if (pathname === '/display' || pathname === '/display/') {
    return serveStaticFile(res, path.join(publicDir, 'display', 'index.html')) ||
      sendJSON(res, 404, { error: 'Not found' });
  }

  // Main roulette page
  if (pathname === '/' || pathname === '/index.html') {
    return serveStaticFile(res, path.join(publicDir, 'index.html')) ||
      sendJSON(res, 404, { error: 'Not found' });
  }

  // Static files
  const staticPath = path.join(publicDir, pathname);
  // Security: prevent directory traversal
  if (!staticPath.startsWith(publicDir)) {
    return sendJSON(res, 403, { error: 'Forbidden' });
  }

  if (serveStaticFile(res, staticPath)) return;

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

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
