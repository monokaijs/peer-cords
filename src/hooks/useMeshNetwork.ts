import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

export function useMeshNetwork(initialHostCode) {
  const [peerId, setPeerId] = useState(null);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState({}); // { id: { id, stream, screenStream, isLocal } }
  
  const peerRef = useRef(null);
  const peersMap = useRef({}); // { [id]: { conn, mediaCall, screenCall } }
  const localStreamRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const startLocalMediaRef = useRef(null);

  const startLocalMedia = async (screenShare = false) => {
    try {
      if (screenShare) {
        if (localScreenStreamRef.current) return localScreenStreamRef.current;
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        localScreenStreamRef.current = stream;
        
        Object.keys(peersMap.current).forEach(id => {
          if (id === peerRef.current?.id) return;
          const call = peerRef.current.call(id, stream, { metadata: { type: 'screen' } });
          setupCall(call);
        });
        
        setParticipants(prev => {
          const myId = peerRef.current?.id;
          if (!myId) return prev;
          return {
            ...prev,
            [myId]: { ...prev[myId], screenStream: stream }
          };
        });
        
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
        
        return stream;
      } else {
        if (localStreamRef.current) return localStreamRef.current;
        
        let stream;
        try {
          // Attempt both audio and video first
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (mediaErr) {
          console.warn('Could not get video+audio, trying audio only...', mediaErr);
          // Fallback to audio only if they don't have a camera or denied camera
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        
        localStreamRef.current = stream;
        
        setParticipants(prev => {
          const myId = peerRef.current?.id;
          if (!myId) return prev;
          return {
            ...prev,
            [myId]: { ...prev[myId], stream, isLocal: true, id: myId }
          };
        });
        return stream;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
  startLocalMediaRef.current = startLocalMedia;

  const stopScreenShare = useCallback(() => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(t => t.stop());
      localScreenStreamRef.current = null;
      
      setParticipants(prev => {
        const myId = peerRef.current?.id;
        if (!myId) return prev;
        return {
          ...prev,
          [myId]: { ...prev[myId], screenStream: null }
        };
      });
      
      Object.values(peersMap.current).forEach(p => {
        if (p.screenCall) {
          p.screenCall.close();
          p.screenCall = null;
        }
      });
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) track.enabled = !track.enabled;
      return track ? track.enabled : false;
    }
    return false;
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) track.enabled = !track.enabled;
      return track ? track.enabled : false;
    }
    return false;
  }, []);

  const disconnectPeer = (id) => {
    if (peersMap.current[id]) {
      if (peersMap.current[id].conn) peersMap.current[id].conn.close();
      if (peersMap.current[id].mediaCall) peersMap.current[id].mediaCall.close();
      if (peersMap.current[id].screenCall) peersMap.current[id].screenCall.close();
      delete peersMap.current[id];
    }
    setParticipants(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setupCall = (call) => {
    const isScreen = call.metadata?.type === 'screen';
    const id = call.peer;
    
    if (!peersMap.current[id]) peersMap.current[id] = {};
    if (isScreen) {
      peersMap.current[id].screenCall = call;
    } else {
      peersMap.current[id].mediaCall = call;
    }
    
    call.on('stream', (remoteStream) => {
      setParticipants(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          id,
          isLocal: false,
          [isScreen ? 'screenStream' : 'stream']: remoteStream
        }
      }));
    });
    
    call.on('close', () => {
      if (isScreen) {
        setParticipants(prev => {
            if (!prev[id]) return prev;
            return {
              ...prev,
              [id]: { ...prev[id], screenStream: null }
            };
        });
      } else {
        disconnectPeer(id);
      }
    });

    call.on('error', () => {
      if (!isScreen) disconnectPeer(id);
    });
  };

  const broadcastPeers = () => {
    const myId = peerRef.current?.id;
    const allKnown = Object.keys(peersMap.current);
    const fullList = myId ? [myId, ...allKnown] : allKnown;
    const openPeers = allKnown.filter(id => peersMap.current[id].conn && peersMap.current[id].conn.open);
    openPeers.forEach(id => {
      peersMap.current[id].conn.send({ type: 'peers', peers: fullList });
    });
  };

  const setupDataConnection = (conn) => {
    const id = conn.peer;
    if (!peersMap.current[id]) peersMap.current[id] = {};
    peersMap.current[id].conn = conn;

    conn.on('open', () => {
      broadcastPeers();
    });

    conn.on('data', async (data) => {
      if (data.type === 'peers') {
        let madeNewConnection = false;
        try {
          const stream = await startLocalMediaRef.current(false);
          data.peers.forEach(pId => {
            if (!peersMap.current[pId] && pId !== peerRef.current?.id) {
              connectTo(pId, stream);
              madeNewConnection = true;
            }
          });
          if (madeNewConnection) {
            setTimeout(broadcastPeers, 1000);
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    conn.on('close', () => disconnectPeer(id));
    conn.on('error', () => disconnectPeer(id));
  };
  
  const connectTo = (targetId, stream) => {
    if (targetId === peerRef.current?.id) return;
    const existing = peersMap.current[targetId];
    if (existing?.conn?.open) return;
    if (existing) disconnectPeer(targetId);
    
    const conn = peerRef.current.connect(targetId);
    setupDataConnection(conn);
    
    const call = peerRef.current.call(targetId, stream);
    setupCall(call);
    
    if (localScreenStreamRef.current) {
        const screenCall = peerRef.current.call(targetId, localScreenStreamRef.current, { metadata: { type: 'screen' } });
        setupCall(screenCall);
    }
  };

  useEffect(() => {
    let active = true;
    
    const init = async () => {
      try {
        const stream = await startLocalMediaRef.current();
        if (!active) return;
        
        const newPeerId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const peer = new Peer(newPeerId);
        peerRef.current = peer;

        peer.on('open', (id) => {
          if (!active) return;
          setPeerId(id);
          setParticipants(prev => ({
            ...prev,
            [id]: { id, stream, isLocal: true, screenStream: localScreenStreamRef.current }
          }));
          
          if (initialHostCode && initialHostCode !== id) {
            connectTo(initialHostCode, stream);
          }
        });

        peer.on('connection', (conn) => {
          setupDataConnection(conn);
        });

        peer.on('call', async (call) => {
          setupCall(call);
          try {
            const media = await startLocalMediaRef.current();
            call.answer(media);
            if (localScreenStreamRef.current && call.metadata?.type !== 'screen') {
              const screenCall = peerRef.current.call(call.peer, localScreenStreamRef.current, { metadata: { type: 'screen' } });
              setupCall(screenCall);
            }
          } catch(e) {
            call.answer();
          }
        });

        peer.on('error', (err) => {
          console.error(err);
          if (active) setError('Network error');
        });

        peer.on('disconnected', () => {
          if (active) setError('Disconnected');
        });

      } catch (err) {
        if (active) setError('Could not access camera/microphone');
      }
    };
    
    init();

    return () => {
      active = false;
      Object.keys(peersMap.current).forEach(disconnectPeer);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(t => t.stop());
        localScreenStreamRef.current = null;
      }
      setParticipants({});
    };
  }, [initialHostCode]); // Removed startLocalMedia to prevent loop

  return {
    peerId,
    participants: Object.values(participants),
    error,
    toggleAudio,
    toggleVideo,
    startScreenShare: () => startLocalMedia(true),
    stopScreenShare
  };
}
