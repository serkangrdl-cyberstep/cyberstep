import { useEffect, useRef } from "react";

interface StepAiSelfieProps {
  domain?: string;
  scanDate?: string;
}

const CSS = `
.sas-wrap {
  position: relative;
  width: 480px;
  height: 620px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Segoe UI', Arial, sans-serif;
  overflow: hidden;
}
.sas-bg-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid #00C8FF;
  opacity: 0;
  animation: saRingPulse 2.4s ease-out infinite;
}
.sas-bg-ring:nth-child(1) { width:200px; height:200px; animation-delay:0s; }
.sas-bg-ring:nth-child(2) { width:320px; height:320px; animation-delay:0.5s; }
.sas-bg-ring:nth-child(3) { width:440px; height:440px; animation-delay:1s; }
@keyframes saRingPulse {
  0%   { opacity:0; transform:scale(0.5); }
  30%  { opacity:0.35; }
  100% { opacity:0; transform:scale(1.15); }
}
.sas-flash {
  position: absolute;
  inset: 0;
  background: white;
  opacity: 0;
  pointer-events: none;
  z-index: 50;
  animation: saFlash 0.4s ease-out 1.8s;
  border-radius: inherit;
}
@keyframes saFlash {
  0%   { opacity:0; }
  15%  { opacity:0.92; }
  100% { opacity:0; }
}
.sas-mascot-wrap {
  position: relative;
  animation: saMascotBounceIn 0.7s cubic-bezier(.34,1.56,.64,1) 0.3s both;
}
@keyframes saMascotBounceIn {
  from { opacity:0; transform:scale(0.4) translateY(60px); }
  to   { opacity:1; transform:scale(1) translateY(0); }
}
.sas-mascot-svg {
  width: 200px;
  height: 250px;
  animation: saMascotFloat 3s ease-in-out 1.2s infinite;
  filter: drop-shadow(0 0 18px rgba(0,200,255,0.35));
}
@keyframes saMascotFloat {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-10px); }
}
.sas-arm-selfie {
  animation: saArmRaise 0.5s cubic-bezier(.34,1.56,.64,1) 1.0s both;
  transform-origin: 85% 45%;
}
@keyframes saArmRaise {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-35deg); }
}
.sas-eye-lid {
  animation: saWink 0.3s ease 2.1s both;
  transform-origin: center;
}
@keyframes saWink {
  0%   { transform: scaleY(1); }
  40%  { transform: scaleY(0.05); }
  70%  { transform: scaleY(0.05); }
  100% { transform: scaleY(1); }
}
.sas-phone {
  position: absolute;
  top: -30px;
  right: -52px;
  width: 52px;
  height: 78px;
  background: linear-gradient(135deg, #1a2a3a, #0a1520);
  border-radius: 8px;
  border: 2px solid #00C8FF;
  box-shadow: 0 0 12px rgba(0,200,255,0.4);
  animation: saPhoneAppear 0.4s cubic-bezier(.34,1.56,.64,1) 1.0s both;
  overflow: hidden;
}
@keyframes saPhoneAppear {
  from { opacity:0; transform:scale(0) rotate(20deg); }
  to   { opacity:1; transform:scale(1) rotate(0deg); }
}
.sas-phone-screen {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a1828, #060D1A);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  position: relative;
  overflow: hidden;
}
.sas-phone-selfie-preview {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  animation: saScreenFlash 0.15s ease 2.0s;
}
@keyframes saScreenFlash {
  0%  { background: rgba(255,255,255,0.95); }
  100%{ background: transparent; }
}
.sas-phone-lens {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px; height: 8px;
  background: #222;
  border-radius: 50%;
  border: 1.5px solid #444;
}
.sas-cam-icon {
  font-size: 13px;
  animation: saCamPulse 1s ease-in-out 1.2s infinite;
}
@keyframes saCamPulse {
  0%,100% { opacity:1; }
  50%      { opacity:0.5; }
}
.sas-countdown {
  position: absolute;
  top: -55px;
  right: -65px;
  font-size: 36px;
  font-weight: 900;
  color: #F5A623;
  text-shadow: 0 0 20px rgba(245,166,35,0.8);
  animation: saCountAnim 1.5s ease forwards 0.6s;
  opacity: 0;
}
@keyframes saCountAnim {
  0%   { opacity:1; transform:scale(1.4); }
  30%  { opacity:1; transform:scale(1); }
  65%  { opacity:1; }
  100% { opacity:0; transform:scale(0.5); }
}
.sas-sparkle {
  position: absolute;
  font-size: 18px;
  opacity: 0;
  animation: saSparkleFloat 2s ease-out infinite;
}
.sas-sparkle:nth-child(1)  { top:-20px; left:10px;  animation-delay:2.3s; }
.sas-sparkle:nth-child(2)  { top:0px;   right:-5px;  animation-delay:2.6s; }
.sas-sparkle:nth-child(3)  { top:40px;  left:-25px;  animation-delay:2.8s; }
.sas-sparkle:nth-child(4)  { top:20px;  right:-30px; animation-delay:2.5s; }
.sas-sparkle:nth-child(5)  { top:-30px; right:30px;  animation-delay:3.0s; }
@keyframes saSparkleFloat {
  0%   { opacity:0; transform:scale(0.5) translateY(0); }
  40%  { opacity:1; transform:scale(1.2) translateY(-12px); }
  100% { opacity:0; transform:scale(0.8) translateY(-28px); }
}
.sas-photo-card {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%) translateY(0) rotate(-2deg);
  width: 160px;
  background: white;
  border-radius: 8px;
  padding: 8px 8px 28px 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
  animation: saPhotoSlideIn 0.5s cubic-bezier(.34,1.56,.64,1) 2.4s both;
  z-index: 10;
}
@keyframes saPhotoSlideIn {
  from { opacity:0; transform:translateX(-50%) translateY(40px) rotate(-2deg) scale(0.7); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) rotate(-2deg) scale(1); }
}
.sas-photo-inner {
  background: linear-gradient(135deg, #091520, #0D2035);
  border-radius: 5px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  position: relative;
  overflow: hidden;
}
.sas-photo-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0,200,255,0.08), transparent);
}
.sas-photo-caption {
  text-align: center;
  font-size: 8px;
  color: #666;
  margin-top: 6px;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
}
.sas-photo-caption strong {
  display: block;
  font-size: 9px;
  color: #333;
  margin-bottom: 1px;
}
.sas-message-wrap {
  position: relative;
  margin-top: 16px;
  animation: saMsgSlideUp 0.6s cubic-bezier(.34,1.56,.64,1) 2.8s both;
  z-index: 20;
}
@keyframes saMsgSlideUp {
  from { opacity:0; transform:translateY(24px) scale(0.9); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
.sas-message-box {
  background: linear-gradient(135deg, #0D2035, #091520);
  border: 1.5px solid #00C8FF;
  border-radius: 16px;
  padding: 16px 22px;
  max-width: 340px;
  text-align: center;
  position: relative;
  box-shadow: 0 0 24px rgba(0,200,255,0.15), inset 0 0 20px rgba(0,200,255,0.03);
}
.sas-message-box::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-bottom: 9px solid #00C8FF;
}
.sas-message-box::after {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid #091520;
}
.sas-msg-title {
  font-size: 17px;
  font-weight: 800;
  color: #E8EDF5;
  margin-bottom: 6px;
  line-height: 1.3;
}
.sas-msg-title span { color: #00C8FF; }
.sas-msg-sub {
  font-size: 12px;
  color: #8896A8;
  line-height: 1.5;
}
.sas-msg-badge {
  display: inline-block;
  margin-top: 10px;
  background: rgba(0,200,255,0.12);
  border: 1px solid rgba(0,200,255,0.35);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 11px;
  font-weight: 700;
  color: #00C8FF;
  letter-spacing: 1px;
}
.sas-scan-line {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00C8FF, transparent);
  opacity: 0;
  animation: saScanDown 1.2s ease-in-out 0.5s;
  z-index: 5;
}
@keyframes saScanDown {
  0%   { top:0%;    opacity:0.8; }
  100% { top:100%;  opacity:0; }
}
.sas-confetti {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  opacity: 0;
  animation: saConfettiFall 1.2s ease-out forwards;
}
@keyframes saConfettiFall {
  0%   { opacity:1; transform:translateY(0) rotate(0deg); }
  100% { opacity:0; transform:translateY(180px) rotate(360deg); }
}
.sas-footer {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #1A3050;
  letter-spacing: 2px;
  white-space: nowrap;
  animation: saFadeIn 1s ease 3.5s both;
  opacity: 0;
}
@keyframes saFadeIn {
  to { opacity: 1; }
}
`;

