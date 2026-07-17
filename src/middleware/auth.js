/**
 * Auth Middleware - JWT-based authentication for admin routes
 * Uses Node.js crypto for HMAC-based JWT implementation
 */
const crypto = require('crypto');

const SECRET = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY_HOURS = 8;

/**
 * Create a simple JWT token
 */
function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (TOKEN_EXPIRY_HOURS * 3600)
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify a JWT token
 */
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Login handler
 */
function handleLogin(password) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === adminPassword) {
    const token = createToken({ role: 'admin' });
    return { success: true, token };
  }
  return { success: false };
}

/**
 * Authentication middleware check
 * Returns true if authenticated, false otherwise
 */
function authenticate(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  return payload !== null;
}

module.exports = { createToken, verifyToken, handleLogin, authenticate };
