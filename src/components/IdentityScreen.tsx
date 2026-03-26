import React, { useState } from 'react';

const COLORS = [
  '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
  '#3ba55c', '#faa61a', '#e67e22', '#9b59b6', '#1abc9c',
];

export default function IdentityScreen({ onComplete }) {
  const [username, setUsername] = useState('');
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    onComplete({ username: name, color });
  };

  return (
    <div className="identity-screen">
      <form className="identity-card" onSubmit={handleSubmit}>
        <h1>Welcome</h1>
        <p className="subtitle">Choose your identity to get started</p>
        <div className="input-block">
          <label>Display Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            maxLength={20}
          />
        </div>
        <div className="input-block">
          <label>Avatar Color</label>
          <div className="color-picker">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="avatar-preview" style={{ background: color }}>
          {username.trim() ? username.trim()[0].toUpperCase() : '?'}
        </div>
        <button type="submit" className="btn-primary" disabled={!username.trim()}>
          Continue
        </button>
      </form>
    </div>
  );
}
