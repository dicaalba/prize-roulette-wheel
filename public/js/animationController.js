/**
 * Animation Controller - CSS transition-based spin animation
 */
class AnimationController {
  constructor(wheelElement) {
    this.wheelElement = wheelElement;
    this.currentRotation = 0;
  }

  /**
   * Spin the wheel to a given rotation angle
   * @param {number} rotation - Additional degrees to rotate
   * @param {number} duration - Animation duration in ms
   * @returns {Promise<void>}
   */
  spin(rotation, duration) {
    return new Promise((resolve) => {
      this.currentRotation += rotation;

      // Set transition with custom easing (mimics physical wheel deceleration)
      this.wheelElement.style.transition = `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
      this.wheelElement.style.transform = `rotate(${this.currentRotation}deg)`;

      const onEnd = () => {
        this.wheelElement.removeEventListener('transitionend', onEnd);
        resolve();
      };

      this.wheelElement.addEventListener('transitionend', onEnd);

      // Fallback timeout in case transitionend doesn't fire
      setTimeout(() => {
        this.wheelElement.removeEventListener('transitionend', onEnd);
        resolve();
      }, duration + 500);
    });
  }

  /**
   * Reset wheel to initial state (no animation)
   */
  reset() {
    this.wheelElement.style.transition = 'none';
    this.currentRotation = 0;
    this.wheelElement.style.transform = 'rotate(0deg)';
  }
}
