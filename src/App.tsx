import React, { useState, useEffect } from 'react';
import IdentityScreen from './components/IdentityScreen';
import AppShell from './components/AppShell';
import { getIdentity, setIdentity, getServers, saveServer } from './lib/db';
import { Plus } from 'lucide-react';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

function App() {
  const [identity, setId] = useState(null);
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    Promise.all([getIdentity(), getServers()]).then(([id, svrs]) => {
      if (ignore) return;
      if (id) setId(id);
      const unique = svrs.filter((s, i, arr) => arr.findIndex(x => x.code === s.code) === i);
      setServers(unique);
      if (unique.length > 0) setActiveServer(unique[0].code);
      setLoading(false);
    }).catch(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const handleIdentity = async (id) => {
    await setIdentity(id);
    setId(id);
  };

  const handleCreateServer = async () => {
    const code = nanoid(8);
    const server = { code, name: 'Server', joinedAt: Date.now() };
    await saveServer(server);
    setServers(prev => prev.find(s => s.code === code) ? prev : [...prev, server]);
    setActiveServer(code);
    setShowJoinModal(false);
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toLowerCase();
    if (!code) return;
    if (servers.find(s => s.code === code)) {
      setActiveServer(code);
      setShowJoinModal(false);
      setJoinCode('');
      return;
    }
    const server = { code, name: `Server`, joinedAt: Date.now() };
    await saveServer(server);
    setServers(prev => prev.find(s => s.code === code) ? prev : [...prev, server]);
    setActiveServer(code);
    setShowJoinModal(false);
    setJoinCode('');
  };

  if (loading) return null;

  if (!identity) {
    return <IdentityScreen onComplete={handleIdentity} />;
  }

  const handleUpdateServerName = async (code, name) => {
    const srv = servers.find(s => s.code === code);
    if (!srv) return;
    const updated = { ...srv, name };
    await saveServer(updated);
    setServers(prev => prev.map(s => s.code === code ? updated : s));
  };

  const handleLeaveServer = async (code) => {
    // In a real app we'd delete from DB or just from local list
    // Let's just remove from local servers view
    const newServers = servers.filter(s => s.code !== code);
    setServers(newServers);
    setActiveServer(newServers.length > 0 ? newServers[0].code : null);
  };

  return (
    <div className="app-root">
      <div className="server-bar">
        {servers.map(s => (
          <button
            key={s.code}
            className={`server-icon ${activeServer === s.code ? 'active' : ''}`}
            onClick={() => setActiveServer(s.code)}
            title={s.name || s.code}
          >
            {(s.name || s.code).slice(0, 2).toUpperCase()}
          </button>
        ))}
        <div className="server-bar-divider" />
        <button
          className="server-icon add-server"
          onClick={() => setShowJoinModal(true)}
          title="Add a Server"
        >
          <Plus size={20} />
        </button>
      </div>

      {activeServer ? (
        <AppShell
          key={activeServer}
          identity={identity}
          serverCode={activeServer}
          serverName={servers.find(s => s.code === activeServer)?.name || activeServer}
          onUpdateServerName={(name) => handleUpdateServerName(activeServer, name)}
          onLeaveServer={() => handleLeaveServer(activeServer)}
        />
      ) : (
        <div className="no-server-view">
          <h2>No servers yet</h2>
          <p>Create or join a server to get started</p>
          <button className="btn-primary" style={{ width: 'auto', padding: '0.7rem 2rem' }} onClick={() => setShowJoinModal(true)}>
            Add Server
          </button>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Add a Server</h2>
            <p className="subtitle">Create a new server or join an existing one</p>
            <button className="btn-primary" onClick={handleCreateServer}>
              Create Server
            </button>
            <div className="modal-divider">
              <span>or</span>
            </div>
            <form onSubmit={handleJoinServer}>
              <div className="input-block">
                <label>Server Code</label>
                <input
                  type="text"
                  placeholder="Enter server code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary btn-secondary" disabled={!joinCode.trim()}>
                Join Server
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
