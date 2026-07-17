/**
 * AWS Lambda handler for Prize Roulette Wheel
 * Wraps the HTTP server handler for API Gateway / Lambda Function URL integration
 */

// Set environment for Lambda (use /tmp for writable storage)
process.env.DB_PATH = process.env.DB_PATH || '/tmp/roulette.json';

const { handleRequest } = require('./src/server-handler');
const { getDatabase } = require('./src/db/database');

const db = getDatabase(process.env.DB_PATH);

const DEFAULT_PRIZES = [
  { name: 'Sticker Pack', description: 'Set de stickers exclusivos', color: '#FF6B9D', stock: 10, is_no_prize: false, sort_order: 0 },
  { name: 'Camiseta', description: 'Camiseta del evento', color: '#FF9900', stock: 5, is_no_prize: false, sort_order: 1 },
  { name: 'Cupón 20%', description: 'Descuento del 20% en tienda', color: '#2ECC71', stock: 15, is_no_prize: false, sort_order: 2 },
  { name: 'Llavero', description: 'Llavero personalizado', color: '#9B59B6', stock: 8, is_no_prize: false, sort_order: 3 },
  { name: '¡Premio Oreo! 🍪', description: '¡No ganaste un premio... pero te llevas una Oreo! 🍪', color: '#4a5568', stock: 999, is_no_prize: true, sort_order: 4 },
  { name: 'USB Drive', description: 'Memoria USB de 16GB', color: '#3498DB', stock: 3, is_no_prize: false, sort_order: 5 }
];

// Track cold start initialization
let initialized = false;

exports.handler = async (event) => {
  // On cold start: load persisted data from S3 before handling any request
  if (!initialized) {
    await db.loadFromS3();
    if (db.getPrizes().length === 0) {
      DEFAULT_PRIZES.forEach(p => db.insertPrize(p));
    }
    initialized = true;
  }

  // Support both API Gateway and Lambda Function URL formats
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const rawPath = event.path || event.rawPath || '/';
  const queryParams = event.queryStringParameters;
  const headers = event.headers || {};
  const body = event.body || '';

  // Responder preflight CORS inmediatamente
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  const url = rawPath + (queryParams ? '?' + new URLSearchParams(queryParams).toString() : '');

  const result = await new Promise((resolve) => {
    // Create mock request object
    const dataCallbacks = [];
    const endCallbacks = [];

    const req = {
      method: httpMethod,
      url: url,
      headers: headers,
      on: (eventName, cb) => {
        if (eventName === 'data') {
          dataCallbacks.push(cb);
        } else if (eventName === 'end') {
          endCallbacks.push(cb);
        }
        // 'error' handler - noop
      }
    };

    // Create mock response object
    let responseBody = '';
    let responseHeaders = { 'Content-Type': 'text/plain' };
    let statusCode = 200;
    let isBase64 = false;

    const res = {
      writeHead: (code, hdrs) => {
        statusCode = code;
        if (hdrs) {
          if (typeof hdrs === 'object') {
            responseHeaders = { ...responseHeaders, ...hdrs };
          }
        }
      },
      setHeader: (key, value) => {
        responseHeaders[key] = String(value);
      },
      end: (data) => {
        if (data) {
          if (Buffer.isBuffer(data)) {
            responseBody = data.toString('base64');
            isBase64 = true;
          } else {
            responseBody = data;
            isBase64 = false;
          }
        }
        // Agregar headers CORS para permitir peticiones desde GitHub Pages
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        resolve({
          statusCode,
          headers: responseHeaders,
          body: responseBody,
          isBase64Encoded: isBase64
        });
      },
      write: (chunk) => {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) {
            responseBody += chunk.toString('base64');
            isBase64 = true;
          } else {
            responseBody += chunk;
          }
        }
      }
    };

    // Handle the request
    handleRequest(req, res);

    // Simulate body stream for POST/PUT requests
    setTimeout(() => {
      if (body) {
        const decodedBody = event.isBase64Encoded ? Buffer.from(body, 'base64').toString() : body;
        dataCallbacks.forEach(cb => cb(decodedBody));
      }
      endCallbacks.forEach(cb => cb());
    }, 0);
  });

  // Persist any changes to S3 before returning
  if (db._dirty) {
    await db.saveToS3();
  }

  return result;
};
