import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ParticipantTile from './ParticipantTile';

const GRID_LAYOUTS = [
  { columns: 1, rows: 1 },
  { columns: 1, rows: 2, orientation: 'portrait' },
  { columns: 2, rows: 1, orientation: 'landscape' },
  { columns: 2, rows: 2, minWidth: 560 },
  { columns: 3, rows: 3, minWidth: 700 },
  { columns: 4, rows: 4, minWidth: 960 },
  { columns: 5, rows: 5, minWidth: 1100 },
];

function expandLayouts(defs) {
  return [...defs]
    .map(d => ({
      columns: d.columns,
      rows: d.rows,
      maxTiles: d.columns * d.rows,
      minWidth: d.minWidth ?? 0,
      minHeight: d.minHeight ?? 0,
      orientation: d.orientation,
    }))
    .sort((a, b) => {
      if (a.maxTiles !== b.maxTiles) return a.maxTiles - b.maxTiles;
      if (a.minWidth !== 0 || b.minWidth !== 0) return a.minWidth - b.minWidth;
      if (a.minHeight !== 0 || b.minHeight !== 0) return a.minHeight - b.minHeight;
      return 0;
    });
}

function selectLayout(layouts, count, width, height) {
  if (width <= 0 || height <= 0) return layouts[0];
  const orientation = width / height > 1 ? 'landscape' : 'portrait';

  let idx = 0;
  let layout = layouts.find((l, i, all) => {
    idx = i;
    const biggerExists = all.findIndex((b, bi) => {
      const fits = !b.orientation || b.orientation === orientation;
      return bi > i && b.maxTiles === l.maxTiles && fits;
    }) !== -1;
    return l.maxTiles >= count && !biggerExists;
  });

  if (!layout) layout = layouts[layouts.length - 1];

  if (width < layout.minWidth || height < layout.minHeight) {
    if (idx > 0) {
      const smaller = layouts[idx - 1];
      return selectLayout(layouts.slice(0, idx), smaller.maxTiles, width, height);
    }
  }
  return layout;
}

const ALL_LAYOUTS = expandLayouts(GRID_LAYOUTS);

export default function GridLayout({ participants }) {
  const gridRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const updateSize = useCallback(() => {
    if (gridRef.current) {
      const { width, height } = gridRef.current.getBoundingClientRect();
      setSize(prev => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    }
  }, []);

  useEffect(() => {
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [updateSize]);

  const tiles = useMemo(() => {
    const list = [];
    participants.forEach(p => {
      list.push({ ...p, type: 'main' });
      if (p.screenStream) {
        list.push({ ...p, type: 'screen', stream: p.screenStream });
      }
    });
    return list;
  }, [participants]);

  const layout = useMemo(
    () => selectLayout(ALL_LAYOUTS, tiles.length, size.width, size.height),
    [tiles.length, size.width, size.height],
  );

  return (
    <div className="grid-container" ref={gridRef}>
      <div
        className="lk-grid"
        style={{
          '--lk-col-count': layout.columns,
          '--lk-row-count': layout.rows,
        }}
      >
        {tiles.map(tile => (
          <ParticipantTile key={`${tile.id}-${tile.type}`} participant={tile} />
        ))}
      </div>
    </div>
  );
}
