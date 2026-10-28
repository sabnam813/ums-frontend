import React from 'react';

export default function StickyScrollTrack({ trackRef, trackStyle }) {
  return (
    <div
      className="dt-scroll-track"
      ref={trackRef}
      style={{ left: trackStyle.left, width: trackStyle.width, display: trackStyle.display }}
    >
      <div className="dt-scroll-track-inner" />
    </div>
  );
}
