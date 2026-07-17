/**
 * Admin Panel JavaScript
 * Handles login, CRUD operations, and real-time updates
 */

let token = localStorage.getItem('admin_token');
let prizes = [];
let editingId = null;
let wsClient = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const prizeForm = document.getElementById('prize-form');
const formTitle = document.getElementById('form-title');
const formSubmitBtn = document.getElementById('form-submit-btn');
const formCancelBtn = document.getElementById('form-cancel-btn');
const formError = document.getElementById('form-error');
const prizesTbody = document.getElementById('prizes-tbody');
const prizeCount = document.getElementById('prize-count');
const logoutBtn = document.getElementById('logout-btn');
const wsStatus = document.getElementById('ws-status');

/**
 * API helper with auth
 */
async function apiRequest(url, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(CONFIG.API_BASE_URL + url, options);

  if (response.status === 401) {
    // Token expired or invalid
    logout();
    throw new Error('Session expired');
  }

  if (response.status === 204) return null;

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

/**
 * Login
 */
async function login(password) {
  try {
    const result = await apiRequest('/api/auth/login', 'POST', { password });
    token = result.token;
    localStorage.setItem('admin_token', token);
    showDashboard();
  } catch (e) {
    loginError.textContent = 'Contraseña incorrecta';
  }
}

/**
 * Logout
 */
function logout() {
  token = null;
  localStorage.removeItem('admin_token');
  loginScreen.style.display = 'flex';
  dashboard.style.display = 'none';
  if (wsClient) wsClient.disconnect();
}

/**
 * Show dashboard after login
 */
async function showDashboard() {
  loginScreen.style.display = 'none';
  dashboard.style.display = 'block';
  await loadPrizes();
  connectWebSocket();
}

/**
 * Load prizes from API
 */
async function loadPrizes() {
  try {
    prizes = await apiRequest('/api/prizes');
    renderTable();
  } catch (e) {
    console.error('Failed to load prizes:', e);
  }
}

/**
 * Render prize table
 */
function renderTable() {
  prizeCount.textContent = prizes.length;

  if (prizes.length === 0) {
    prizesTbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay premios configurados</td></tr>';
    return;
  }

  prizesTbody.innerHTML = prizes.map(prize => `
    <tr>
      <td><span class="color-swatch" style="background-color: ${prize.color}"></span></td>
      <td>${escapeHtml(prize.name)}</td>
      <td>${escapeHtml(prize.description || '-')}</td>
      <td class="stock-cell ${prize.stock === 0 ? 'stock-zero' : ''}">${prize.stock}</td>
      <td><span class="type-badge ${prize.is_no_prize ? 'type-no-prize' : 'type-prize'}">${prize.is_no_prize ? 'Sin Premio' : 'Premio'}</span></td>
      <td class="action-btns">
        <button class="btn btn-edit" onclick="startEdit('${prize.id}')">Editar</button>
        <button class="btn btn-danger" onclick="deletePrize('${prize.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

/**
 * HTML escape utility
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Add prize
 */
async function addPrize(data) {
  try {
    await apiRequest('/api/prizes', 'POST', data);
    resetForm();
    await loadPrizes();
    formError.textContent = '';
  } catch (e) {
    formError.textContent = e.message;
  }
}

/**
 * Edit prize
 */
async function editPrize(id, data) {
  try {
    await apiRequest(`/api/prizes/${id}`, 'PUT', data);
    resetForm();
    await loadPrizes();
    formError.textContent = '';
  } catch (e) {
    formError.textContent = e.message;
  }
}

/**
 * Start editing a prize
 */
function startEdit(id) {
  const prize = prizes.find(p => p.id === id);
  if (!prize) return;

  editingId = id;
  document.getElementById('edit-prize-id').value = id;
  document.getElementById('prize-name').value = prize.name;
  document.getElementById('prize-description').value = prize.description || '';
  document.getElementById('prize-color').value = prize.color;
  document.getElementById('prize-stock').value = prize.stock;
  document.getElementById('prize-is-no-prize').checked = prize.is_no_prize;

  formTitle.textContent = 'Editar Premio';
  formSubmitBtn.textContent = 'Guardar Cambios';
  formCancelBtn.style.display = 'inline-block';
}

/**
 * Reset form to add mode
 */
function resetForm() {
  editingId = null;
  document.getElementById('edit-prize-id').value = '';
  prizeForm.reset();
  document.getElementById('prize-color').value = '#E74C3C';
  document.getElementById('prize-stock').value = '10';
  formTitle.textContent = 'Agregar Premio';
  formSubmitBtn.textContent = 'Agregar Premio';
  formCancelBtn.style.display = 'none';
  formError.textContent = '';
}

/**
 * Delete prize
 */
async function deletePrize(id) {
  const prize = prizes.find(p => p.id === id);
  if (!prize) return;

  if (!confirm(`¿Eliminar "${prize.name}"?`)) return;

  try {
    await apiRequest(`/api/prizes/${id}`, 'DELETE');
    await loadPrizes();
  } catch (e) {
    alert(e.message);
  }
}

/**
 * Connect WebSocket for real-time updates
 */
function connectWebSocket() {
  wsClient = new WSClient();

  wsClient.onPrizesUpdated((data) => {
    prizes = data;
    renderTable();
  });

  wsClient.onStockUpdated((data) => {
    prizes = data;
    renderTable();
  });

  wsClient.onPrizesInitial((data) => {
    prizes = data;
    renderTable();
  });

  wsClient.connect();
}

// Event Listeners
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  login(password);
});

prizeForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const data = {
    name: document.getElementById('prize-name').value.trim(),
    description: document.getElementById('prize-description').value.trim(),
    color: document.getElementById('prize-color').value,
    stock: parseInt(document.getElementById('prize-stock').value, 10),
    isNoPrize: document.getElementById('prize-is-no-prize').checked
  };

  if (editingId) {
    editPrize(editingId, data);
  } else {
    addPrize(data);
  }
});

formCancelBtn.addEventListener('click', resetForm);
logoutBtn.addEventListener('click', logout);

// Check if already authenticated
(async function init() {
  if (token) {
    try {
      // Validate token by making a request
      await apiRequest('/api/prizes');
      showDashboard();
    } catch (e) {
      // Token invalid
      logout();
    }
  }
})();
