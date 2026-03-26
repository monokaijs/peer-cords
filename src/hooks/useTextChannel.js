import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { getPeerManager } from '../lib/PeerManager';
import { peerIdForChannel } from '../lib/channels';
import { saveMessage, saveMessages, getMessages, getMessagesBefore } from '../lib/db';

export function useTextChannel(channelId, identity) {
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const connsRef = useRef({});
  const isHostRef = useRef(false);
  const channelPeerRef = useRef(null);

  const broadcastToConns = useCallback((data) => {
    Object.values(connsRef.current).forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }, []);

  const handleIncomingData = useCallback(async (data, fromConn) => {
    if (data.type === 'chat-message') {
      await saveMessage(data.message);
      setMessages(prev => {
        if (prev.find(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      Object.values(connsRef.current).forEach(conn => {
        if (conn.open && conn.peer !== fromConn.peer) {
          conn.send(data);
        }
      });
    } else if (data.type === 'history-request') {
      const msgs = await getMessagesBefore(channelId, data.before, data.limit || 50);
      fromConn.send({ type: 'history-response', messages: msgs, requestId: data.requestId });
    } else if (data.type === 'history-response') {
      if (data.messages?.length) {
        await saveMessages(data.messages);
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = data.messages.filter(m => !ids.has(m.id));
          if (!newMsgs.length) return prev;
          return [...newMsgs, ...prev].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    } else if (data.type === 'peers') {
      const pm = getPeerManager();
      data.peers.forEach(pid => {
        if (!connsRef.current[pid] && pid !== pm.peerId) {
          const conn = pm.connect(pid);
          setupConn(conn);
        }
      });
    }
  }, [channelId]);

  const setupConn = useCallback((conn) => {
    const id = conn.peer;
    connsRef.current[id] = conn;

    conn.on('open', () => {
      setOnlineCount(Object.keys(connsRef.current).length);
      if (isHostRef.current) {
        const peerList = Object.keys(connsRef.current).filter(k => connsRef.current[k].open);
        conn.send({ type: 'peers', peers: peerList });
      }
    });

    conn.on('data', (data) => handleIncomingData(data, conn));

    conn.on('close', () => {
      delete connsRef.current[id];
      setOnlineCount(Object.keys(connsRef.current).length);
    });

    conn.on('error', () => {
      delete connsRef.current[id];
      setOnlineCount(Object.keys(connsRef.current).length);
    });
  }, [handleIncomingData]);

  useEffect(() => {
    if (!channelId || !identity) return;

    let active = true;
    const pm = getPeerManager();

    const loadLocal = async () => {
      const local = await getMessages(channelId, 100);
      if (active) setMessages(local);
    };
    loadLocal();

    const hostPeerId = peerIdForChannel(channelId);

    const tryJoin = async () => {
      await pm.init();
      if (!active) return;

      const conn = pm.connect(hostPeerId);
      let connected = false;

      conn.on('open', () => {
        connected = true;
        setupConn(conn);
        conn.send({
          type: 'history-request',
          before: Date.now(),
          limit: 50,
          requestId: Math.random().toString(36).slice(2),
        });
      });

      conn.on('error', () => {
        if (!connected && active) {
          becomeHost();
        }
      });

      setTimeout(() => {
        if (!connected && active) {
          becomeHost();
        }
      }, 3000);
    };

    const becomeHost = () => {
      isHostRef.current = true;
      if (channelPeerRef.current) {
        channelPeerRef.current.destroy();
      }
      const hostPeer = new Peer(hostPeerId);
      channelPeerRef.current = hostPeer;

      hostPeer.on('connection', (conn) => {
        setupConn(conn);
      });

      hostPeer.on('error', () => {});
    };

    tryJoin();

    return () => {
      active = false;
      Object.values(connsRef.current).forEach(c => c.close());
      connsRef.current = {};
      if (channelPeerRef.current) {
        channelPeerRef.current.destroy();
        channelPeerRef.current = null;
      }
      isHostRef.current = false;
      setMessages([]);
      setOnlineCount(0);
    };
  }, [channelId, identity, setupConn]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !identity) return;
    const pm = getPeerManager();
    const msg = {
      id: `${pm.peerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channelId,
      senderId: pm.peerId,
      senderName: identity.username,
      senderColor: identity.color,
      text: text.trim(),
      timestamp: Date.now(),
    };
    await saveMessage(msg);
    setMessages(prev => [...prev, msg]);
    broadcastToConns({ type: 'chat-message', message: msg });
  }, [channelId, identity, broadcastToConns]);

  return { messages, sendMessage, onlineCount };
}
