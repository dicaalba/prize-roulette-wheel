/**
 * WebSocket Client - Shared connection manager for all frontend pages
 * - En localhost: usa WebSocket real (sin polling, actualizaciones instantáneas)
 * - En producción (Lambda/GitHub Pages): HTTP polling cada 15s
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
  }

  connect() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      this._connectWebSocket();
    } else {
      this.startPolling();
    }
  }

  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.pollingMode = false;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const handlers = this.handlers[msg.event];
          if (handlers) handlers.forEach(cb => cb(msg.data));
        } catch (e) { /* ignorar mensajes malformados */ }
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (this.shouldReconnect) {
          setTimeout(() => this._connectWebSocket(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        }
      };

      this.ws.onerror = () => {
        // Si WS falla en localhost, caer a polling como respaldo
        this.ws.close();
        if (!this.pollingInterval) this.startPolling();
      };
    } catch (e) {
      this.startPolling();
    }
  }

  startPolling() {
    if (this.pollingInterval) return;
    this.pollingMode = true;
    this._pollPrizes();
    this.pollingInterval = setInterval(() => this._pollPrizes(), 15000); // 15s en vez de 3s
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingMode = false;
    }
  }

  async _pollPrizes() {
    try {
      const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : '';
      const response = await fetch(`${baseUrl}/api/prizes`);
      if (response.ok) {
        const data = await response.json();
        this.handlers['stock:updated'].forEach(cb => cb(data));
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }

  onPrizesInitial(callback)  { this.handlers['prizes:initial'].push(callback); }
  onPrizesUpdated(callback)  { this.handlers['prizes:updated'].push(callback); }
  onStockUpdated(callback)   { this.handlers['stock:updated'].push(callback); }

  disconnect() {
    this.shouldReconnect = false;
    this.stopPolling();
    if (this.ws) this.ws.close();
  }

  isConnected() {
    return this.connected || this.pollingMode;
  }
}
