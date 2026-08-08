/**
 * AmbientBackground – intense center-hot glow orbs, fading outward.
 * Gradient strategy: white-hot core → full saturated color → transparent edge
 * Capacitor Android WebView fix:
 *  - Only transform (translate + scale) is animated
 *  - Fixed per-orb opacity, never animated
 */
const AmbientBackground = () => (
  <>
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 0,
      overflow: 'hidden', pointerEvents: 'none',
    }}>
      <div className="amb-orb amb-orb-1" />
      <div className="amb-orb amb-orb-2" />
      <div className="amb-orb amb-orb-3" />
      <div className="amb-orb amb-orb-4" />
      <div className="amb-orb amb-orb-5" />
    </div>
    <style>{`
      .amb-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(30px);
        will-change: transform;
      }

      /* Cyan — top left */
      .amb-orb-1 {
        opacity: 1.0;
        width: 800px; height: 800px;
        top: -200px; left: -160px;
        background: radial-gradient(circle,
          rgba(255,255,255,0.95)  0%,
          rgba(0,240,255,1.00)    8%,
          rgba(0,220,255,0.80)   22%,
          rgba(0,180,255,0.45)   45%,
          rgba(0,150,255,0.15)   65%,
          transparent            80%
        );
        animation: ambFloat1 9s ease-in-out infinite both;
      }

      /* Violet — top right */
      .amb-orb-2 {
        opacity: 1.0;
        width: 680px; height: 680px;
        top: 18%; right: -160px;
        background: radial-gradient(circle,
          rgba(255,255,255,0.90)  0%,
          rgba(210,0,255,1.00)    8%,
          rgba(180,0,240,0.78)   22%,
          rgba(140,0,200,0.42)   45%,
          rgba(100,0,160,0.12)   65%,
          transparent            80%
        );
        animation: ambFloat2 11s ease-in-out infinite both;
      }

      /* Blue — bottom left */
      .amb-orb-3 {
        opacity: 1.0;
        width: 620px; height: 620px;
        bottom: -40px; left: -80px;
        background: radial-gradient(circle,
          rgba(255,255,255,0.90)  0%,
          rgba(0,140,255,1.00)    8%,
          rgba(0,110,240,0.76)   22%,
          rgba(0,80,210,0.40)    45%,
          rgba(0,50,180,0.12)    65%,
          transparent            80%
        );
        animation: ambFloat3 13s ease-in-out infinite both;
      }

      /* Emerald — center */
      .amb-orb-4 {
        opacity: 0.95;
        width: 540px; height: 540px;
        top: 42%; left: 18%;
        background: radial-gradient(circle,
          rgba(255,255,255,0.85)  0%,
          rgba(0,255,136,0.95)    8%,
          rgba(0,230,110,0.70)   22%,
          rgba(0,200,80,0.35)    45%,
          rgba(0,160,60,0.10)    65%,
          transparent            80%
        );
        animation: ambFloat4 8s ease-in-out infinite both;
      }

      /* Rose — bottom right */
      .amb-orb-5 {
        opacity: 1.0;
        width: 480px; height: 480px;
        bottom: 8%; right: -70px;
        background: radial-gradient(circle,
          rgba(255,255,255,0.90)  0%,
          rgba(255,50,130,1.00)   8%,
          rgba(240,0,100,0.76)   22%,
          rgba(200,0,80,0.40)    45%,
          rgba(160,0,60,0.12)    65%,
          transparent            80%
        );
        animation: ambFloat1 10s ease-in-out infinite reverse both;
      }

      @keyframes ambFloat1 {
        0%   { transform: translate(0px, 0px) scale(1); }
        33%  { transform: translate(160px, 120px) scale(1.14); }
        66%  { transform: translate(-100px, 60px) scale(0.90); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
      @keyframes ambFloat2 {
        0%   { transform: translate(0px, 0px) scale(1); }
        33%  { transform: translate(-180px, 100px) scale(1.16); }
        66%  { transform: translate(110px, -80px) scale(0.88); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
      @keyframes ambFloat3 {
        0%   { transform: translate(0px, 0px) scale(0.95); }
        33%  { transform: translate(130px, -150px) scale(1.12); }
        66%  { transform: translate(-80px, -50px) scale(1.06); }
        100% { transform: translate(0px, 0px) scale(0.95); }
      }
      @keyframes ambFloat4 {
        0%   { transform: translate(0px, 0px) scale(1); }
        33%  { transform: translate(-120px, -160px) scale(1.10); }
        66%  { transform: translate(140px, 50px) scale(0.86); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
    `}</style>
  </>
);

export default AmbientBackground;
