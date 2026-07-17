/**
 * Display Screen JavaScript
 * Muestra QR para participar y premios disponibles en tiempo real
 */

let prizes = [];
let wsClient = null;

// URL que se codifica en el QR — los participantes la escanean para girar
const ROULETTE_URL = 'https://ruleta.awsgirlsperu.com/';

// ─── QR Code Generator ────────────────────────────────────────────────────────

function renderQRCode(url) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;
  QRCode.toCanvas(canvas, url, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'M'
  }, function(err) {
    if (err) console.error('QR render error:', err);
  });
  const urlText = document.getElementById('qr-url-text');
  if (urlText) urlText.textContent = url;
}

// ─── Prize List ───────────────────────────────────────────────────────────────

function updatePrizeList(prizeList) {
  const container = document.getElementById('prize-list');
  const displayPrizes = prizeList.filter(p => !p.is_no_prize);

  if (displayPrizes.length === 0) {
    container.innerHTML = '<div class="loading-state">No hay premios disponibles</div>';
    return;
  }

  container.innerHTML = displayPrizes.map(prize => {
    const isUnavailable = prize.stock <= 0;
    return `
      <div class="prize-item ${isUnavailable ? 'unavailable' : ''}" style="border-left-color: ${prize.color}">
        <span class="prize-item-name">${escapeHtml(prize.name)}</span>
        <span class="prize-stock-badge ${isUnavailable ? 'depleted' : ''}">
          ${isUnavailable ? 'Agotado' : prize.stock}
        </span>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Renderizar QR apuntando a la ruleta
  renderQRCode(ROULETTE_URL);

  const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';

  // Carga inicial de premios
  try {
    const prizesRes = await fetch(`${baseUrl}/api/prizes`);
    const prizesData = await prizesRes.json();
    prizes = Array.isArray(prizesData) ? prizesData : (prizesData.prizes || []);
    updatePrizeList(prizes);
  } catch (e) {
    console.error('Error cargando premios:', e);
  }

  // Polling via WSClient para actualizaciones en tiempo real
  wsClient = new WSClient();
  wsClient.onPrizesInitial(data => { prizes = data; updatePrizeList(prizes); });
  wsClient.onPrizesUpdated(data => { prizes = data; updatePrizeList(prizes); });
  wsClient.onStockUpdated(data => { prizes = data; updatePrizeList(prizes); });

  // Display stays alive with a slow heartbeat when paused so it auto-detects activation.
  // (Only 1 device — the projector — so 1 call/60s is fine.)
  wsClient.onEventStatus(data => {
    wsClient.setPollRate(data.event_active ? 15000 : 60000);
  });

  wsClient.connect();
}

document.addEventListener('DOMContentLoaded', init);
