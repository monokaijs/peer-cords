import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { saveMessage, saveMessages, getMessagesByChannel, getAllServerMessages, getServer, saveServer } from '../lib/db';
import { DEFAULT_CHANNELS } from '../lib/channels';

function useRoom(serverCode, identity, serverName, onSyncServerName) {
  const [peerId, setPeerId] = useState(null);
  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState({});
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [voiceMembers, setVoiceMembers] = useState({});
  const [unread, setUnread] = useState({});
  const [error, setError] = useState(null);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStreamsState, setRemoteStreamsState] = useState({});
  const [mediaStates, setMediaStates] = useState({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioDeafened, setAudioDeafened] = useState(false);

  const peerRef = useRef(null);
  const hostPeerRef = useRef(null);
  const connsRef = useRef({});
  const isHostRef = useRef(false);
  const identityRef = useRef(identity);
  const serverNameRef = useRef(serverName);

  useEffect(() => {
    serverNameRef.current = serverName;
  }, [serverName]);

  const broadcastServerName = useCallback((name) => {
    Object.entries(connsRef.current).forEach(([id, conn]) => {
      if (conn.open) {
        try { conn.send({ type: 'server-info', serverName: name }); } catch (e) {}
      }
    });
  }, []);

  const localStreamRef = useRef(null);
  const mediaCallsRef = useRef({});
  const myVoiceChannelRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const activeChannelRef = useRef(null);
  const channelsRef = useRef(channels);
  const voiceMembersRef = useRef(voiceMembers);
  const handleDataRef = useRef(null);
  const setupConnRef = useRef(null);

  identityRef.current = identity;
  channelsRef.current = channels;
  voiceMembersRef.current = voiceMembers;

  const broadcastData = useCallback((data, excludePeerId) => {
    Object.entries(connsRef.current).forEach(([id, conn]) => {
      if (conn.open && id !== excludePeerId) {
        try { conn.send(data); } catch (e) {}
      }
    });
  }, []);

  const updatePeerCount = useCallback(() => {
    const p = {};
    Object.entries(connsRef.current).forEach(([id, conn]) => {
      if (conn.open) p[id] = conn._peerIdentity || { username: id };
    });
    setPeers(p);
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const ch = msg.channelId;
      const existing = prev[ch] || [];
      if (existing.find(m => m.id === msg.id)) return prev;
      return { ...prev, [ch]: [...existing, msg].sort((a, b) => a.timestamp - b.timestamp) };
    });
  }, []);

  const markUnread = useCallback((channelId) => {
    if (activeChannelRef.current === channelId) return;
    setUnread(prev => ({ ...prev, [channelId]: (prev[channelId] || 0) + 1 }));
  }, []);

  const handleData = useCallback(async (data, fromConn) => {
    const fromId = fromConn.peer;
    console.log('[room] recv', data.type, 'from', fromId);

    if (data.type === 'identity') {
      fromConn._peerIdentity = data.identity;
      updatePeerCount();
    }

    if (data.type === 'chat-message') {
      const msg = data.message;
      const dbMsg = { ...msg, serverId: serverCode };
      await saveMessage(dbMsg);
      addMessage(msg);
      markUnread(msg.channelId);
      broadcastData(data, fromId);
    }

    if (data.type === 'peers') {
      const pm = peerRef.current;
      if (!pm) return;
      data.peers.forEach(pid => {
        if (!connsRef.current[pid] && pid !== pm.id) {
          const conn = pm.connect(pid);
          setupConnRef.current(conn);
        }
      });
    }

    if (data.type === 'history-request') {
      const msgs = await getAllServerMessages(serverCode, 500);
      fromConn.send({
        type: 'history-response',
        messages: msgs,
        serverName: serverNameRef.current,
      });
    }

    if (data.type === 'history-response') {
      if (data.serverName && onSyncServerName) {
        onSyncServerName(data.serverName);
      }
      if (data.messages?.length) {
        const dbMsgs = data.messages.map(m => ({ ...m, serverId: serverCode }));
        await saveMessages(dbMsgs);
        const byChannel = {};
        data.messages.forEach(m => {
          if (!byChannel[m.channelId]) byChannel[m.channelId] = [];
          byChannel[m.channelId].push(m);
        });
        setMessages(prev => {
          const next = { ...prev };
          Object.entries(byChannel).forEach(([ch, msgs]) => {
            const existing = next[ch] || [];
            const ids = new Set(existing.map(m => m.id));
            const newMsgs = msgs.filter(m => !ids.has(m.id));
            if (newMsgs.length) {
              next[ch] = [...existing, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
            }
          });
          return next;
        });
      }
    }

    if (data.type === 'server-info') {
      if (data.serverName && onSyncServerName) {
        onSyncServerName(data.serverName);
      }
    }

    if (data.type === 'media-state') {
      setMediaStates(prev => ({ ...prev, [data.peerId]: data.state }));
      if (isHostRef.current) {
        broadcastData(data, fromId);
      }
    }

    if (data.type === 'voice-join') {
      setVoiceMembers(prev => {
        const ch = data.channelId;
        const members = prev[ch] || [];
        if (members.find(m => m.id === fromId)) return prev;
        return { ...prev, [ch]: [...members, { id: fromId, name: data.name, color: data.color }] };
      });
      if (myVoiceChannelRef.current === data.channelId && localStreamRef.current) {
        startMediaWith(fromId);
      }
      broadcastData(data, fromId);
    }

    if (data.type === 'voice-leave') {
      setVoiceMembers(prev => {
        const ch = data.channelId;
        const members = (prev[ch] || []).filter(m => m.id !== fromId);
        return { ...prev, [ch]: members };
      });
      stopMediaWith(fromId);
      broadcastData(data, fromId);
    }

    if (data.type === 'state-sync') {
      if (data.voiceMembers) {
        setVoiceMembers(prev => {
          const next = { ...prev };
          Object.entries(data.voiceMembers).forEach(([ch, members]) => {
            next[ch] = members;
          });
          return next;
        });
      }
      if (data.channels?.length) {
        setChannels(data.channels);
        persistChannels(data.channels);
      }
    }

    if (data.type === 'channel-create') {
      setChannels(prev => {
        if (prev.find(c => c.id === data.channel.id)) return prev;
        const next = [...prev, data.channel];
        persistChannels(next);
        return next;
      });
      broadcastData(data, fromId);
    }
  }, [serverCode, broadcastData, updatePeerCount, addMessage, markUnread]);

  handleDataRef.current = handleData;

  const setupConn = useCallback((conn) => {
    const id = conn.peer;
    connsRef.current[id] = conn;

    const onOpen = () => {
      console.log('[room] conn open to', id);
      conn.send({ type: 'identity', identity: identityRef.current });
      updatePeerCount();

      if (isHostRef.current) {
        const peerList = Object.keys(connsRef.current).filter(k => connsRef.current[k].open);
        conn.send({ type: 'peers', peers: peerList });
        conn.send({ type: 'state-sync', voiceMembers: voiceMembersRef.current, channels: channelsRef.current });
      }
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (data) => handleDataRef.current(data, conn));

    conn.on('close', () => {
      delete connsRef.current[id];
      updatePeerCount();
      setVoiceMembers(prev => {
        const next = {};
        Object.entries(prev).forEach(([ch, members]) => {
          next[ch] = members.filter(m => m.id !== id);
        });
        return next;
      });
      stopMediaWith(id);
    });

    conn.on('error', () => {
      delete connsRef.current[id];
      updatePeerCount();
    });
  }, [updatePeerCount]);

  setupConnRef.current = setupConn;

  const startMediaWith = useCallback((targetId) => {
    if (!localStreamRef.current || !peerRef.current) return;
    if (mediaCallsRef.current[targetId]) return;
    const call = peerRef.current.call(targetId, localStreamRef.current, {
      metadata: { voiceChannel: myVoiceChannelRef.current }
    });
    mediaCallsRef.current[targetId] = call;
    call.on('stream', (remoteStream) => {
      remoteStreamsRef.current[targetId] = remoteStream;
      setRemoteStreamsState(prev => ({ ...prev, [targetId]: remoteStream }));
      playRemoteStream(targetId, remoteStream);
    });
    call.on('close', () => {
      delete mediaCallsRef.current[targetId];
      delete remoteStreamsRef.current[targetId];
      setRemoteStreamsState(prev => { const next = { ...prev }; delete next[targetId]; return next; });
    });
  }, []);

  const stopMediaWith = useCallback((targetId) => {
    if (mediaCallsRef.current[targetId]) {
      mediaCallsRef.current[targetId].close();
      delete mediaCallsRef.current[targetId];
    }
    if (remoteStreamsRef.current[targetId]) {
      delete remoteStreamsRef.current[targetId];
      setRemoteStreamsState(prev => { const next = { ...prev }; delete next[targetId]; return next; });
    }
    const audio = document.getElementById(`remote-audio-${targetId}`);
    if (audio) audio.remove();
  }, []);

  const audioDeafenedRef = useRef(audioDeafened);
  useEffect(() => { audioDeafenedRef.current = audioDeafened; }, [audioDeafened]);

  const playRemoteStream = (peerId, stream) => {
    let audio = document.getElementById(`remote-audio-${peerId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `remote-audio-${peerId}`;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.muted = audioDeafenedRef.current;
  };

  const persistChannels = useCallback(async (chs) => {
    const server = await getServer(serverCode);
    if (server) {
      server.channels = chs;
      await saveServer(server);
    }
  }, [serverCode]);

  useEffect(() => {
    if (!serverCode || !identity) return;
    let active = true;

    const hostPeerId = `server-${serverCode}`;

    const loadLocalMessages = async () => {
      const all = await getAllServerMessages(serverCode, 500);
      const byChannel = {};
      all.forEach(m => {
        if (!byChannel[m.channelId]) byChannel[m.channelId] = [];
        byChannel[m.channelId].push(m);
      });
      if (active) setMessages(byChannel);
    };

    const attachPeerEvents = (peer) => {
      peer.on('connection', (conn) => setupConnRef.current(conn));
      peer.on('call', (call) => {
        if (localStreamRef.current) {
          call.answer(localStreamRef.current);
        } else {
          call.answer();
        }
        call.on('stream', (remoteStream) => {
          const fromId = call.peer;
          remoteStreamsRef.current[fromId] = remoteStream;
          setRemoteStreamsState(prev => ({ ...prev, [fromId]: remoteStream }));
          mediaCallsRef.current[fromId] = call;
          playRemoteStream(fromId, remoteStream);
        });
      });
    };

    const init = async () => {
      await loadLocalMessages();

      const server = await getServer(serverCode);
      if (server?.channels?.length) {
        setChannels(server.channels);
      }

      const clientId = `${serverCode.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
      const peer = new Peer(clientId);
      peerRef.current = peer;

      peer.on('open', (id) => {
        if (!active) return;
        console.log('[room] peer open', id);
        setPeerId(id);

        const conn = peer.connect(hostPeerId);
        let joined = false;

        conn.on('open', () => {
          if (!active) return;
          joined = true;
          console.log('[room] connected to host as client');
          setupConnRef.current(conn);
          conn.send({ type: 'history-request' });
        });

        conn.on('error', () => {
          if (!active || joined) return;
          console.log('[room] host unreachable, becoming host');
          promoteToHost();
        });

        setTimeout(() => {
          if (!active || joined) return;
          console.log('[room] host timeout, becoming host');
          promoteToHost();
        }, 3000);
      });

      attachPeerEvents(peer);

      peer.on('error', (err) => {
        if (active && err.type !== 'peer-unavailable') {
          console.log('[room] peer error', err.type, err.message);
        }
      });
    };

    const promoteToHost = () => {
      if (!active) return;
      const oldPeer = peerRef.current;
      if (oldPeer) oldPeer.destroy();

      const hostPeer = new Peer(hostPeerId);
      peerRef.current = hostPeer;
      isHostRef.current = true;

      hostPeer.on('open', (id) => {
        if (!active) return;
        console.log('[room] promoted to host', id);
        setPeerId(id);
      });

      attachPeerEvents(hostPeer);

      hostPeer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          console.log('[room] host ID still taken, retrying in 2s');
          setTimeout(() => {
            if (active) promoteToHost();
          }, 2000);
        } else if (active && err.type !== 'peer-unavailable') {
          console.log('[room] host peer error', err.type);
        }
      });
    };

    init();

    return () => {
      active = false;
      Object.values(mediaCallsRef.current).forEach(c => c.close());
      mediaCallsRef.current = {};
      Object.keys(remoteStreamsRef.current).forEach(id => {
        const audio = document.getElementById(`remote-audio-${id}`);
        if (audio) audio.remove();
      });
      remoteStreamsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      Object.values(connsRef.current).forEach(c => c.close());
      connsRef.current = {};
      if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    };
  }, [serverCode, identity]);

  const sendMessage = useCallback(async (channelId, text, attachment = null) => {
    if (!text.trim() && !attachment && !identity) return;
    const msg = {
      id: `${peerRef.current?.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channelId,
      serverId: serverCode,
      senderId: peerRef.current?.id,
      senderName: identity.username,
      senderColor: identity.color,
      text: text ? text.trim() : '',
      attachment,
      timestamp: Date.now(),
    };
    await saveMessage(msg);
    addMessage(msg);
    const wireMsg = { ...msg };
    delete wireMsg.serverId;
    broadcastData({ type: 'chat-message', message: wireMsg });
  }, [identity, serverCode, broadcastData, addMessage]);

  const loadChannel = useCallback(async (channelId) => {
    activeChannelRef.current = channelId;
    setUnread(prev => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    const local = await getMessagesByChannel(serverCode, channelId, 100);
    setMessages(prev => {
      const existing = prev[channelId] || [];
      const ids = new Set(existing.map(m => m.id));
      const merged = [...existing];
      local.forEach(m => { if (!ids.has(m.id)) merged.push(m); });
      merged.sort((a, b) => a.timestamp - b.timestamp);
      return { ...prev, [channelId]: merged };
    });
  }, [serverCode]);

  const broadcastMediaState = useCallback((stateUpdates) => {
    setMediaStates(prev => {
      const pid = peerRef.current?.id;
      if (!pid) return prev;
      const next = { ...prev, [pid]: { ...(prev[pid] || {}), ...stateUpdates } };
      broadcastData({ type: 'media-state', peerId: pid, state: next[pid] });
      return next;
    });
  }, [broadcastData]);

  const joinVoice = useCallback(async (channelId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!audioEnabled) {
        stream.getAudioTracks().forEach(t => t.enabled = false);
      }
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      myVoiceChannelRef.current = channelId;

      setVoiceMembers(prev => {
        const members = prev[channelId] || [];
        if (members.find(m => m.id === peerRef.current?.id)) return prev;
        return {
          ...prev,
          [channelId]: [...members, { id: peerRef.current?.id, name: identity.username, color: identity.color }]
        };
      });

      broadcastData({
        type: 'voice-join',
        channelId,
        name: identity.username,
        color: identity.color,
      });

      const voiceInChannel = (voiceMembersRef.current[channelId] || []).map(m => m.id).filter(id => id !== peerRef.current?.id);
      voiceInChannel.forEach(id => startMediaWith(id));

      broadcastMediaState({ camera: false, screen: false, muted: !audioEnabled, deafened: false });
    } catch (e) {
      setError('Microphone access denied');
    }
  }, [identity, broadcastData, startMediaWith, broadcastMediaState, audioEnabled]);

  const switchMedia = useCallback(async ({ camera, screen, audioDeviceId, videoDeviceId }) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      let stream;
      
      const audioConstraints = audioDeviceId && audioDeviceId !== 'default' ? { deviceId: { exact: audioDeviceId } } : true;
      const videoConstraints = videoDeviceId && videoDeviceId !== 'default' ? { deviceId: { exact: videoDeviceId } } : true;

      if (screen) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks()[0].onended = () => {
           switchMedia({ camera: mediaStates[peerRef.current?.id]?.camera, screen: false, audioDeviceId, videoDeviceId });
        };
      } else if (camera) {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      }

      const currentIsMuted = mediaStates[peerRef.current?.id]?.muted;
      if (currentIsMuted) {
        stream.getAudioTracks().forEach(t => t.enabled = false);
      }

      localStreamRef.current = stream;
      setLocalStreamState(stream);

      const ch = myVoiceChannelRef.current;
      if (ch) {
         Object.keys(mediaCallsRef.current).forEach(id => stopMediaWith(id));
         const voiceInChannel = (voiceMembersRef.current[ch] || []).map(m => m.id).filter(id => id !== peerRef.current?.id);
         voiceInChannel.forEach(id => startMediaWith(id));
      }

      broadcastMediaState({ camera, screen, muted: !!currentIsMuted });
    } catch (e) {
      setError('Media access denied');
    }
  }, [mediaStates, broadcastMediaState, stopMediaWith, startMediaWith]);

  const leaveVoice = useCallback(() => {
    const ch = myVoiceChannelRef.current;
    if (!ch) return;

    broadcastData({ type: 'voice-leave', channelId: ch });

    Object.keys(mediaCallsRef.current).forEach(id => stopMediaWith(id));

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStreamState(null);
    }

    setVoiceMembers(prev => {
      const members = (prev[ch] || []).filter(m => m.id !== peerRef.current?.id);
      return { ...prev, [ch]: members };
    });

    myVoiceChannelRef.current = null;
  }, [broadcastData, stopMediaWith]);

  const toggleMute = useCallback(() => {
    let nextState;
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        nextState = track.enabled;
        broadcastMediaState({ muted: !nextState });
      } else {
        nextState = !audioEnabled;
      }
    } else {
      nextState = !audioEnabled;
    }
    setAudioEnabled(nextState);
    return nextState;
  }, [audioEnabled, broadcastMediaState]);

  const toggleDeafen = useCallback(() => {
    const nextDeaf = !audioDeafened;
    Object.keys(remoteStreamsRef.current).forEach(id => {
      const audio = document.getElementById(`remote-audio-${id}`);
      if (audio) audio.muted = nextDeaf;
    });
    setAudioDeafened(nextDeaf);
    broadcastMediaState({ deafened: nextDeaf });
    if (nextDeaf && audioEnabled) {
      toggleMute();
    }
    return nextDeaf;
  }, [audioDeafened, audioEnabled, toggleMute, broadcastMediaState]);

  const createChannel = useCallback(async (name, type) => {
    const id = `${type}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`;
    const channel = { id, name, type };
    setChannels(prev => {
      const next = [...prev, channel];
      persistChannels(next);
      return next;
    });
    broadcastData({ type: 'channel-create', channel });
  }, [broadcastData, persistChannels]);

  return {
    peerId,
    peers,
    messages,
    channels,
    voiceMembers,
    unread,
    myVoiceChannel: myVoiceChannelRef.current,
    localStream: localStreamState,
    remoteStreams: remoteStreamsState,
    mediaStates,
    error,
    audioEnabled,
    audioDeafened,
    sendMessage,
    loadChannel,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    switchMedia,
    createChannel,
  };
}

export { useRoom };
