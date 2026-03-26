import React, { useState, useEffect } from 'react';
import { useMeshNetwork } from '../hooks/useMeshNetwork';
import GridLayout from './GridLayout';
import FocusLayout from './FocusLayout';
import ControlBar from './ControlBar';

export default function ConferenceUI({ channelId, identity, onLeave, onParticipantsChange }) {
  const {
    peerId,
    participants,
    error,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare
  } = useMeshNetwork(channelId);

  useEffect(() => {
    if (onParticipantsChange) {
      onParticipantsChange(participants);
    }
  }, [participants, onParticipantsChange]);

  const hasScreenShare = participants.some(p => p.screenStream);

  if (error) {
    return (
      <div className="conference-layout" style={{justifyContent: 'center', alignItems: 'center'}}>
        <h2 style={{color: '#ed4245'}}>{error}</h2>
        <button className="btn-primary" onClick={onLeave} style={{marginTop: '1rem', width: 'auto'}}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="conference-layout">
      {hasScreenShare ? (
        <FocusLayout participants={participants} />
      ) : (
        <GridLayout participants={participants} />
      )}
      <ControlBar
        onLeave={onLeave}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        startScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
      />
    </div>
  );
}
