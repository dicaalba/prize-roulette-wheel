/**
 * Result Modal - Displays spin outcome
 */
class ResultModal {
  constructor() {
    this.modal = document.getElementById('result-modal');
    this.heading = document.getElementById('result-heading');
    this.description = document.getElementById('result-description');
    this.meetupBtn = document.getElementById('meetup-btn');
    this.closeBtn = document.getElementById('modal-close-btn');
    this.onClose = null;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });
  }

  /**
   * Show the result modal
   * @param {{ outcome: string, prize?: object }} result
   * @param {{ meetupUrl: string, consolationMessage: string }} config
   */
  show(result, config) {
    if (result.outcome === 'prize' && result.prize) {
      this.heading.textContent = result.prize.name;
      this.heading.className = 'result-heading prize-win';
      this.description.textContent = result.prize.description || '';
    } else {
      this.heading.textContent = 'Sin Premio';
      this.heading.className = 'result-heading no-prize';
      this.description.textContent = config.consolationMessage || '¡Mejor suerte la próxima vez!';
    }

    // Meetup button always present
    this.meetupBtn.textContent = 'Síguenos en Meetup para reclamar tu premio';
    this.meetupBtn.href = config.meetupUrl || '#';
    this.meetupBtn.target = '_blank';
    this.meetupBtn.rel = 'noopener noreferrer';

    this.modal.classList.add('visible');
  }

  /**
   * Hide the modal
   */
  hide() {
    this.modal.classList.remove('visible');
    if (this.onClose) {
      this.onClose();
    }
  }

  isVisible() {
    return this.modal.classList.contains('visible');
  }
}
