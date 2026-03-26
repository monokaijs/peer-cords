import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, ChevronDown } from 'lucide-react';

function useSpeakingDetector(streams) {
  const [speaking, setSpeaking] = useState({});
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    const analysers = {};
    const ids = Object.keys(streams);

    ids.forEach(id => {
      const stream = streams[id];
      if (!stream || !stream.getAudioTracks().length) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysers[id] = analyser;
      } catch (e) {}
    });

    if (!Object.keys(analysers).length) return;

    let raf;
    const data = new Uint8Array(128);
    const check = () => {
      const next = {};
      Object.entries(analysers).forEach(([id, an]) => {
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        next[id] = sum / data.length > 15;
      });
      setSpeaking(next);
      raf = requestAnimationFrame(check);
    };
    check();

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [Object.keys(streams).join(',')]);

  return speaking;
}

export default function VoiceGrid({
  members,
  localStream,
  remoteStreams,
  myPeerId,
  mediaStates,
  switchMedia,
  toggleMute,
  onDisconnectVoice,
  focusedId,
  onFocus,
}) {
  const speaking = useSpeakingDetector(remoteStreams);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [devices, setDevices] = useState([]);
  const [audioDeviceId, setAudioDeviceId] = useState('default');
  const [videoDeviceId, setVideoDeviceId] = useState('default');
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const ctxRef = useRef(null);

  const localState = mediaStates[myPeerId] || {};

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(d => setDevices(d));
  }, []);

  useEffect(() => {
    if (!localStream) return;
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    let source;
    try {
      source = ctx.createMediaStreamSource(localStream);
    } catch(e) {
      return; 
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(128);
    let raf;
    const check = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLocalSpeaking(sum / data.length > 15);
      raf = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(raf);
  }, [localStream]);

  // Auto-focus the first screen sharer if nobody is currently focused
  useEffect(() => {
    const sharer = members.find(m => mediaStates[m.id]?.screen);
    if (sharer && !focusedId) {
      onFocus(sharer.id);
    } else if (!sharer && focusedId && mediaStates[focusedId] && !mediaStates[focusedId].screen && !mediaStates[focusedId].camera) {
      // Auto-unfocus if they stop sharing anything
      onFocus(null);
    }
  }, [mediaStates, members, focusedId, onFocus]);

  const focusedMember = focusedId ? members.find(m => m.id === focusedId) : null;
  const focusedStream = focusedId ? (focusedId === myPeerId ? localStream : remoteStreams[focusedId]) : null;

  const audioIn = devices.filter(d => d.kind === 'audioinput');
  const videoIn = devices.filter(d => d.kind === 'videoinput');

  const handleDeviceChange = (kind, id) => {
    if (kind === 'audio') {
      setAudioDeviceId(id);
      switchMedia({ camera: localState.camera, screen: localState.screen, audioDeviceId: id, videoDeviceId });
    } else {
      setVideoDeviceId(id);
      switchMedia({ camera: localState.camera, screen: localState.screen, audioDeviceId, videoDeviceId: id });
    }
    setShowDeviceMenu(false);
  };

  return (
    <div className="voice-grid-wrapper">
      {focusedId && (
        <div className="voice-focused" onClick={() => onFocus(null)}>
          <FocusedView member={focusedMember} stream={focusedStream} mediaState={mediaStates[focusedId]} />
        </div>
      )}
      <div className={`voice-grid ${focusedId ? 'has-focus' : ''}`}>
        {members.map(m => {
          const isSelf = m.id === myPeerId;
          const isSpeaking = isSelf ? localSpeaking : speaking[m.id];
          const state = mediaStates[m.id] || {};

          return (
            <div
              key={m.id}
              className={`voice-tile ${isSpeaking ? 'speaking' : ''} ${focusedId === m.id ? 'focused' : ''}`}
              onClick={() => onFocus(focusedId === m.id ? null : m.id)}
            >
              {(state.camera || state.screen) && (isSelf ? localStream : remoteStreams[m.id]) ? (
                 <video 
                   autoPlay 
                   playsInline 
                   muted={isSelf} 
                   className="voice-tile-video" 
                   ref={v => { if (v) v.srcObject = isSelf ? localStream : remoteStreams[m.id] }}
                 />
              ) : (
                <div className="voice-tile-avatar" style={{ background: m.color || '#5865f2' }}>
                  {(m.name || '?')[0].toUpperCase()}
                </div>
              )}
              
              <div className="voice-tile-info">
                <span className="voice-tile-name">{m.name || m.id}</span>
                {isSelf && <span className="voice-tile-you">(you)</span>}
              </div>
              {(state.camera || state.screen || state.muted) && (
                <div className="voice-tile-badges">
                  {state.camera && <Video size={14} />}
                  {state.screen && <MonitorUp size={14} />}
                  {state.muted && <MicOff size={14} className="muted-icon" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="voice-controls-bar">
        
        <div className="control-block">
          <div className="control-pair">
            <button 
              className="control-btn main-action" 
              onClick={toggleMute}
              title={localState.muted ? "Turn on Microphone" : "Turn off Microphone"}
            >
              {localState.muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button 
              className="control-btn dropdown-action" 
              onClick={() => setShowDeviceMenu(showDeviceMenu === 'audio' ? null : 'audio')}
            >
              <ChevronDown size={14} />
            </button>
            
            {showDeviceMenu === 'audio' && (
              <div className="device-menu server-dropdown" style={{ bottom: 'calc(100% + 12px)', top: 'auto', left: '0', width: '200px' }}>
                <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Microphone Input</div>
                {audioIn.length ? audioIn.map(d => (
                  <button key={d.deviceId} onClick={() => handleDeviceChange('audio', d.deviceId)} className={audioDeviceId === d.deviceId ? 'active' : ''}>
                    {d.label || `Mic ${d.deviceId.slice(0, 5)}`}
                  </button>
                )) : <div style={{ padding: '8px', fontSize: '12px' }}>No microphones found</div>}
              </div>
            )}
          </div>

          <div className="control-pair">
            <button 
              className={`control-btn main-action ${localState.camera ? 'active' : ''}`} 
              onClick={() => switchMedia({ camera: !localState.camera, screen: false, audioDeviceId, videoDeviceId })}
              title={localState.camera ? "Turn off Camera" : "Turn on Camera"}
            >
              {localState.camera ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button 
              className="control-btn dropdown-action" 
              onClick={() => setShowDeviceMenu(showDeviceMenu === 'video' ? null : 'video')}
            >
              <ChevronDown size={14} />
            </button>
            
            {showDeviceMenu === 'video' && (
              <div className="device-menu server-dropdown" style={{ bottom: 'calc(100% + 12px)', top: 'auto', left: '0', width: '200px' }}>
                <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Camera Input</div>
                {videoIn.length ? videoIn.map(d => (
                  <button key={d.deviceId} onClick={() => handleDeviceChange('video', d.deviceId)} className={videoDeviceId === d.deviceId ? 'active' : ''}>
                    {d.label || `Cam ${d.deviceId.slice(0, 5)}`}
                  </button>
                )) : <div style={{ padding: '8px', fontSize: '12px' }}>No cameras found</div>}
              </div>
            )}
          </div>
        </div>

        <div className="control-block">
          <button 
            className={`control-btn screen-share ${localState.screen ? 'active' : ''}`} 
            onClick={() => switchMedia({ camera: false, screen: !localState.screen, audioDeviceId, videoDeviceId })}
            title={localState.screen ? "Stop Sharing" : "Share Screen"}
          >
            <MonitorUp size={20} />
          </button>
        </div>

        <div className="control-block disconnect-block">
          <button 
            className="control-btn danger-btn disconnect" 
            onClick={onDisconnectVoice}
            title="Disconnect"
          >
            <PhoneOff size={24} />
          </button>
        </div>

      </div>
    </div>
  );
}

function FocusedView({ member, stream, mediaState }) {
  if (!member) return null;

  const hasVideo = mediaState?.camera || mediaState?.screen;

  return (
    <div className="focused-content">
      {hasVideo && stream ? (
        <video 
          ref={v => { if (v && v.srcObject !== stream) v.srcObject = stream; }} 
          autoPlay 
          playsInline 
          muted 
          className="focused-video" 
        />
      ) : (
        <div className="focused-avatar" style={{ background: member.color || '#5865f2' }}>
          {(member.name || '?')[0].toUpperCase()}
        </div>
      )}
      <div className="focused-label">{member.name}</div>
    </div>
  );
}
