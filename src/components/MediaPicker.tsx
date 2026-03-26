import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Smile, Film } from 'lucide-react';
import { searchGifs } from '../lib/api';

const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','👍','👎','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'
];

export default function MediaPicker({ onSelectEmoji, onSelectGiphy, onClose }) {
  const [tab, setTab] = useState('emoji'); // 'emoji' or 'gif'
  
  // Giphy state
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchGifs = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await searchGifs(q);
      setGifs(res);
    } catch (e) {
      setGifs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'gif') {
      fetchGifs(query);
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'gif') {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchGifs(query), 300);
      return () => clearTimeout(debounceRef.current);
    }
  }, [query, tab]);

  return (
    <div className="picker-panel media-picker">
      <div className="picker-tabs">
        <button 
          className={`picker-tab ${tab === 'emoji' ? 'active' : ''}`}
          onClick={() => setTab('emoji')}
        >
          <Smile size={16} /> Emojis
        </button>
        <button 
          className={`picker-tab ${tab === 'gif' ? 'active' : ''}`}
          onClick={() => setTab('gif')}
        >
          <Film size={16} /> GIFs
        </button>
      </div>

      <div className="picker-header">
        <div className="picker-search">
          <Search size={16} />
          {tab === 'gif' ? (
            <input
              ref={inputRef}
              placeholder="Search Tenor..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          ) : (
            <input
              placeholder="Search emojis..."
              disabled
              title="Emoji search not implemented in this demo"
            />
          )}
          {tab === 'gif' && query && (
            <button className="picker-clear" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {tab === 'emoji' ? (
        <div className="picker-grid emoji-grid">
          {EMOJI_LIST.map((emoji, i) => (
            <button
              key={i}
              className="emoji-item"
              onClick={() => onSelectEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <div className="picker-grid giphy-grid">
          {loading && gifs.length === 0 && (
            <div className="picker-loading">Loading...</div>
          )}
          {gifs.map(gif => (
            <button
              key={gif.id}
              className="giphy-item"
              onClick={() => onSelectGiphy(gif)}
              title={gif.title}
            >
              <img src={gif.preview} alt={gif.title} loading="lazy" />
            </button>
          ))}
          {!loading && gifs.length === 0 && (
            <div className="picker-empty">No GIFs found</div>
          )}
        </div>
      )}
    </div>
  );
}
