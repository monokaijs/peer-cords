const DB_NAME = 'discord-p2p';
const DB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity');
      }
      if (db.objectStoreNames.contains('messages')) {
        db.deleteObjectStore('messages');
      }
      const store = db.createObjectStore('messages', { keyPath: 'id' });
      store.createIndex('server_time', ['serverId', 'timestamp'], { unique: false });
      store.createIndex('server_channel_time', ['serverId', 'channelId', 'timestamp'], { unique: false });
      if (!db.objectStoreNames.contains('servers')) {
        db.createObjectStore('servers', { keyPath: 'code' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = 'readonly') {
  const t = db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

export async function getIdentity() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'identity');
    const req = store.get('current');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setIdentity(identity) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'identity', 'readwrite');
    const req = store.put(identity, 'current');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getServers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'servers');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getServer(code) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'servers');
    const req = store.get(code);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveServer(server) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'servers', 'readwrite');
    const req = store.put(server);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removeServer(code) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'servers', 'readwrite');
    const req = store.delete(code);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMessage(msg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'messages', 'readwrite');
    const req = store.put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMessages(msgs) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('messages', 'readwrite');
    const store = t.objectStore('messages');
    msgs.forEach(m => store.put(m));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getMessagesByChannel(serverId, channelId, limit = 100) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('messages', 'readonly');
    const store = t.objectStore('messages');
    const index = store.index('server_channel_time');
    const range = IDBKeyRange.bound([serverId, channelId, 0], [serverId, channelId, Infinity]);
    const req = index.openCursor(range, 'prev');
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllServerMessages(serverId, limit = 500) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('messages', 'readonly');
    const store = t.objectStore('messages');
    const index = store.index('server_time');
    const range = IDBKeyRange.bound([serverId, 0], [serverId, Infinity]);
    const req = index.openCursor(range, 'prev');
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };
    req.onerror = () => reject(req.error);
  });
}
