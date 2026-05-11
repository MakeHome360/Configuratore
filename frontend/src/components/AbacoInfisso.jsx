import React from "react";

export const COLOR_MAP = {
  bianco: "#FAFAFA", antracite: "#3F3F46", grigio: "#A1A1AA",
  marrone: "#78350F", noce: "#5B3A1A", rovere: "#A87C4F",
};

/**
 * AbacoInfisso — anteprima SVG di un infisso/finestra/porta-finestra.
 * Componente condiviso usato in PreventivoInfissi, InfissoQuickConfigurator e nel CAD (pannello proprietà finestre).
 *
 * Props:
 * - categoria: 'finestra' | 'portafinestra'
 * - apertura: 'battente' | 'scorrevole'
 * - hingeSide: 'sx' | 'dx'   (lato cerniera per anta singola; per ante>1 le esterne stanno sui lati esterni)
 * - colore: 'bianco' | 'antracite' | 'grigio' | 'marrone' | 'noce' | 'rovere'
 * - ante: 1..4
 * - larghezza, altezza (cm)
 * - materiale, vetro (label opzionali)
 * - tapparella (bool), tapparella_colore
 * - zanzariera (bool)
 * - size: 'big' (560×360 default) | 'mini' (360×220)
 */
export default function AbacoInfisso({
  categoria = "finestra",
  apertura = "battente",
  hingeSide = "sx",
  colore = "bianco",
  larghezza = 120,
  altezza = 140,
  materiale,
  vetro,
  ante = 1,
  tapparella = false,
  tapparella_colore = "antracite",
  zanzariera = false,
  size = "big",
}) {
  const isMini = size === "mini";
  const W = isMini ? 360 : 560;
  const H = isMini ? 220 : 360;
  const pad = isMini ? 36 : 60;
  const aw = Math.max(40, Math.min(larghezza || 100, 600));
  const ah = Math.max(40, Math.min(altezza || 140, 400));
  const maxW = W - pad * 2 - 70, maxH = H - pad * 2 - 40;
  const scale = Math.min(maxW / aw, maxH / ah);
  const ww = aw * scale, hh = ah * scale;
  const cx = pad + maxW / 2, cy = pad + maxH / 2;
  const x = cx - ww / 2, y = cy - hh / 2;
  const frameColor = COLOR_MAP[colore] || "#FAFAFA";
  const stroke = colore === "bianco" ? "#3F3F46" : "#0A0A0A";
  const isPF = categoria === "portafinestra";
  const isScorrevole = apertura === "scorrevole";
  const antaCount = Math.max(1, Math.min(4, Number(ante) || 1));
  const frameW = isMini ? 6 : 8;
  const tappColor = COLOR_MAP[tapparella_colore] || "#3F3F46";
  const hingeIsLeft = hingeSide === "sx";

  // Per ogni anta calcola: { hingeOnLeft, handleOnLeft }
  // - 1 anta: cerniera sul lato scelto, maniglia sull'opposto.
  // - 2 ante (a vasistas/2 battenti): cerniere ESTERNE (anta 1 a sx, anta 2 a dx), maniglie centrali.
  // - 3/4 ante: alterna come industria reale (esterne incernierate sui lati esterni).
  const antaConfig = (k) => {
    if (antaCount === 1) {
      return { hingeLeft: hingeIsLeft, handleLeft: !hingeIsLeft };
    }
    // più ante: estrema sx → cerniera sx, estrema dx → cerniera dx, interne → cerniera interna (verso bordo più vicino)
    if (k === 0) return { hingeLeft: true, handleLeft: false };
    if (k === antaCount - 1) return { hingeLeft: false, handleLeft: true };
    // interna: incerniera verso il bordo più vicino
    const goLeft = k < antaCount / 2;
    return { hingeLeft: goLeft, handleLeft: !goLeft };
  };

  const fontL = isMini ? 14 : 20;

  return (
    <div className="bg-white border-2 border-zinc-300 rounded p-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} data-testid="abaco-svg" style={{ maxWidth: "100%", height: "auto" }}>
        <defs>
          <filter id="frame-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
          </filter>
          <pattern id="mesh-zanz" width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="4" y2="4" stroke="#71717A" strokeWidth="0.4" />
            <line x1="4" y1="0" x2="0" y2="4" stroke="#71717A" strokeWidth="0.4" />
          </pattern>
          <linearGradient id="glass-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#A5D8E6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Cassonetto tapparella */}
        {tapparella && (
          <g>
            <rect x={x - 6} y={y - (isMini ? 22 : 30)} width={ww + 12} height={isMini ? 18 : 26} fill={tappColor} stroke={stroke} strokeWidth="1.4" rx="3" />
            <text x={cx} y={y - (isMini ? 8 : 12)} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={isMini ? 9 : 12} fontWeight="700" fill={tapparella_colore === "bianco" ? "#3F3F46" : "#FFF"}>TAPPARELLA</text>
          </g>
        )}

        {/* Quota LARGHEZZA */}
        {(() => {
          const yQ = y - (tapparella ? (isMini ? 36 : 50) : (isMini ? 20 : 30));
          return (
            <g>
              <line x1={x} y1={yQ} x2={x + ww} y2={yQ} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <line x1={x} y1={yQ - 5} x2={x} y2={yQ + 5} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <line x1={x + ww} y1={yQ - 5} x2={x + ww} y2={yQ + 5} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <rect x={cx - (isMini ? 38 : 56)} y={yQ - (isMini ? 11 : 16)} width={isMini ? 76 : 112} height={isMini ? 20 : 26} fill="#FFF" stroke="#16A34A" strokeWidth={isMini ? "1.4" : "2"} rx="3" />
              <text x={cx} y={yQ + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={fontL} fontWeight="900" fill="#0A0A0A">{`${larghezza} cm`}</text>
            </g>
          );
        })()}

        {/* Quota ALTEZZA */}
        {(() => {
          const xQ = x + ww + (isMini ? 18 : 30);
          return (
            <g>
              <line x1={xQ} y1={y} x2={xQ} y2={y + hh} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <line x1={xQ - 5} y1={y} x2={xQ + 5} y2={y} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <line x1={xQ - 5} y1={y + hh} x2={xQ + 5} y2={y + hh} stroke="#16A34A" strokeWidth={isMini ? "1.5" : "2.5"} />
              <rect x={xQ + 6} y={cy - (isMini ? 11 : 13)} width={isMini ? 62 : 90} height={isMini ? 20 : 26} fill="#FFF" stroke="#16A34A" strokeWidth={isMini ? "1.4" : "2"} rx="3" />
              <text x={xQ + (isMini ? 37 : 51)} y={cy + 5} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={fontL} fontWeight="900" fill="#0A0A0A">{`${altezza} cm`}</text>
            </g>
          );
        })()}

        {/* Davanzale (solo finestra) */}
        {!isPF && (
          <g>
            <rect x={x - 8} y={y + hh + 3} width={ww + 16} height={isMini ? 6 : 8} fill="#A1A1AA" stroke="#52525B" strokeWidth="1" />
            {!isMini && <text x={cx} y={y + hh + 22} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#525252">DAVANZALE</text>}
          </g>
        )}

        {/* Frame esterno */}
        <rect x={x} y={y} width={ww} height={hh} fill={frameColor} stroke={stroke} strokeWidth={isMini ? "2" : "3"} filter="url(#frame-shadow)" />
        <rect x={x + frameW} y={y + frameW} width={ww - 2 * frameW} height={hh - 2 * frameW} fill="url(#glass-grad)" stroke={stroke} strokeWidth="1.5" />
        {/* Riflesso diagonale del vetro */}
        <line x1={x + frameW + 8} y1={y + frameW + 6} x2={x + ww - frameW - 8} y2={y + hh - frameW - 6} stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" />

        {/* Anta dividers + numeri */}
        {!isScorrevole && antaCount > 1 && Array.from({ length: antaCount - 1 }).map((_, k) => {
          const dx = x + (ww / antaCount) * (k + 1);
          return (
            <g key={`d-${k}`}>
              <rect x={dx - 4} y={y + frameW} width={8} height={hh - 2 * frameW} fill={frameColor} stroke={stroke} strokeWidth="1.5" />
              <line x1={dx} y1={y + frameW + 2} x2={dx} y2={y + hh - frameW - 2} stroke={stroke} strokeWidth="0.6" />
            </g>
          );
        })}

        {/* Linee di apertura (battente): triangolo che indica il senso dell'apertura. Vertice = cerniera */}
        {!isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * k;
          const aw_ = ww / antaCount;
          const { hingeLeft } = antaConfig(k);
          const hingeX = hingeLeft ? ax + frameW : ax + aw_ - frameW;
          const handleX = hingeLeft ? ax + aw_ - frameW : ax + frameW;
          return (
            <path key={`open-${k}`} d={`M ${hingeX} ${y + hh - frameW} L ${handleX} ${y + frameW} L ${hingeX} ${y + frameW} Z`} fill="none" stroke={stroke} strokeWidth="0.9" strokeDasharray="3,3" opacity="0.6" />
          );
        })}

        {/* Scorrevole: frecce orizzontali */}
        {isScorrevole && (
          <>
            <line x1={cx} y1={y + frameW} x2={cx} y2={y + hh - frameW} stroke={stroke} strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={cx - ww / 4} y={cy + 6} textAnchor="middle" fontSize={isMini ? "16" : "22"} fontWeight="800" fill={stroke}>→</text>
            <text x={cx + ww / 4} y={cy + 6} textAnchor="middle" fontSize={isMini ? "16" : "22"} fontWeight="800" fill={stroke}>←</text>
          </>
        )}

        {/* Cerniere & Maniglia PER ANTA (sempre, anche per 1 anta) */}
        {!isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * k;
          const aw_ = ww / antaCount;
          const { hingeLeft, handleLeft } = antaConfig(k);
          const hingeX = hingeLeft ? ax + frameW + 2 : ax + aw_ - frameW - 5;
          const handleX = handleLeft ? ax + frameW + (isMini ? 5 : 10) : ax + aw_ - frameW - (isMini ? 9 : 14);
          const handleColor = (colore === "bianco" || colore === "grigio") ? "#3F3F46" : "#E5E7EB";
          return (
            <g key={`hw-${k}`} pointerEvents="none">
              {/* 3 cerniere lungo lato cerniera */}
              {[0.18, 0.5, 0.82].map((p, j) => (
                <rect key={j} x={hingeX} y={y + hh * p - 6} width={isMini ? 3 : 4} height={isMini ? 9 : 12} fill="#9CA3AF" stroke="#0A0A0A" strokeWidth="0.5" />
              ))}
              {/* Cremonese: barra verticale + pomello */}
              <rect x={handleX - (isMini ? 2 : 3)} y={cy - (isMini ? 13 : 18)} width={isMini ? 4 : 6} height={isMini ? 26 : 36} rx={isMini ? 2 : 3} fill={handleColor} stroke="#0A0A0A" strokeWidth="0.6" />
              <circle cx={handleX} cy={cy} r={isMini ? 3.5 : 5} fill={handleColor} stroke="#0A0A0A" strokeWidth="0.8" />
              {/* Maniglietta orizzontale (cremonese stilizzata) */}
              <rect x={handleLeft ? handleX : handleX - (isMini ? 12 : 18)} y={cy - (isMini ? 1.5 : 2)} width={isMini ? 12 : 18} height={isMini ? 3 : 4} rx={isMini ? 1 : 2} fill={handleColor} stroke="#0A0A0A" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* Numero anta (cerchio in basso) */}
        {antaCount > 1 && !isScorrevole && Array.from({ length: antaCount }).map((_, k) => {
          const ax = x + (ww / antaCount) * (k + 0.5);
          return (
            <g key={`n-${k}`} pointerEvents="none">
              <circle cx={ax} cy={y + hh - (isMini ? 12 : 18)} r={isMini ? 8 : 12} fill="white" stroke={stroke} strokeWidth="1.5" />
              <text x={ax} y={y + hh - (isMini ? 8.5 : 13)} textAnchor="middle" fontSize={isMini ? 10 : 14} fontWeight="900" fontFamily="JetBrains Mono" fill={stroke}>{k + 1}</text>
            </g>
          );
        })}

        {/* Zanzariera */}
        {zanzariera && (
          <g pointerEvents="none">
            <rect x={x + frameW + 2} y={y + frameW + 2} width={(ww - 2 * frameW - 4) / 2} height={hh - 2 * frameW - 4} fill="url(#mesh-zanz)" opacity="0.7" />
            {!isMini && <text x={x + ww / 4} y={y + hh - 26} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" fill="#525252">ZANZARIERA</text>}
          </g>
        )}

        {/* Etichetta info riepilogativa */}
        {!isMini && (
          <g>
            <rect x={20} y={H - 36} width={W - 40} height={24} fill="#FAFAFA" stroke="#D4D4D8" strokeWidth="1" rx="3" />
            <text x={28} y={H - 18} fontFamily="JetBrains Mono" fontSize="12" fontWeight="700" fill="#3F3F46">
              {`${isPF ? "PORTA-FINESTRA" : "FINESTRA"} · ${isScorrevole ? "SCORREVOLE" : "BATTENTE"} · ${antaCount} ANTA${antaCount > 1 ? "E" : ""} · cardine ${antaCount === 1 ? (hingeIsLeft ? "SX" : "DX") : "auto"} · ${materiale || "—"} · ${vetro || "—"}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
