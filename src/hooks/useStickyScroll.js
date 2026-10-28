import { useRef, useEffect, useState } from 'react';

export default function useStickyScroll(deps = []) {
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const [trackStyle, setTrackStyle] = useState({ left: 0, width: 0, display: 'none' });

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return undefined;

    const syncTrackWidth = () => {
      const inner = track.firstChild;
      if (inner) inner.style.width = wrap.scrollWidth + 'px';
    };

    const syncTrackPosition = () => {
      const rect = wrap.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const needsScroll = wrap.scrollWidth > wrap.clientWidth + 1;
      const bottomVisible = rect.bottom <= viewportH && rect.top < viewportH;
      const tableOnScreen = rect.top < viewportH && rect.bottom > 0;
      setTrackStyle({
        left: rect.left,
        width: rect.width,
        display: needsScroll && tableOnScreen && !bottomVisible ? 'block' : 'none',
      });
    };

    syncTrackWidth();
    syncTrackPosition();

    const ro = new ResizeObserver(() => { syncTrackWidth(); syncTrackPosition(); });
    ro.observe(wrap);

    const mo = new MutationObserver(() => { syncTrackWidth(); syncTrackPosition(); });
    mo.observe(wrap, { childList: true, subtree: true, characterData: true });

    const onWrapScroll = () => { track.scrollLeft = wrap.scrollLeft; };
    const onTrackScroll = () => { wrap.scrollLeft = track.scrollLeft; };

    wrap.addEventListener('scroll', onWrapScroll, { passive: true });
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    window.addEventListener('scroll', syncTrackPosition, true);
    window.addEventListener('resize', syncTrackPosition);

    return () => {
      wrap.removeEventListener('scroll', onWrapScroll);
      track.removeEventListener('scroll', onTrackScroll);
      window.removeEventListener('scroll', syncTrackPosition, true);
      window.removeEventListener('resize', syncTrackPosition);
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { wrapRef, trackRef, trackStyle };
}
