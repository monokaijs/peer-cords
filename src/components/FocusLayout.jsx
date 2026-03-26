import React, { useMemo } from 'react';
import ParticipantTile from './ParticipantTile';

export default function FocusLayout({ participants }) {
  // Find the first screen share to focus on
  const focusTile = useMemo(() => {
    for (const p of participants) {
      if (p.screenStream) {
        return { ...p, type: 'screen', stream: p.screenStream };
      }
    }
    return null; // fallback
  }, [participants]);

  // The rest of the tiles (cameras of everyone, including the screen sharer)
  const otherTiles = useMemo(() => {
    const list = [];
    participants.forEach(p => {
      // Main camera tile
      list.push({ ...p, type: 'main' });
      // If there are MULTIPLE screen shares, only one is focus, others go to the side
      if (p.screenStream && focusTile && p.id !== focusTile.id) {
         list.push({ ...p, type: 'screen', stream: p.screenStream });
      }
    });
    return list;
  }, [participants, focusTile]);

  return (
    <div className="focus-layout-container">
      <div className="focus-main">
        {focusTile && <ParticipantTile participant={focusTile} />}
      </div>
      <div className="focus-sidebar">
        {otherTiles.map((tile, i) => (
          <div key={`${tile.id}-${tile.type}`} className="sidebar-tile-wrapper">
             <ParticipantTile participant={tile} />
          </div>
        ))}
      </div>
    </div>
  );
}
