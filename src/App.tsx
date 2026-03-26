import React, { useState, useEffect } from 'react';
import IdentityScreen from './components/IdentityScreen';
import AppShell from './components/AppShell';
import { getIdentity, setIdentity, getServers, saveServer } from './lib/db';
import { Plus } from 'lucide-react';
import { customAlphabet } from 'nanoid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

function App() {
  const [identity, setId] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [activeServer, setActiveServer] = useState<any>(null);
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
        <div className="no-server-view text-center flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">No servers yet</h2>
          <p className="text-muted-foreground">Create or join a server to get started</p>
          <Button className="w-auto px-8 bg-brand-500 hover:bg-brand-560 text-white" onClick={() => setShowJoinModal(true)}>
            Add Server
          </Button>
        </div>
      )}

      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent className="sm:max-w-md bg-card border-none outline-none">
          <DialogHeader>
            <DialogTitle>Add a Server</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">Create a new server or join an existing one</p>
            <Button onClick={handleCreateServer} className="w-full bg-brand-500 hover:bg-brand-560 text-white border-0">
              Create Server
            </Button>
            <div className="flex items-center gap-2">
              <span className="w-full border-t border-border"></span>
              <span className="text-xs text-muted-foreground uppercase uppercase tracking-wider">or</span>
              <span className="w-full border-t border-border"></span>
            </div>
            <form onSubmit={handleJoinServer} className="flex flex-col gap-3">
              <label className="text-xs font-bold text-muted-foreground uppercase">Server Code</label>
              <Input
                type="text"
                placeholder="Enter server code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoFocus
                className="bg-[var(--bg-tertiary)] border-none text-[var(--text-normal)] focus-visible:ring-1 focus-visible:ring-[var(--brand-500)]"
              />
              <Button type="submit" variant="secondary" disabled={!joinCode.trim()} className="w-full">
                Join Server
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
