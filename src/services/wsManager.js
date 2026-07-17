/**
 * WebSocket Manager - Handles real-time communication via custom WebSocket
 * Implements a lightweight WebSocket server using Node.js built-in modules
 */
const crypto = require('crypto');
const { getDatabase } = require('../db/database');

class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.db = null;
  }

  initialize(server) {
    this.db = getDatabase();

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/ws') {
        this._handleUpgrade(req, socket, head);
      } else {
        socket.destroy();
      }
    });
  }

  _handleUpgrade(req, socket, head) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC4CE562')
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      ''
    ].join('\r\n');

    socket.write(responseHeaders);

    const client = { socket, alive: true };
    this.clients.add(client);

    // Send initial state
    this._sendToClient(client, {
      event: 'prizes:initial',
      data: this.db.getPrizes()
    });

    socket.on('data', (buffer) => {
      try {
        const message = this._decodeFrame(buffer);
        if (message === null) {
          // Pong or control frame
          return;
        }
        if (message.opcode === 0x8) {
          // Close frame
          this.clients.delete(client);
          socket.end();
          return;
        }
        if (message.opcode === 0xA) {
          // Pong
          client.alive = true;
          return;
        }
        if (message.opcode === 0x9) {
          // Ping - respond with pong
          this._sendPong(client, message.payload);
          return;
        }
      } catch (e) {
        // Ignore malformed frames
      }
    });

    socket.on('close', () => {
      this.clients.delete(client);
    });

    socket.on('error', () => {
      this.clients.delete(client);
    });
  }

  _decodeFrame(buffer) {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0F;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7F;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    let mask = null;
    if (isMasked) {
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    const payload = buffer.slice(offset, offset + payloadLength);
    if (isMasked && mask) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    return { opcode, payload: payload.toString('utf-8') };
  }

  _encodeFrame(data) {
    const payload = Buffer.from(JSON.stringify(data), 'utf-8');
    const length = payload.length;

    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text frame
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    return Buffer.concat([header, payload]);
  }

  _sendToClient(client, data) {
    try {
      if (client.socket.writable) {
        client.socket.write(this._encodeFrame(data));
      }
    } catch (e) {
      this.clients.delete(client);
    }
  }

  _sendPong(client, payload) {
    try {
      const pong = Buffer.alloc(2);
      pong[0] = 0x8A; // FIN + pong
      pong[1] = 0;
      client.socket.write(pong);
    } catch (e) {
      // ignore
    }
  }

  broadcastStockUpdate(prizes) {
    const data = { event: 'stock:updated', data: prizes };
    for (const client of this.clients) {
      this._sendToClient(client, data);
    }
  }

  broadcastPrizeListUpdate(prizes) {
    const data = { event: 'prizes:updated', data: prizes };
    for (const client of this.clients) {
      this._sendToClient(client, data);
    }
  }

  sendInitialState(client) {
    this._sendToClient(client, {
      event: 'prizes:initial',
      data: this.db.getPrizes()
    });
  }

  getClientCount() {
    return this.clients.size;
  }
}

// Singleton
let instance = null;

function getWSManager() {
  if (!instance) {
    instance = new WebSocketManager();
  }
  return instance;
}

module.exports = { WebSocketManager, getWSManager };
