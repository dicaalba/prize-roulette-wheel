/**
 * WebSocket Client - Shared connection manager for all frontend pages
 * Implements automatic reconnection with exponential backoff
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
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connected = true;
        this.reconnectDelay = 1000; // Reset backoff
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
      if (this.shouldReconnect) {
        setTimeout(() => this._reconnect(), this.reconnectDelay);
      }
    }
  }

  _reconnect() {
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    this.connect();
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
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected() {
    return this.connected;
  }
}
