/**
 * Database Layer - JSON file-based persistence
 * Provides atomic operations and persistence similar to SQLite
 * Uses WAL-like approach with atomic file writes
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/roulette.json');
    this.data = null;
    this._lock = false;
    this._dirty = false;
  }

  initialize() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (e) {
        this.data = this._createDefaultData();
      }
    } else {
      this.data = this._createDefaultData();
    }
    this._persistLocal();
  }

  _createDefaultData() {
    return {
      prizes: [],
      config: {
        meetup_url: process.env.MEETUP_URL || 'https://www.meetup.com/your-meetup-group',
        consolation_message: '¡Mejor suerte la próxima vez! Síguenos en Meetup para más oportunidades.',
        web_app_url: process.env.WEB_APP_URL || 'http://localhost:3000'
      }
    };
  }

  // Writes to local disk only — does NOT mark dirty for S3 sync
  _persistLocal() {
    const tmpPath = this.dbPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.dbPath);
  }

  // Writes to local disk AND marks data as needing S3 sync
  _persist() {
    this._persistLocal();
    this._dirty = true;
  }

  // Returns: true = loaded from S3, null = S3 empty (NoSuchKey), false = S3 error
  async loadFromS3() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return null;
    try {
      const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({});
      const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'roulette.json' }));
      const body = await response.Body.transformToString();
      this.data = JSON.parse(body);
      this._dirty = false;
      return true;
    } catch (e) {
      this._dirty = false; // never overwrite S3 on a failed load
      if (e.name !== 'NoSuchKey') {
        console.error('S3 load error:', e.message);
        return false;
      }
      return null; // S3 was empty — caller should seed defaults
    }
  }

  async saveToS3() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return;
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({});
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: 'roulette.json',
        Body: JSON.stringify(this.data, null, 2),
        ContentType: 'application/json'
      }));
      this._dirty = false;
    } catch (e) {
      console.error('S3 save error:', e.message);
    }
  }

  _generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Prize CRUD Operations

  getPrizes() {
    return [...this.data.prizes].sort((a, b) => a.sort_order - b.sort_order);
  }

  getPrizeById(id) {
    return this.data.prizes.find(p => p.id === id) || null;
  }

  insertPrize(data) {
    // Validate
    if (!data.name || typeof data.name !== 'string' || data.name.length === 0 || data.name.length > 30) {
      throw new Error('Name must be a string between 1 and 30 characters');
    }
    if (!data.color || typeof data.color !== 'string' || data.color.length === 0) {
      throw new Error('Color must be a non-empty string');
    }
    if (data.stock === undefined || data.stock === null || typeof data.stock !== 'number' || !Number.isInteger(data.stock) || data.stock < 0) {
      throw new Error('Stock must be a non-negative integer');
    }

    const now = new Date().toISOString();
    const prize = {
      id: this._generateId(),
      name: data.name.trim(),
      description: data.description || '',
      color: data.color,
      stock: data.stock,
      is_no_prize: data.is_no_prize || false,
      sort_order: data.sort_order !== undefined ? data.sort_order : this.data.prizes.length,
      created_at: now,
      updated_at: now
    };

    this.data.prizes.push(prize);
    this._persist();
    return prize;
  }

  updatePrize(id, data) {
    const index = this.data.prizes.findIndex(p => p.id === id);
    if (index === -1) return null;

    // Validate fields if provided
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.length === 0 || data.name.length > 30) {
        throw new Error('Name must be a string between 1 and 30 characters');
      }
    }
    if (data.color !== undefined) {
      if (typeof data.color !== 'string' || data.color.length === 0) {
        throw new Error('Color must be a non-empty string');
      }
    }
    if (data.stock !== undefined) {
      if (data.stock === null || typeof data.stock !== 'number' || !Number.isInteger(data.stock) || data.stock < 0) {
        throw new Error('Stock must be a non-negative integer');
      }
    }

    const prize = this.data.prizes[index];
    if (data.name !== undefined) prize.name = data.name.trim();
    if (data.description !== undefined) prize.description = data.description;
    if (data.color !== undefined) prize.color = data.color;
    if (data.stock !== undefined) prize.stock = data.stock;
    if (data.is_no_prize !== undefined) prize.is_no_prize = data.is_no_prize;
    if (data.sort_order !== undefined) prize.sort_order = data.sort_order;
    prize.updated_at = new Date().toISOString();

    this._persist();
    return prize;
  }

  deletePrize(id) {
    const index = this.data.prizes.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.data.prizes.splice(index, 1);
    this._persist();
    return true;
  }

  /**
   * Atomic stock decrement - prevents stock from going below 0
   * Equivalent to: UPDATE prizes SET stock = stock - 1 WHERE id = ? AND stock > 0
   */
  decrementStock(id) {
    const prize = this.data.prizes.find(p => p.id === id);
    if (!prize || prize.stock <= 0) {
      return { success: false, newStock: prize ? prize.stock : 0 };
    }

    prize.stock -= 1;
    prize.updated_at = new Date().toISOString();
    this._persist();

    return { success: true, newStock: prize.stock };
  }

  getConfig() {
    return { ...this.data.config };
  }

  updateConfig(key, value) {
    this.data.config[key] = value;
    this._persist();
  }
}

// Singleton instance
let instance = null;

function getDatabase(dbPath) {
  if (!instance) {
    // Usar DB_PATH del entorno si no se pasa argumento (necesario para Lambda)
    const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../data/roulette.json');
    instance = new Database(resolvedPath);
    instance.initialize();
  }
  return instance;
}

function resetDatabase() {
  instance = null;
}

module.exports = { Database, getDatabase, resetDatabase };
