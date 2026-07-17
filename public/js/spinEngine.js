/**
 * Spin Engine - Calculates spin parameters
 */
class SpinEngine {
  /**
   * Calculate spin animation parameters
   * @param {number} segmentIndex - Index of winning segment
   * @param {number} segmentCount - Total number of segments
   * @returns {{ totalRotation: number, duration: number }}
   */
  calculateSpin(segmentIndex, segmentCount) {
    const segmentAngle = 360 / segmentCount;

    // Calculate target angle - we need the pointer (at top) to align with the center of the winning segment
    // The wheel rotates clockwise, so the target is the angle from the top going clockwise to segment center
    const segmentCenterAngle = segmentIndex * segmentAngle + segmentAngle / 2;

    // The wheel needs to rotate so that this segment ends up at the top (pointer position)
    // Since CSS rotation goes clockwise, we need 360 - segmentCenterAngle to bring segment to top
    const targetAngle = 360 - segmentCenterAngle;

    // Add random full rotations (3-6) for minimum 1080 degrees total
    const randomRotations = 3 + Math.floor(Math.random() * 4); // 3 to 6
    const totalRotation = (randomRotations * 360) + targetAngle;

    // Duration between 3000ms and 6000ms
    const duration = 3000 + Math.floor(Math.random() * 3001);

    return { totalRotation, duration };
  }
}
