/**
 * REST API Route handlers for prizes, spin, auth, and config
 */
const { PrizeService } = require('../services/prizeService');
const { SpinService } = require('../services/spinService');
const { handleLogin, authenticate } = require('../middleware/auth');
const { getWSManager } = require('../services/wsManager');

const prizeService = new PrizeService();
const spinService = new SpinService();

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Route: POST /api/auth/login
 */
async function loginRoute(req, res) {
  try {
    const body = await parseBody(req);
    const result = handleLogin(body.password);
    if (result.success) {
      sendJSON(res, 200, { token: result.token });
    } else {
      sendJSON(res, 401, { error: 'Incorrect password' });
    }
  } catch (e) {
    sendJSON(res, 400, { error: 'Invalid request' });
  }
}

/**
 * Route: GET /api/prizes
 * Returns prizes array + event_active flag so clients adjust behavior in one call.
 */
function getPrizesRoute(req, res) {
  const { getDatabase } = require('../db/database');
  const db = getDatabase();
  const prizes = prizeService.getAllPrizes();
  const config = db.getConfig();
  sendJSON(res, 200, {
    prizes,
    event_active: config.event_active !== false // default true if not set
  });
}

/**
 * Route: POST /api/event/status (auth required)
 * Body: { event_active: bool }
 */
async function updateEventStatusRoute(req, res) {
  if (!authenticate(req.headers.authorization)) {
    return sendJSON(res, 401, { error: 'Authentication required' });
  }
  try {
    const body = await parseBody(req);
    const { getDatabase } = require('../db/database');
    const db = getDatabase();
    const eventActive = !!body.event_active;
    db.updateConfig('event_active', eventActive);
    const wsManager = getWSManager();
    wsManager.broadcastEventStatus(eventActive);
    sendJSON(res, 200, { event_active: eventActive });
  } catch (e) {
    sendJSON(res, 400, { error: e.message });
  }
}

/**
 * Route: POST /api/prizes (auth required)
 */
async function createPrizeRoute(req, res) {
  if (!authenticate(req.headers.authorization)) {
    return sendJSON(res, 401, { error: 'Authentication required' });
  }

  try {
    const body = await parseBody(req);
    const prize = prizeService.createPrize(body);
    const wsManager = getWSManager();
    wsManager.broadcastPrizeListUpdate(prizeService.getAllPrizes());
    sendJSON(res, 201, prize);
  } catch (e) {
    if (e.details) {
      sendJSON(res, 400, { error: e.message, details: e.details });
    } else {
      sendJSON(res, 400, { error: e.message });
    }
  }
}

/**
 * Route: PUT /api/prizes/:id (auth required)
 */
async function updatePrizeRoute(req, res, id) {
  if (!authenticate(req.headers.authorization)) {
    return sendJSON(res, 401, { error: 'Authentication required' });
  }

  try {
    const body = await parseBody(req);
    const prize = prizeService.updatePrize(id, body);
    if (!prize) {
      return sendJSON(res, 404, { error: 'Prize not found' });
    }
    const wsManager = getWSManager();
    wsManager.broadcastPrizeListUpdate(prizeService.getAllPrizes());
    sendJSON(res, 200, prize);
  } catch (e) {
    if (e.details) {
      sendJSON(res, 400, { error: e.message, details: e.details });
    } else {
      sendJSON(res, 400, { error: e.message });
    }
  }
}

/**
 * Route: DELETE /api/prizes/:id (auth required)
 */
async function deletePrizeRoute(req, res, id) {
  if (!authenticate(req.headers.authorization)) {
    return sendJSON(res, 401, { error: 'Authentication required' });
  }

  try {
    const result = prizeService.deletePrize(id);
    if (!result) {
      return sendJSON(res, 404, { error: 'Prize not found' });
    }
    const wsManager = getWSManager();
    wsManager.broadcastPrizeListUpdate(prizeService.getAllPrizes());
    sendJSON(res, 204, null);
  } catch (e) {
    if (e.details) {
      sendJSON(res, 400, { error: e.message, details: e.details });
    } else {
      sendJSON(res, 400, { error: e.message });
    }
  }
}

/**
 * Route: POST /api/spin
 */
function spinRoute(req, res) {
  try {
    const result = spinService.executeSpin();
    const wsManager = getWSManager();
    wsManager.broadcastStockUpdate(result.updatedPrizes);
    sendJSON(res, 200, result);
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
}

/**
 * Route: GET /api/config
 */
function getConfigRoute(req, res) {
  const { getDatabase } = require('../db/database');
  const db = getDatabase();
  const config = db.getConfig();
  sendJSON(res, 200, {
    meetupUrl: config.meetup_url,
    consolationMessage: config.consolation_message,
    webAppUrl: config.web_app_url
  });
}

module.exports = {
  parseBody,
  sendJSON,
  loginRoute,
  getPrizesRoute,
  createPrizeRoute,
  updatePrizeRoute,
  deletePrizeRoute,
  spinRoute,
  getConfigRoute,
  updateEventStatusRoute
};
