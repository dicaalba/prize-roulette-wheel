/**
 * Main Roulette Wheel Application
 * Orchestrates wheel rendering, spin animation, modal display, and WebSocket updates
 */

// Application State
const AppState = {
  CONNECTING: 'connecting',
  IDLE: 'idle',
  SPINNING: 'spinning',
  AWAIT_RESULT: 'awaitResult',
  SHOW_RESULT: 'showResult'
};

let state = AppState.CONNECTING;
let prizes = [];
let segments = [];
let config = {};
let eventActive = true;
let wheelRenderer = null;
let spinEngine = null;
let animationController = null;
let resultModal = null;
let wsClient = null;

/**
 * Compute wheel segments from prizes
 */
function computeWheelSegments(prizeList) {
  return prizeList.map(prize => {
    if (prize.is_no_prize || prize.stock <= 0) {
      return {
        id: prize.id,
        name: prize.is_no_prize ? prize.name : 'Sin Premio',
        description: '',
        color: prize.is_no_prize ? prize.color : '#95A5A6',
        isNoPrize: true
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
 * Update wheel display
 */
function updateWheel() {
  segments = computeWheelSegments(prizes);
  const canvas = document.getElementById('wheel-canvas');
  wheelRenderer.render(segments);
}

/**
 * Set application state and update UI
 */
function setState(newState) {
  state = newState;
  const spinBtn = document.getElementById('spin-btn');
  const statusEl = document.getElementById('status-text');

  switch (state) {
    case AppState.CONNECTING:
      spinBtn.disabled = true;
      spinBtn.textContent = 'Conectando...';
      if (statusEl) statusEl.textContent = 'Conectando al servidor...';
      break;
    case AppState.IDLE:
      spinBtn.disabled = !eventActive;
      spinBtn.textContent = 'Girar';
      if (statusEl) statusEl.textContent = eventActive ? '' : 'El evento está pausado';
      break;
    case AppState.SPINNING:
      spinBtn.disabled = true;
      spinBtn.textContent = 'Girando...';
      if (statusEl) statusEl.textContent = '';
      break;
    case AppState.AWAIT_RESULT:
      spinBtn.disabled = true;
      spinBtn.textContent = 'Girando...';
      break;
    case AppState.SHOW_RESULT:
      spinBtn.disabled = true;
      spinBtn.textContent = 'Girar';
      break;
  }
}

/**
 * Handle spin button click
 */
async function handleSpin() {
  if (state !== AppState.IDLE || !eventActive) return;

  setState(AppState.SPINNING);

  try {
    // Call spin API
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/spin`, { method: 'POST' });
    const result = await response.json();

    // Animate wheel to winning segment
    const { totalRotation, duration } = spinEngine.calculateSpin(result.segmentIndex, segments.length);
    await animationController.spin(totalRotation, duration);

    // Update prizes from result
    if (result.updatedPrizes) {
      prizes = result.updatedPrizes;
      updateWheel();
    }

    // Show result modal
    setState(AppState.SHOW_RESULT);
    resultModal.show(result, config);
  } catch (e) {
    console.error('Spin error:', e);
    setState(AppState.IDLE);
    alert('Error al girar. Intenta de nuevo.');
  }
}

/**
 * Initialize the application
 */
async function init() {
  // Initialize components
  const canvas = document.getElementById('wheel-canvas');
  wheelRenderer = new WheelRenderer(canvas);
  spinEngine = new SpinEngine();

  const wheelContainer = document.getElementById('wheel-container');
  animationController = new AnimationController(wheelContainer);

  resultModal = new ResultModal();
  resultModal.onClose = () => {
    setState(AppState.IDLE);
  };

  // Set up spin button
  document.getElementById('spin-btn').addEventListener('click', handleSpin);

  // Load config
  try {
    const configRes = await fetch(`${CONFIG.API_BASE_URL}/api/config`);
    config = await configRes.json();
  } catch (e) {
    config = {
      meetupUrl: CONFIG.MEETUP_URL,
      consolationMessage: '¡Mejor suerte la próxima vez!',
      webAppUrl: window.location.origin
    };
  }

  // Load initial prizes
  try {
    const prizesRes = await fetch(`${CONFIG.API_BASE_URL}/api/prizes`);
    const prizesData = await prizesRes.json();
    prizes = Array.isArray(prizesData) ? prizesData : (prizesData.prizes || []);
    eventActive = Array.isArray(prizesData) ? true : (prizesData.event_active !== false);
    updateWheel();
    setState(AppState.IDLE);
  } catch (e) {
    console.error('Failed to load prizes:', e);
  }

  // Connect WebSocket for real-time updates
  wsClient = new WSClient();

  wsClient.onPrizesInitial((data) => {
    prizes = data;
    updateWheel();
    if (state === AppState.CONNECTING) {
      setState(AppState.IDLE);
    }
  });

  wsClient.onPrizesUpdated((data) => {
    prizes = data;
    if (state !== AppState.SPINNING && state !== AppState.AWAIT_RESULT) {
      updateWheel();
    }
  });

  wsClient.onStockUpdated((data) => {
    prizes = data;
    if (state !== AppState.SPINNING && state !== AppState.AWAIT_RESULT) {
      updateWheel();
    }
  });

  wsClient.onEventStatus((data) => {
    eventActive = data.event_active;
    if (!eventActive) {
      // True pause: stop ALL polling — zero Lambda calls until participant refreshes page.
      // Participants scan the QR when the event starts, so they always land on the active version.
      wsClient.stopPolling();
    }
    if (state === AppState.IDLE) setState(AppState.IDLE);
  });

  wsClient.connect();

  // Resize canvas to fit container
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

/**
 * Resize canvas to fit its container
 */
function resizeCanvas() {
  const canvas = document.getElementById('wheel-canvas');
  const container = canvas.parentElement;
  const size = Math.min(container.clientWidth, container.clientHeight, 500);
  canvas.width = size;
  canvas.height = size;
  if (segments.length > 0) {
    wheelRenderer.render(segments);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
