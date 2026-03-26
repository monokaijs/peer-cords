import React from 'react';

export default function MemberList({ identity, peers }) {
  const allMembers = [
    { id: 'self', name: identity.username, color: identity.color, self: true },
    ...Object.entries(peers).map(([id, p]) => ({
      id,
      name: p.username || id,
      color: p.color || '#5865f2',
    })),
  ];

  return (
    <div className="member-list">
      <div className="member-section-title">Online — {allMembers.length}</div>
      {allMembers.map(m => (
        <div key={m.id} className="member-item">
          <div className="member-avatar" style={{ background: m.color }}>
            {m.name[0].toUpperCase()}
          </div>
          <span className="member-name">{m.name}</span>
          {m.self && <span className="member-you">you</span>}
        </div>
      ))}
    </div>
  );
}
