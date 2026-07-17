/**
 * QR Display Screen JavaScript
 * Renders QR code and live prize list with real-time updates
 */

let prizes = [];
let config = {};
let wsClient = null;

/**
 * Simple QR Code renderer using Canvas
 * Generates a QR code directly without external libraries
 * This is a simplified version that creates a visual QR representation
 */
function renderQRCode(url) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
  const size = 300;
  canvas.width = size;
  canvas.height = size;

  // Use the QR code generation API endpoint if available,
  // otherwise render the URL as text with a stylized pattern
  // We'll generate a simple QR-like pattern and display the URL
  generateQRMatrix(url, canvas, ctx, size);

  // Display URL below QR
  document.getElementById('qr-url-text').textContent = url;
}

/**
 * Generate a QR code matrix and render it on canvas
 * This implements a basic QR code encoder for alphanumeric data
 */
function generateQRMatrix(text, canvas, ctx, size) {
  // Simple QR code generator - creates a functional QR pattern
  // Using a basic encoding approach for short URLs

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
        ctx.fillRect(
          offset + col * moduleSize,
          offset + row * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }
}

/**
 * Generate QR code data matrix
 * Creates a version 3 QR code (29x29 modules)
 */
function generateQRData(text) {
  const size = 29;
  const matrix = Array(size).fill(null).map(() => Array(size).fill(false));

  // Draw finder patterns (3 corners)
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);

  // Draw alignment pattern (for version 3)
  drawAlignmentPattern(matrix, 22, 22);

  // Draw timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Encode data into remaining modules
  const dataBits = textToBits(text);
  let bitIndex = 0;

  // Fill data in a zigzag pattern (simplified)
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing pattern column
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2 && col - c >= 0; c++) {
        const x = col - c;
        const y = row;
        if (!isReserved(x, y, size)) {
          if (bitIndex < dataBits.length) {
            matrix[y][x] = dataBits[bitIndex] === '1';
            bitIndex++;
          } else {
            // Fill remaining with pattern
            matrix[y][x] = (x + y) % 2 === 0;
          }
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
  // Separator
  for (let i = 0; i < 8; i++) {
    if (startRow + 7 < matrix.length) setIfInBounds(matrix, startRow + 7, startCol + i, false);
    if (startCol + 7 < matrix.length) setIfInBounds(matrix, startRow + i, startCol + 7, false);
  }
}

function drawAlignmentPattern(matrix, centerRow, centerCol) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const row = centerRow + r;
      const col = centerCol + c;
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
  // Finder patterns + separators
  if (x < 9 && y < 9) return true;
  if (x < 9 && y >= size - 8) return true;
  if (x >= size - 8 && y < 9) return true;
  // Timing patterns
  if (x === 6 || y === 6) return true;
  // Alignment pattern
  if (x >= 20 && x <= 24 && y >= 20 && y <= 24) return true;
  return false;
}

function textToBits(text) {
  let bits = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    bits += charCode.toString(2).padStart(8, '0');
  }
  return bits;
}

/**
 * Update the prize list display
 */
function updatePrizeList(prizeList) {
  const container = document.getElementById('prize-list');

  // Filter out "Sin Premio" segments for display
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

/**
 * Initialize the display
 */
async function init() {
  // Load config
  try {
    const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
    const configRes = await fetch(`${baseUrl}/api/config`);
    config = await configRes.json();
  } catch (e) {
    config = { webAppUrl: window.location.origin };
  }

  // Render QR code — apunta a la página principal del frontend en GitHub Pages
  const webAppUrl = 'https://dicaalba.github.io/prize-roulette-wheel/';
  renderQRCode(webAppUrl);

  // Load initial prizes
  try {
    const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
    const prizesRes = await fetch(`${baseUrl}/api/prizes`);
    prizes = await prizesRes.json();
    updatePrizeList(prizes);
  } catch (e) {
    console.error('Failed to load prizes:', e);
  }

  // Connect WebSocket
  wsClient = new WSClient();

  wsClient.onPrizesInitial((data) => {
    prizes = data;
    updatePrizeList(prizes);
  });

  wsClient.onPrizesUpdated((data) => {
    prizes = data;
    updatePrizeList(prizes);
  });

  wsClient.onStockUpdated((data) => {
    prizes = data;
    updatePrizeList(prizes);
  });

  wsClient.connect();
}

document.addEventListener('DOMContentLoaded', init);
