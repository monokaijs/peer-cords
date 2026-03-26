import Peer from 'peerjs';

let instance = null;

export function getPeerManager() {
  if (!instance) {
    instance = new PeerManager();
  }
  return instance;
}

export function destroyPeerManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

class PeerManager {
  constructor() {
    this.peer = null;
    this.peerId = null;
    this.ready = false;
    this._readyPromise = null;
    this._listeners = {
      connection: [],
      call: [],
      error: [],
      close: [],
    };
  }

  init(desiredId) {
    if (this.peer) return this._readyPromise;

    this._readyPromise = new Promise((resolve, reject) => {
      this.peer = new Peer(desiredId);

      this.peer.on('open', (id) => {
        this.peerId = id;
        this.ready = true;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this._listeners.connection.forEach(fn => fn(conn));
      });

      this.peer.on('call', (call) => {
        this._listeners.call.forEach(fn => fn(call));
      });

      this.peer.on('error', (err) => {
        this._listeners.error.forEach(fn => fn(err));
        if (!this.ready) reject(err);
      });

      this.peer.on('close', () => {
        this.ready = false;
        this._listeners.close.forEach(fn => fn());
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });

    return this._readyPromise;
  }

  on(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event].push(fn);
    }
    return () => {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    };
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
  }

  connect(targetId, options) {
    if (!this.peer) throw new Error('PeerManager not initialized');
    return this.peer.connect(targetId, options);
  }

  call(targetId, stream, options) {
    if (!this.peer) throw new Error('PeerManager not initialized');
    return this.peer.call(targetId, stream, options);
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      this.peerId = null;
      this.ready = false;
      this._readyPromise = null;
      this._listeners = {
        connection: [],
        call: [],
        error: [],
        close: [],
      };
    }
  }
}
