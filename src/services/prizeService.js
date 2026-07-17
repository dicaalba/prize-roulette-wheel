/**
 * Prize Service - Business logic for prize management
 */
const { getDatabase } = require('../db/database');

class PrizeService {
  constructor() {
    this.db = getDatabase();
  }

  getAllPrizes() {
    return this.db.getPrizes();
  }

  getPrizeById(id) {
    return this.db.getPrizeById(id);
  }

  createPrize(data) {
    // Validate input
    const errors = this._validatePrizeInput(data, true);
    if (errors.length > 0) {
      const err = new Error('Validation failed');
      err.details = errors;
      throw err;
    }

    // Enforce max 12 segments
    const currentPrizes = this.db.getPrizes();
    if (currentPrizes.length >= 12) {
      const err = new Error('Maximum 12 segments allowed');
      err.details = [{ field: 'segments', message: 'Maximum 12 segments allowed on the wheel' }];
      throw err;
    }

    return this.db.insertPrize({
      name: data.name,
      description: data.description || '',
      color: data.color,
      stock: data.stock,
      is_no_prize: data.isNoPrize || false,
      sort_order: data.sortOrder !== undefined ? data.sortOrder : currentPrizes.length
    });
  }

  updatePrize(id, data) {
    const existing = this.db.getPrizeById(id);
    if (!existing) return null;

    // Validate partial fields
    const errors = this._validatePrizeInput(data, false);
    if (errors.length > 0) {
      const err = new Error('Validation failed');
      err.details = errors;
      throw err;
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.isNoPrize !== undefined) updateData.is_no_prize = data.isNoPrize;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    return this.db.updatePrize(id, updateData);
  }

  deletePrize(id) {
    const prizes = this.db.getPrizes();
    const prize = prizes.find(p => p.id === id);
    if (!prize) return false;

    // Enforce minimum 4 segments
    if (prizes.length <= 4) {
      const err = new Error('Minimum 4 segments required');
      err.details = [{ field: 'segments', message: 'Cannot delete: minimum 4 segments required on the wheel' }];
      throw err;
    }

    // Enforce at least 1 no-prize segment remains
    if (prize.is_no_prize) {
      const noPrizeCount = prizes.filter(p => p.is_no_prize).length;
      if (noPrizeCount <= 1) {
        const err = new Error('At least one no-prize segment required');
        err.details = [{ field: 'segments', message: 'Cannot delete: at least one "Sin Premio" segment is required' }];
        throw err;
      }
    }

    return this.db.deletePrize(id);
  }

  decrementStock(prizeId) {
    return this.db.decrementStock(prizeId);
  }

  getAvailablePrizes() {
    return this.db.getPrizes().filter(p => p.stock > 0 || p.is_no_prize);
  }

  _validatePrizeInput(data, isCreate) {
    const errors = [];

    if (isCreate || data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required and must be non-empty' });
      } else if (data.name.length > 30) {
        errors.push({ field: 'name', message: 'Name must be 30 characters or less' });
      }
    }

    if (isCreate || data.color !== undefined) {
      if (!data.color || typeof data.color !== 'string' || data.color.trim().length === 0) {
        errors.push({ field: 'color', message: 'Color is required and must be non-empty' });
      }
    }

    if (isCreate || data.stock !== undefined) {
      if (data.stock === undefined || data.stock === null) {
        if (isCreate) errors.push({ field: 'stock', message: 'Stock is required' });
      } else if (typeof data.stock !== 'number' || !Number.isInteger(data.stock) || data.stock < 0) {
        errors.push({ field: 'stock', message: 'Stock must be a non-negative integer' });
      }
    }

    return errors;
  }
}

module.exports = { PrizeService };
