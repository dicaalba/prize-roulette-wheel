/**
 * Display Screen JavaScript
 * Muestra QR para participar y premios disponibles en tiempo real
 */

let prizes = [];
let wsClient = null;

// URL que se codifica en el QR — los participantes la escanean para girar
const ROULETTE_URL = 'https://dicaalba.github.io/prize-roulette-wheel/';

// ─── QR Code Generator ────────────────────────────────────────────────────────

function renderQRCode(url) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 280;
  canvas.width = size;
  canvas.height = size;
  generateQRMatrix(url, canvas, ctx, size);
  document.getElementById('qr-url-text').textContent = url;
}

function generateQRMatrix(text, canvas, ctx, size) {
  const modules = generateQRData(text);
  const moduleCount = modules.length;
  const moduleSize = Math.floor(size / moduleCount);
  const offset = Math.floor((size - moduleSize * moduleCount) / 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        ctx.fillRect(offset + col * moduleSize, offset + row * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

function generateQRData(text) {
  const size = 29;
  const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);
  drawAlignmentPattern(matrix, 22, 22);
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  const dataBits = textToBits(text);
  let bitIndex = 0;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2 && col - c >= 0; c++) {
        const x = col - c;
        const y = row;
        if (!isReserved(x, y, size)) {
          matrix[y][x] = bitIndex < dataBits.length ? dataBits[bitIndex++] === '1' : (x + y) % 2 === 0;
        }
      }
    }
  }
  return matrix;
}

function drawFinderPattern(matrix, startRow, startCol) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
        matrix[startRow + r][startCol + c] = true;
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    setIfInBounds(matrix, startRow + 7, startCol + i, false);
    setIfInBounds(matrix, startRow + i, startCol + 7, false);
  }
}

function drawAlignmentPattern(matrix, centerRow, centerCol) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const row = centerRow + r, col = centerCol + c;
      if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
        matrix[row][col] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      }
    }
  }
}

function setIfInBounds(matrix, row, col, value) {
  if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
    matrix[row][col] = value;
  }
}

function isReserved(x, y, size) {
  if (x < 9 && y < 9) return true;
  if (x < 9 && y >= size - 8) return true;
  if (x >= size - 8 && y < 9) return true;
  if (x === 6 || y === 6) return true;
  if (x >= 20 && x <= 24 && y >= 20 && y <= 24) return true;
  return false;
}

function textToBits(text) {
  return text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
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
    prizes = await prizesRes.json();
    updatePrizeList(prizes);
  } catch (e) {
    console.error('Error cargando premios:', e);
  }

  // Polling via WSClient para actualizaciones en tiempo real
  wsClient = new WSClient();
  wsClient.onPrizesInitial(data => { prizes = data; updatePrizeList(prizes); });
  wsClient.onPrizesUpdated(data => { prizes = data; updatePrizeList(prizes); });
  wsClient.onStockUpdated(data => { prizes = data; updatePrizeList(prizes); });
  wsClient.connect();
}

document.addEventListener('DOMContentLoaded', init);
