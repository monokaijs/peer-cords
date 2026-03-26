import React, { useState } from 'react';
import { Hash, Volume2, Mic, MicOff, Headphones, HeadphoneOff, Settings, PhoneOff, ChevronDown, Plus, Video, MonitorUp, Users, Edit2 } from 'lucide-react';

export default function Sidebar({
  identity,
  activeChannel,
  onSelectChannel,
  voiceChannel,
  voiceUsers,
  onDisconnectVoice,
  audioEnabled,
  onToggleAudio,
  audioDeafened,
  onToggleDeafen,
  serverCode,
  serverName,
  onUpdateServerName,
  channels,
  unread,
  onCreateChannel,
}) {
  const [creating, setCreating] = useState(null);
  const [newName, setNewName] = useState('');
  const [editingServer, setEditingServer] = useState(false);
  const [tempServerName, setTempServerName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const textChs = channels.filter(c => c.type === 'text');
  const voiceChs = channels.filter(c => c.type === 'voice');

  const handleCreate = (type) => {
    setCreating(type);
    setNewName('');
  };

  const submitCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !creating) return;
    onCreateChannel(name, creating);
    setCreating(null);
    setNewName('');
  };

  const cancelCreate = () => {
    setCreating(null);
    setNewName('');
  };

  const handleEditServerName = () => {
    setTempServerName(serverName || serverCode);
    setEditingServer(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitServerName();
    } else if (e.key === 'Escape') {
      setEditingServer(false);
    }
  };

  const submitServerName = (e) => {
    if (e) e.preventDefault();
    if (tempServerName.trim() && tempServerName.trim() !== serverName) {
      onUpdateServerName(tempServerName.trim());
    }
    setEditingServer(false);
  };

  return (
    <div className="sidebar">
      {editingServer ? (
        <div className="sidebar-header" style={{ padding: '8px 16px' }}>
          <input 
            type="text" 
            value={tempServerName} 
            onChange={(e) => setTempServerName(e.target.value)} 
            onBlur={submitServerName}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ width: '100%', background: 'var(--bg-tertiary)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
          />
        </div>
      ) : (
        <div className="sidebar-header" style={{ position: 'relative' }} onClick={() => setShowDropdown(!showDropdown)}>
          <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{serverName || serverCode}</h2>
          <ChevronDown size={14} />
          {showDropdown && (
            <div className="server-dropdown">
              <button onClick={(e) => { e.stopPropagation(); setShowDropdown(false); navigator.clipboard.writeText(serverCode); }}>Copy Invite Code</button>
              <button onClick={(e) => { e.stopPropagation(); setShowDropdown(false); handleEditServerName(); }}>Server Settings</button>
              <div className="dropdown-divider"></div>
              <button className="danger" onClick={(e) => { e.stopPropagation(); setShowDropdown(false); if(onLeaveServer) onLeaveServer(); }}>Leave Server</button>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-channels">
        <div className="channel-section">
          <div className="channel-section-title">
            <span>Text Channels</span>
            <button className="section-add-btn" onClick={() => handleCreate('text')} title="Create Text Channel">
              <Plus size={14} />
            </button>
          </div>
          {textChs.map(ch => (
            <button
              key={ch.id}
              className={`channel-item ${activeChannel === ch.id ? 'active' : ''} ${unread[ch.id] ? 'has-unread' : ''}`}
              onClick={() => onSelectChannel(ch.id)}
            >
              <Hash size={18} />
              <span>{ch.name}</span>
              {unread[ch.id] > 0 && <span className="unread-badge">{unread[ch.id]}</span>}
            </button>
          ))}
          {creating === 'text' && (
            <form className="channel-create-inline" onSubmit={submitCreate}>
              <Hash size={18} />
              <input
                autoFocus
                placeholder="channel-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={cancelCreate}
                onKeyDown={e => e.key === 'Escape' && cancelCreate()}
              />
            </form>
          )}
        </div>

        <div className="channel-section">
          <div className="channel-section-title">
            <span>Voice Channels</span>
            <button className="section-add-btn" onClick={() => handleCreate('voice')} title="Create Voice Channel">
              <Plus size={14} />
            </button>
          </div>
          {voiceChs.map(ch => (
            <div key={ch.id}>
              <button
                className={`channel-item voice ${voiceChannel === ch.id ? 'active' : ''}`}
                onClick={() => onSelectChannel(ch.id)}
              >
                <Volume2 size={18} />
                <span>{ch.name}</span>
              </button>
              {(voiceUsers[ch.id] || []).length > 0 && (
                <div className="voice-users">
                  {(voiceUsers[ch.id] || []).map(u => (
                    <div key={u.id} className="voice-user-pill">
                      <div className="voice-user-dot" style={{ background: u.color || '#5865f2' }} />
                      <span>{u.name || u.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {creating === 'voice' && (
            <form className="channel-create-inline" onSubmit={submitCreate}>
              <Volume2 size={18} />
              <input
                autoFocus
                placeholder="Channel Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={cancelCreate}
                onKeyDown={e => e.key === 'Escape' && cancelCreate()}
              />
            </form>
          )}
        </div>
      </div>

      {voiceChannel && (
        <div className="voice-status-panel">
          <div className="voice-status-top">
            <div className="voice-status-info">
              <span className="voice-connected-label">Voice Connected</span>
              <span className="voice-channel-name">{voiceChs.find(c => c.id === voiceChannel)?.name}</span>
            </div>
            <button className="voice-ctrl-btn disconnect" onClick={onDisconnectVoice} title="Disconnect">
              <PhoneOff size={18} />
            </button>
          </div>
          <div className="voice-status-actions">
            <button className="voice-action-btn" title="Video"><Video size={18} /></button>
            <button className="voice-action-btn" title="Screen Share"><MonitorUp size={18} /></button>
            <button className="voice-action-btn" title="Activities"><Users size={18} /></button>
          </div>
        </div>
      )}

      <div className="sidebar-user">
        <div className="user-avatar" style={{ background: identity.color }}>
          {identity.username[0].toUpperCase()}
        </div>
        <div className="user-info">
          <span className="user-name">{identity.username}</span>
          <span className="user-status">{voiceChannel ? '🟢 In voice' : 'Online'}</span>
        </div>
        <div className="user-controls">
          <button
            className={`user-ctrl-btn ${!audioEnabled || audioDeafened ? 'muted' : ''}`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
            onClick={onToggleAudio}
          >
            {(!audioEnabled || audioDeafened) ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            className={`user-ctrl-btn ${audioDeafened ? 'danger' : ''}`}
            title={audioDeafened ? 'Undeafen' : 'Deafen'}
            onClick={onToggleDeafen}
          >
            {audioDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
          </button>
          <button className="user-ctrl-btn" title="Settings"><Settings size={16} /></button>
        </div>
      </div>
    </div>
  );
}
