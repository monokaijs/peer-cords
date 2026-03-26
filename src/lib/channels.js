export const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', type: 'text' },
  { id: 'random', name: 'random', type: 'text' },
  { id: 'voice-general', name: 'General', type: 'voice' },
];

export function textChannels(channels) {
  return channels.filter(c => c.type === 'text');
}

export function voiceChannels(channels) {
  return channels.filter(c => c.type === 'voice');
}

export function peerIdForChannel(channelId) {
  return `p2p-ch-${channelId}`;
}
