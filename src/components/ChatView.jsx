import React, { useState, useRef, useEffect } from 'react';
import { Hash, Send, PlusCircle, ImagePlus, Smile, File as FileIcon, Loader2 } from 'lucide-react';
import MediaPicker from './MediaPicker';
import { uploadToCatbox } from '../lib/api';

export default function ChatView({ channelId, channelName, messages, onSend }) {
  const [input, setInput] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    setInput('');
    setShowMedia(false);
  }, [channelId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !uploading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInput(prev => prev + emoji);
  };

  const handleGiphySelect = (gif) => {
    onSend('', { type: 'giphy', url: gif.url, title: gif.title, width: gif.width, height: gif.height });
    setShowMedia(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const url = await uploadToCatbox(file);
      const isImage = file.type.startsWith('image/');
      onSend(input, { type: 'file', url, name: file.name, isImage });
      setInput('');
    } catch (err) {
      console.error('Upload failed', err);
    }
    setUploading(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  let lastDate = null;
  let lastSender = null;

  return (
    <div className="chat-view">
      <div className="chat-header">
        <Hash size={20} />
        <h3>{channelName}</h3>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Hash size={42} />
            </div>
            <h2>Welcome to #{channelName}</h2>
            <p>This is the start of the #{channelName} channel.</p>
          </div>
        )}
        {messages.map((msg) => {
          const msgDate = formatDate(msg.timestamp);
          const showDate = msgDate !== lastDate;
          lastDate = msgDate;
          const grouped = msg.senderId === lastSender && !showDate;
          lastSender = msg.senderId;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="chat-date-divider">
                  <span>{msgDate}</span>
                </div>
              )}
              <div className={`chat-message ${grouped ? 'grouped' : ''}`}>
                {!grouped && (
                  <div className="msg-avatar" style={{ background: msg.senderColor || '#5865f2' }}>
                    {(msg.senderName || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className={`msg-content ${grouped ? 'grouped-content' : ''}`}>
                  {!grouped && (
                    <div className="msg-header">
                      <span className="msg-author" style={{ color: msg.senderColor }}>{msg.senderName}</span>
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  )}
                  {msg.text && <div className="msg-text">{msg.text}</div>}
                  {msg.attachment && msg.attachment.type === 'giphy' && (
                    <div className="msg-attachment giphy">
                      <img src={msg.attachment.url} alt={msg.attachment.title} style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px' }} />
                    </div>
                  )}
                  {msg.attachment && msg.attachment.type === 'file' && (
                    <div className="msg-attachment file">
                      {msg.attachment.isImage ? (
                        <a href={msg.attachment.url} target="_blank" rel="noreferrer">
                          <img src={msg.attachment.url} alt={msg.attachment.name} style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px' }} />
                        </a>
                      ) : (
                        <a href={msg.attachment.url} target="_blank" rel="noreferrer" className="msg-file-link">
                          <FileIcon size={24} />
                          <span>{msg.attachment.name}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          {showMedia && (
            <div className="chat-picker-wrapper media">
              <MediaPicker 
                onSelectEmoji={handleEmojiSelect} 
                onSelectGiphy={handleGiphySelect} 
                onClose={() => setShowMedia(false)} 
              />
            </div>
          )}
          {uploading && (
            <div className="chat-uploading-overlay">
              <Loader2 className="spinner" size={16} /> Uploading...
            </div>
          )}
          
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          
          <button className="chat-input-action" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <PlusCircle size={20} />
          </button>
          <input
            type="text"
            placeholder={`Message #${channelName}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="chat-input-actions">
            <button className="chat-input-action" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload File">
              <ImagePlus size={20} />
            </button>
            <button className="chat-input-action" type="button" onClick={() => setShowMedia(!showMedia)} title="Media">
              <Smile size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
