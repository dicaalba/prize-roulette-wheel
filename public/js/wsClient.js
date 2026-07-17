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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connected = true;
        this.reconnectDelay = 1000;
        this.failedAttempts = 0;
        this.stopPolling();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { event: eventName, data } = message;
          if (this.handlers[eventName]) {
            this.handlers[eventName].forEach(cb => cb(data));
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.failedAttempts++;

        if (this.failedAttempts >= this.maxFailedAttempts) {
          console.log('WebSocket unavailable. Switching to HTTP polling mode.');
          this.startPolling();
          return;
        }

        if (this.shouldReconnect) {
          console.log(`WebSocket disconnected. Reconnecting in ${this.reconnectDelay}ms...`);
          setTimeout(() => this._reconnect(), this.reconnectDelay);
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error');
        this.ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      this.failedAttempts++;

      if (this.failedAttempts >= this.maxFailedAttempts) {
        console.log('WebSocket unavailable. Switching to HTTP polling mode.');
        this.startPolling();
        return;
      }

      if (this.shouldReconnect) {
        setTimeout(() => this._reconnect(), this.reconnectDelay);
      }
    }
  }

  _reconnect() {
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    this.connect();
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
      const response = await fetch('/api/prizes');
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
