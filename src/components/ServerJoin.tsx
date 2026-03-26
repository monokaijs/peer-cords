import React, { useState } from 'react';

export default function ServerJoin({ identity, onJoin }) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState(null);

  const handleCreate = () => {
    const serverCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    onJoin(serverCode);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) onJoin(c);
  };

  return (
    <div className="identity-screen">
      <div className="identity-card">
        <div className="avatar-preview" style={{ background: identity.color }}>
          {identity.username[0].toUpperCase()}
        </div>
        <h1>Hey, {identity.username}</h1>
        <p className="subtitle">Create a new server or join an existing one</p>

        {!mode && (
          <div className="server-join-actions">
            <button className="btn-primary" onClick={handleCreate}>
              Create Server
            </button>
            <button
              className="btn-primary"
              style={{ background: '#4e5058', marginTop: '0.75rem' }}
              onClick={() => setMode('join')}
            >
              Join Server
            </button>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin}>
            <div className="input-block">
              <label>Server Code</label>
              <input
                type="text"
                placeholder="Enter server code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                maxLength={10}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!code.trim()}>
              Join
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'transparent', border: '1px solid #4e5058', marginTop: '0.5rem' }}
              onClick={() => setMode(null)}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
