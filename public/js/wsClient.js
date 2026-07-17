/**
 * WebSocket Client - Shared connection manager for all frontend pages
 * - En localhost: usa WebSocket real (sin polling, actualizaciones instantáneas)
 * - En producción (Lambda/GitHub Pages): HTTP polling
 *   - Evento activo:  cada 15s
 *   - Evento pausado: cada 60s (ahorra llamadas Lambda)
 */
class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = {
      'prizes:initial': [],
      'prizes:updated': [],
      'stock:updated':  [],
      'event:status':   []
    };
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connected = false;
    this.shouldReconnect = true;
    this.pollingInterval = null;
    this.pollingMode = false;
    this.pollRateMs = 15000;
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
    this.pollingInterval = setInterval(() => this._pollPrizes(), this.pollRateMs);
  }

  // Adjusts poll interval without missing a beat (public — pages can call this)
  setPollRate(ms) {
    if (this.pollRateMs === ms || !this.pollingInterval) return;
    this.pollRateMs = ms;
    clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => this._pollPrizes(), ms);
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

        // Support both legacy array format and new { prizes, event_active } format
        const prizes = Array.isArray(data) ? data : (data.prizes || []);
        const eventActive = Array.isArray(data) ? true : (data.event_active !== false);

        this.handlers['stock:updated'].forEach(cb => cb(prizes));
        this.handlers['event:status'].forEach(cb => cb({ event_active: eventActive }));

              // Pages decide what to do via onEventStatus handlers
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }

  onPrizesInitial(callback) { this.handlers['prizes:initial'].push(callback); }
  onPrizesUpdated(callback) { this.handlers['prizes:updated'].push(callback); }
  onStockUpdated(callback)  { this.handlers['stock:updated'].push(callback); }
  onEventStatus(callback)   { this.handlers['event:status'].push(callback); }

  disconnect() {
    this.shouldReconnect = false;
    this.stopPolling();
    if (this.ws) this.ws.close();
  }

  isConnected() {
    return this.connected || this.pollingMode;
  }
}
