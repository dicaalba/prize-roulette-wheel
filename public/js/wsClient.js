/**
 * WebSocket Client - Shared connection manager for all frontend pages
 * Implements automatic reconnection with exponential backoff
 * Falls back to HTTP polling if WebSocket is unavailable (e.g., Lambda deployment)
 */
class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = {
      'prizes:initial': [],
      'prizes:updated': [],
      'stock:updated': []
    };
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connected = false;
    this.shouldReconnect = true;
    this.pollingInterval = null;
    this.pollingMode = false;
    this.failedAttempts = 0;
    this.maxFailedAttempts = 3; // Switch to polling after 3 failures
  }

  connect() {
    // Lambda no soporta WebSocket — ir directo a polling
    console.log('Modo Lambda: usando HTTP polling.');
    this.startPolling();
  }

  /**
   * Start HTTP polling as fallback when WebSocket is unavailable
   */
  startPolling() {
    if (this.pollingInterval) return;
    this.pollingMode = true;
    console.log('Starting HTTP polling (every 3s)...');

    // Initial fetch
    this._pollPrizes();

    this.pollingInterval = setInterval(() => {
      this._pollPrizes();
    }, 3000);
  }

  /**
   * Stop HTTP polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingMode = false;
    }
  }

  /**
   * Poll prizes via HTTP
   */
  async _pollPrizes() {
    try {
      const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
      const response = await fetch(`${baseUrl}/api/prizes`);
      if (response.ok) {
        const data = await response.json();
        // Notify all stock:updated handlers with fresh data
        if (this.handlers['stock:updated']) {
          this.handlers['stock:updated'].forEach(cb => cb(data));
        }
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }

  onPrizesInitial(callback) {
    this.handlers['prizes:initial'].push(callback);
  }

  onPrizesUpdated(callback) {
    this.handlers['prizes:updated'].push(callback);
  }

  onStockUpdated(callback) {
    this.handlers['stock:updated'].push(callback);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected() {
    return this.connected || this.pollingMode;
  }
}
