/**
 * Spin Service - Handles spin logic, random selection, and stock decrement
 */
const { getDatabase } = require('../db/database');

class SpinService {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Compute wheel segments from prizes
   * Prizes with stock=0 become "Sin Premio" segments
   */
  computeWheelSegments(prizes) {
    return prizes.map(prize => {
      if (prize.is_no_prize || prize.stock <= 0) {
        return {
          id: prize.id,
          name: 'Sin Premio',
          description: '',
          color: prize.is_no_prize ? prize.color : '#95A5A6',
          isNoPrize: true,
          originalPrizeId: prize.is_no_prize ? undefined : prize.id
        };
      }
      return {
        id: prize.id,
        name: prize.name,
        description: prize.description,
        color: prize.color,
        isNoPrize: false
      };
    });
  }

  /**
   * Execute a spin
   * 1. Build wheel segments
   * 2. Select random winner
   * 3. If prize, attempt stock decrement
   * 4. If decrement fails (race condition), return no_prize
   */
  executeSpin() {
    const prizes = this.db.getPrizes();
    const segments = this.computeWheelSegments(prizes);

    if (segments.length === 0) {
      throw new Error('No segments available for spinning');
    }

    // Select random winning segment
    const segmentIndex = Math.floor(Math.random() * segments.length);
    const winningSegment = segments[segmentIndex];

    let outcome = 'no_prize';
    let prizeInfo = null;

    if (!winningSegment.isNoPrize) {
      // Attempt atomic stock decrement
      const result = this.db.decrementStock(winningSegment.id);
      if (result.success) {
        outcome = 'prize';
        const updatedPrize = this.db.getPrizeById(winningSegment.id);
        prizeInfo = {
          id: updatedPrize.id,
          name: updatedPrize.name,
          description: updatedPrize.description
        };
      }
      // If decrement failed (stock was 0), outcome stays 'no_prize'
    }

    // Get updated prize list for broadcast
    const updatedPrizes = this.db.getPrizes();

    return {
      outcome,
      prize: prizeInfo,
      segmentIndex,
      updatedPrizes
    };
  }
}

module.exports = { SpinService };
