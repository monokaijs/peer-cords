import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import MemberList from './MemberList';
import VoiceGrid from './VoiceGrid';
import { useRoom } from '../hooks/useRoom';

export default function AppShell({ identity, serverCode, serverName, onUpdateServerName, onLeaveServer }) {
  const room = useRoom(serverCode, identity, serverName, onUpdateServerName);
  const [activeChannel, setActiveChannel] = useState('general');
  const [copied, setCopied] = useState(false);
  const [focusedId, setFocusedId] = useState(null);

  const channel = room.channels.find(c => c.id === activeChannel);

  useEffect(() => {
    if (channel?.type === 'text') {
      room.loadChannel(activeChannel);
    }
  }, [activeChannel]);

  const handleSelectChannel = useCallback((chId) => {
    const ch = room.channels.find(c => c.id === chId);
    setActiveChannel(chId);
    if (ch.type === 'voice') {
      if (room.myVoiceChannel !== chId) {
        if (room.myVoiceChannel) room.leaveVoice();
        room.joinVoice(chId);
      }
    }
  }, [room]);

  const handleDisconnectVoice = useCallback(() => {
    room.leaveVoice();
  }, [room]);

  const handleToggleAudio = useCallback(() => {
    room.toggleMute();
  }, [room]);

  const handleToggleDeafen = useCallback(() => {
    room.toggleDeafen();
  }, [room]);

  const copyCode = () => {
    navigator.clipboard.writeText(serverCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const channelMessages = room.messages[activeChannel] || [];
  const voiceMembers = room.voiceMembers[activeChannel] || [];

  return (
    <div className="app-shell">
      <Sidebar
        identity={identity}
        activeChannel={activeChannel}
        onSelectChannel={handleSelectChannel}
        voiceChannel={room.myVoiceChannel}
        voiceUsers={room.voiceMembers}
        onDisconnectVoice={handleDisconnectVoice}
        audioEnabled={room.audioEnabled}
        onToggleAudio={handleToggleAudio}
        audioDeafened={room.audioDeafened}
        onToggleDeafen={handleToggleDeafen}
        serverCode={serverCode}
        serverName={serverName}
        onUpdateServerName={(name) => {
          onUpdateServerName(name);
          room.broadcastServerName(name);
        }}
        onLeaveServer={onLeaveServer}
        channels={room.channels}
        unread={room.unread}
        onCreateChannel={room.createChannel}
        onCopyCode={copyCode}
        copied={copied}
        peerCount={Object.keys(room.peers).length}
      />
      <main className="main-content">
        {channel?.type === 'text' ? (
          <ChatView
            channelId={activeChannel}
            channelName={channel.name}
            messages={channelMessages}
            onSend={(text, attach) => room.sendMessage(activeChannel, text, attach)}
          />
        ) : channel?.type === 'voice' ? (
          <VoiceGrid
            members={voiceMembers}
            localStream={room.localStream}
            remoteStreams={room.remoteStreams}
            myPeerId={room.peerId}
            mediaStates={room.mediaStates}
            switchMedia={room.switchMedia}
            toggleMute={room.toggleMute}
            onDisconnectVoice={handleDisconnectVoice}
            focusedId={focusedId}
            onFocus={setFocusedId}
          />
        ) : (
          <div className="empty-state">
            <p>Select a channel</p>
          </div>
        )}
      </main>
      <MemberList identity={identity} peers={room.peers} />
    </div>
  );
}
