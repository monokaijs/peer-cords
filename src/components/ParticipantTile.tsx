import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MonitorUp } from 'lucide-react';

export default function ParticipantTile({ participant }) {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(e => console.warn('Could not auto-play video', e));
      
      const checkTracks = () => {
        const videoTracks = participant.stream.getVideoTracks();
        setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
        
        const audioTracks = participant.stream.getAudioTracks();
        setIsMuted(audioTracks.length === 0 || !audioTracks[0].enabled);
      };
      
      checkTracks();
      const id = setInterval(checkTracks, 1000);
      return () => clearInterval(id);
    }
  }, [participant.stream]);

  useEffect(() => {
    if (!participant.stream) return;
    if (participant.stream.getAudioTracks().length === 0) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = audioCtxRef.current;
      const analyzer = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(participant.stream);

      microphone.connect(analyzer);
      analyzer.smoothingTimeConstant = 0.8;
      analyzer.fftSize = 256;
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      let animationId;
      const checkAudioLevel = () => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setSpeaking(average > 15);
        animationId = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();

      return () => {
        cancelAnimationFrame(animationId);
        microphone.disconnect();
      };
    } catch (e) {
    }
  }, [participant.stream]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`participant-tile ${speaking ? 'speaking' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal && participant.type !== 'screen'}
        className="video-element"
        style={{ display: hasVideo ? 'block' : 'none' }}
      />
      {!hasVideo && (
        <div className="audio-only-avatar">
          {participant.id ? participant.id.charAt(0).toUpperCase() : '?'}
        </div>
      )}
      <div className="participant-info">
        {participant.type === 'screen' && <MonitorUp size={14} />}
        {participant.isLocal ? 'You' : participant.id}
        {participant.type === 'screen' ? '' : (isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} />)}
      </div>
    </div>
  );
}
