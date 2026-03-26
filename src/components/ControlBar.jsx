import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from 'lucide-react';

export default function ControlBar({ onLeave, toggleAudio, toggleVideo, startScreenShare, stopScreenShare }) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const handleMic = () => {
    setAudioEnabled(toggleAudio());
  };

  const handleVideo = () => {
    setVideoEnabled(toggleVideo());
  };

  const handleScreenShare = async () => {
    if (screenSharing) {
      stopScreenShare();
      setScreenSharing(false);
    } else {
      try {
        await startScreenShare();
        setScreenSharing(true);
      } catch (e) {
        // User cancelled or error
      }
    }
  };

  return (
    <div className="control-bar">
      <button 
        className={`control-btn ${!audioEnabled ? 'danger' : ''}`} 
        onClick={handleMic}
        title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
      >
        {audioEnabled ? <Mic /> : <MicOff />}
      </button>

      <button 
        className={`control-btn ${!videoEnabled ? 'danger' : ''}`} 
        onClick={handleVideo}
        title={videoEnabled ? "Turn off Camera" : "Turn on Camera"}
      >
        {videoEnabled ? <Video /> : <VideoOff />}
      </button>

      <button 
        className={`control-btn ${screenSharing ? 'active' : ''}`} 
        onClick={handleScreenShare}
        title={screenSharing ? "Stop sharing screen" : "Share screen"}
      >
        <MonitorUp />
      </button>

      <button 
        className="control-btn danger" 
        onClick={onLeave}
        title="Leave Room"
      >
        <PhoneOff />
      </button>
    </div>
  );
}