export function StepAiSelfie({ domain, scanDate }: StepAiSelfieProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const dateStr = scanDate ?? new Date().toISOString().split("T")[0];

  useEffect(() => {
    const colors = ["#00C8FF", "#F5A623", "#2ECC71", "#9B59B6", "#E03A3A"];
    const scene = sceneRef.current;
    if (!scene) return;

    const t1 = setTimeout(() => {
      for (let i = 0; i < 28; i++) {
        const c = document.createElement("div");
        c.className = "sas-confetti";
        c.style.cssText = `
          left:${30 + Math.random() * 40}%;
          top:${15 + Math.random() * 30}%;
          background:${colors[Math.floor(Math.random() * colors.length)]};
          width:${4 + Math.random() * 6}px;
          height:${4 + Math.random() * 6}px;
          border-radius:${Math.random() > 0.5 ? "50%" : "3px"};
          animation-delay:${2.05 + Math.random() * 0.4}s;
          animation-duration:${0.9 + Math.random() * 0.6}s;
        `;
        scene.appendChild(c);
      }
    }, 100);

    const cd = scene.querySelector<HTMLElement>(".sas-countdown");
    const nums = ["3", "2", "1", "📸"];
    let ni = 0;
    let iv: ReturnType<typeof setInterval>;
    const t2 = setTimeout(() => {
      if (!cd) return;
      iv = setInterval(() => {
        if (ni < nums.length) {
          cd.textContent = nums[ni++];
          cd.style.animation = "none";
          void cd.offsetHeight;
          cd.style.animation = "";
          cd.style.opacity = "1";
        } else {
          clearInterval(iv);
          cd.style.opacity = "0";
        }
      }, 380);
    }, 650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(iv);
      scene.querySelectorAll(".sas-confetti").forEach(el => el.remove());
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="sas-wrap" ref={sceneRef}>
        <div className="sas-bg-ring" />
        <div className="sas-bg-ring" />
        <div className="sas-bg-ring" />
        <div className="sas-scan-line" />
        <div className="sas-flash" />

        <div className="sas-mascot-wrap">
          <div className="sas-sparkle">✨</div>
          <div className="sas-sparkle">⭐</div>
          <div className="sas-sparkle">💫</div>
          <div className="sas-sparkle">✨</div>
          <div className="sas-sparkle">⭐</div>

          <div className="sas-phone">
            <div className="sas-phone-screen">
              <div className="sas-phone-lens" />
              <div className="sas-phone-selfie-preview">
                <span className="sas-cam-icon">📷</span>
              </div>
            </div>
          </div>

          <div className="sas-countdown">3</div>

          <svg className="sas-mascot-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
            <defs>
              <radialGradient id="sas-bG" cx="42%" cy="32%" r="62%">
                <stop offset="0%" stopColor="#1A4A6B"/>
                <stop offset="100%" stopColor="#060D1A"/>
              </radialGradient>
              <radialGradient id="sas-eG" cx="38%" cy="30%" r="58%">
                <stop offset="0%" stopColor="#FFFFFF"/>
                <stop offset="55%" stopColor="#00C8FF"/>
                <stop offset="100%" stopColor="#0066AA"/>
              </radialGradient>
              <radialGradient id="sas-sG" cx="50%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#F5C842"/>
                <stop offset="100%" stopColor="#C47800"/>
              </radialGradient>
              <filter id="sas-gl"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="sas-sh"><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#00C8FF" floodOpacity="0.25"/></filter>
              <filter id="sas-sg2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <ellipse cx="200" cy="478" rx="85" ry="13" fill="#00C8FF" opacity="0.1"/>
            <rect x="140" y="395" width="36" height="50" rx="18" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2"/>
            <ellipse cx="144" cy="447" rx="26" ry="11" fill="#0A1E30" stroke="#00C8FF" strokeWidth="1.5"/>
            <rect x="224" y="395" width="36" height="50" rx="18" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2"/>
            <ellipse cx="256" cy="447" rx="26" ry="11" fill="#0A1E30" stroke="#00C8FF" strokeWidth="1.5"/>
            <path d="M275 255 Q326 262 336 298 Q342 322 324 330 Q306 336 296 312 Q288 292 276 272" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2.5"/>
            <circle cx="330" cy="336" r="21" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2"/>
            <circle cx="348" cy="324" r="9" fill="#0D2535" stroke="#00C8FF" strokeWidth="1.5"/>
            <circle cx="350" cy="339" r="9" fill="#0D2535" stroke="#00C8FF" strokeWidth="1.5"/>
            <g className="sas-arm-selfie">
              <path d="M125 252 Q80 228 65 185 Q55 155 76 148 Q97 140 108 167 Q118 188 126 218" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2.5"/>
              <circle cx="58" cy="142" r="22" fill="url(#sas-bG)" stroke="#F5A623" strokeWidth="2.5"/>
              <circle cx="40" cy="130" r="9" fill="#0D2535" stroke="#F5A623" strokeWidth="1.5"/>
              <circle cx="42" cy="115" r="8" fill="#0D2535" stroke="#F5A623" strokeWidth="1.5"/>
              <circle cx="54" cy="110" r="8" fill="#0D2535" stroke="#F5A623" strokeWidth="1.5"/>
              <circle cx="66" cy="113" r="8" fill="#0D2535" stroke="#F5A623" strokeWidth="1.5"/>
              <circle cx="72" cy="126" r="8" fill="#0D2535" stroke="#F5A623" strokeWidth="1.5"/>
            </g>
            <rect x="110" y="188" width="180" height="215" rx="60" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2.5" filter="url(#sas-sh)"/>
            <rect x="138" y="268" width="124" height="88" rx="16" fill="#091520" stroke="#00C8FF" strokeWidth="1.5"/>
            <line x1="152" y1="286" x2="248" y2="286" stroke="#00C8FF" strokeWidth="1" opacity="0.4"/>
            <line x1="152" y1="299" x2="232" y2="299" stroke="#00C8FF" strokeWidth="1" opacity="0.3"/>
            <line x1="152" y1="312" x2="240" y2="312" stroke="#00C8FF" strokeWidth="1" opacity="0.4"/>
            <circle cx="200" cy="330" r="14" fill="rgba(46,204,113,0.15)" stroke="#2ECC71" strokeWidth="2"/>
            <text x="200" y="335" fontFamily="Arial Black" fontSize="14" fill="#2ECC71" textAnchor="middle">✓</text>
            <g transform="translate(174,223)">
              <path d="M26 0 Q46 7 46 7 L46 28 Q46 44 26 53 Q6 44 6 28 L6 7Z" fill="url(#sas-sG)" stroke="#FFF8E0" strokeWidth="1.5"/>
              <text x="26" y="36" fontFamily="Arial Black,Arial" fontSize="22" fontWeight="900" fill="#060D1A" textAnchor="middle">S</text>
            </g>
            <line x1="200" y1="56" x2="200" y2="26" stroke="#00C8FF" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="200" cy="18" r="10" fill="#F5A623" stroke="#FFF8E0" strokeWidth="1.5" filter="url(#sas-sg2)"/>
            <circle cx="200" cy="18" r="16" fill="none" stroke="#F5A623" strokeWidth="1.5" opacity="0.35"/>
            <circle cx="200" cy="18" r="22" fill="none" stroke="#F5A623" strokeWidth="1" opacity="0.15"/>
            <circle cx="96" cy="160" r="14" fill="#0A1E30" stroke="#00C8FF" strokeWidth="2"/>
            <circle cx="96" cy="160" r="7" fill="#00C8FF" opacity="0.6"/>
            <circle cx="304" cy="160" r="14" fill="#0A1E30" stroke="#00C8FF" strokeWidth="2"/>
            <circle cx="304" cy="160" r="7" fill="#00C8FF" opacity="0.6"/>
            <circle cx="200" cy="165" r="106" fill="url(#sas-bG)" stroke="#00C8FF" strokeWidth="2.5" filter="url(#sas-sh)"/>
            <path d="M133 118 Q163 104 192 116" fill="none" stroke="#00C8FF" strokeWidth="4" strokeLinecap="round"/>
            <path d="M208 116 Q237 104 266 118" fill="none" stroke="#00C8FF" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="163" cy="158" r="34" fill="#081828" stroke="#00C8FF" strokeWidth="2"/>
            <circle cx="163" cy="158" r="23" fill="url(#sas-eG)" filter="url(#sas-gl)"/>
            <circle cx="165" cy="156" r="11" fill="#002A3D"/>
            <circle cx="171" cy="150" r="5" fill="white" opacity="0.92"/>
            <circle cx="161" cy="160" r="2.5" fill="white" opacity="0.5"/>
            <circle cx="237" cy="158" r="34" fill="#081828" stroke="#00C8FF" strokeWidth="2"/>
            <g className="sas-eye-lid">
              <circle cx="237" cy="158" r="23" fill="url(#sas-eG)" filter="url(#sas-gl)"/>
              <circle cx="239" cy="156" r="11" fill="#002A3D"/>
              <circle cx="245" cy="150" r="5" fill="white" opacity="0.92"/>
            </g>
            <path d="M158 198 Q200 226 242 198" fill="none" stroke="#2ECC71" strokeWidth="5" strokeLinecap="round"/>
            <ellipse cx="140" cy="192" rx="15" ry="8" fill="#2ECC71" opacity="0.22"/>
            <ellipse cx="260" cy="192" rx="15" ry="8" fill="#2ECC71" opacity="0.22"/>
          </svg>

          <div className="sas-photo-card">
            <div className="sas-photo-inner">🤖</div>
            <div className="sas-photo-caption">
              <strong>STEP AI · GÜVENLİK TARAMASI</strong>
              {dateStr} · {domain ?? "cyberstep.io"}
            </div>
          </div>
        </div>

        <div className="sas-message-wrap">
          <div className="sas-message-box">
            <div className="sas-msg-title">
              Tebrikler! <span>Güvenlik fotoğrafınız</span> çekildi
            </div>
            <div className="sas-msg-sub">
              {domain ? `${domain} adresinin` : "Alan adınızın"} güvenlik durumu kayıt altına alındı.<br />
              Raporunuz hazırlanıyor…
            </div>
            <div className="sas-msg-badge">GÜVENLİK TARAMASI TAMAMLANDI</div>
          </div>
        </div>

        <div className="sas-footer">CYBERSTEP.IO · POWERED BY STEP AI</div>
      </div>
    </>
  );
}
