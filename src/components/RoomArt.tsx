import type { ReactNode } from "react";
import type { SpaceType } from "@/domain/types";

const NAVY = "#1e3357", BLUE = "#17658f", GOLD = "#f2c15c", PALE = "#cfe2f2", WHITE = "#ffffff";

/** Where each plain-language question points in its room scene, and what to look at. */
export const QUESTION_VISUALS: Readonly<Record<string, { at: readonly (readonly [number, number, number])[]; look: string }>> = {
  br1: { at: [[206, 171, 22]], look: "The height of the bed" },
  br2: { at: [[244, 205, 16]], look: "The path from the bed to the door" },
  br3: { at: [[231, 119, 19]], look: "The bedside light" },
  br4: { at: [[222, 139, 13]], look: "The phone by the bed" },
  br5: { at: [[173, 120, 19]], look: "Something sturdy by the bed" },
  br6: { at: [[134, 202, 18]], look: "The floor beside the bed" },
  br7: { at: [[40, 100, 24]], look: "Where clothes are kept" },
  b1: { at: [[283, 128, 20]], look: "The wall beside the toilet" },
  b2: { at: [[92, 104, 22]], look: "The wall of the shower or bath" },
  b3: { at: [[84, 174, 20]], look: "The floor of the shower or bath" },
  b4: { at: [[119, 128, 19]], look: "A seat in the shower" },
  b5: { at: [[233, 158, 24]], look: "The height of the toilet" },
  b6: { at: [[290, 168, 18]], look: "A night light on the way" },
  b7: { at: [[184, 124, 17]], look: "The taps" },
  b8: { at: [[86, 202, 18]], look: "The floor outside the shower or bath" },
  k1: { at: [[118, 204, 20]], look: "The kitchen floor" },
  k2: { at: [[82, 58, 26]], look: "Everyday shelves and cupboards" },
  k3: { at: [[64, 120, 22]], look: "The counter" },
  k4: { at: [[186, 109, 21]], look: "The stove controls" },
  k5: { at: [[248, 26, 17]], look: "The smoke alarm" },
  k6: { at: [[82, 86, 19]], look: "The light over the counter" },
  k7: { at: [[251, 172, 23]], look: "High shelves and step stools" },
  l1: { at: [[186, 199, 16]], look: "Rugs and mats" },
  l2: { at: [[120, 213, 14]], look: "The walking path" },
  l3: { at: [[26, 66, 21]], look: "The room lighting" },
  l4: { at: [[222, 201, 15]], look: "Cords on the floor" },
  l5: { at: [[108, 146, 28]], look: "The chair or sofa" },
  l6: { at: [[200, 137, 15]], look: "A phone within reach" },
  l7: { at: [[286, 49, 19]], look: "A fall alert device" },
  e1: { at: [[132, 189, 15]], look: "The bottom of the doorway" },
  e2: { at: [[105, 94, 21]], look: "The light by the door" },
  e3: { at: [[178, 198, 15]], look: "The surface by the door" },
  e4: { at: [[104, 208, 16]], look: "The steps or ramp" },
  e5: { at: [[232, 162, 20]], look: "The handrail" },
  e6: { at: [[186, 126, 15]], look: "The door handle" },
  e7: { at: [[229, 82, 20]], look: "The house number" },
  s1: { at: [[132, 76, 21]], look: "The handrails" },
  s2: { at: [[112, 141, 16]], look: "The surface of each step" },
  s3: { at: [[68, 166, 11], [102, 144, 11], [136, 122, 11], [170, 100, 11]], look: "The edge of each step" },
  s4: { at: [[19, 136, 15], [267, 50, 15]], look: "The light switches, top and bottom" },
  s5: { at: [[248, 66, 22]], look: "The width of the stairs" },
  s6: { at: [[184, 92, 17]], look: "Anything left on the steps" },
  s7: { at: [[84, 152, 21]], look: "The whole staircase" },
  ex1: { at: [[204, 206, 18]], look: "The path to the door" },
  ex2: { at: [[196, 172, 17]], look: "The path lighting" },
  ex3: { at: [[70, 205, 19]], look: "The driveway" },
  ex4: { at: [[276, 166, 16]], look: "The outdoor handrails" },
  ex5: { at: [[129, 152, 19]], look: "The way to the mailbox" },
  ex6: { at: [[294, 184, 14]], look: "The ramp" },
};

const glow = (cx: number, cy: number, r = 22) => <circle className="scene-glow" cx={cx} cy={cy} r={r} fill={GOLD} opacity=".28" stroke="none" />;

type SceneKey = "bedroom" | "bathroom" | "kitchen" | "living" | "entry" | "stairway" | "exterior";
const ALIAS: Partial<Record<SpaceType, SceneKey>> = { hallway: "living", laundry: "kitchen", garage: "exterior", custom: "living" };
const SCENES: Record<SceneKey, { floor: number; wall?: string; ground?: string; art: ReactNode }> = {
  bedroom: { floor: 188, art: <>
    <rect x="18" y="64" width="44" height="124" rx="4" fill={WHITE} /><path d="M24 78h32M40 78v8m-9 14 9-8 9 8" /><path d="M31 100h18v30H31z" fill={PALE} />
    <rect x="128" y="38" width="54" height="46" rx="4" fill="#fff8e6" /><path d="M155 38v46M128 61h54" />
    <rect x="72" y="98" width="10" height="90" rx="3" fill={WHITE} /><rect x="82" y="130" width="116" height="24" rx="7" fill={WHITE} /><rect x="88" y="116" width="38" height="16" rx="8" fill={PALE} /><path d="M92 154v34M190 154v34" />
    <path d="M160 130v-16q0-4 4-4h18q4 0 4 4v16M160 120h26" />
    <path d="M206 157v29M201 157h10M201 186h10" stroke={BLUE} strokeDasharray="3 4" />
    {glow(231, 118)}<rect x="214" y="142" width="34" height="46" rx="4" fill={WHITE} /><path d="M214 160h34M229 151h4M231 142v-14" /><path d="M220 128h22l-5-18h-12z" fill={GOLD} /><rect x="217" y="136" width="11" height="6" rx="2" fill={NAVY} />
    <rect x="268" y="98" width="38" height="90" rx="3" fill={WHITE} /><circle cx="276" cy="146" r="1.6" />
    <path d="M206 205h64" stroke={BLUE} strokeDasharray="2 7" /><path d="m266 200 6 5-6 5" stroke={BLUE} />
    <rect x="120" y="196" width="18" height="12" rx="2" fill={WHITE} /><path d="M138 204q7-8 13 0t12 0" />
  </> },
  bathroom: { floor: 188, art: <>
    <path d="M34 138V60q0-6 6-6h10l8 6" /><path d="m52 68-2 6m9-4-2 6m9-3-2 6" stroke={BLUE} />
    <path d="M72 104h40" stroke={BLUE} strokeWidth="4.5" /><rect x="102" y="122" width="34" height="7" rx="3.5" fill={WHITE} /><path d="M108 129v10M130 129v10" />
    <rect x="22" y="138" width="124" height="50" rx="12" fill={WHITE} /><path d="M22 151h124" /><path d="M60 176h.1M76 176h.1M92 176h.1M108 176h.1" stroke={BLUE} strokeWidth="4.5" />
    <rect x="56" y="198" width="60" height="9" rx="4.5" fill={PALE} />
    <circle cx="182" cy="84" r="18" fill={WHITE} /><rect x="160" y="132" width="44" height="12" rx="6" fill={WHITE} /><path d="M176 144v44M188 144v44M182 132v-8q0-5 6-5" />
    <rect x="222" y="118" width="30" height="32" rx="4" fill={WHITE} /><path d="M218 161q2 20 8 27h18q6-7 8-27" fill={WHITE} /><rect x="210" y="150" width="46" height="11" rx="5.5" fill={WHITE} />
    <path d="M266 128h34" stroke={BLUE} strokeWidth="4.5" />
    {glow(290, 166, 18)}<rect x="284" y="160" width="12" height="16" rx="3" fill={GOLD} />
  </> },
  kitchen: { floor: 188, art: <>
    <rect x="20" y="36" width="124" height="44" rx="4" fill={WHITE} /><path d="M61 36v44M103 36v44M52 60v6M70 60v6M112 60v6" />
    <path d="M26 85h112" stroke={GOLD} strokeWidth="4" />
    <path d="M162 38h46l8 22h-62z" fill={WHITE} />
    <rect x="152" y="102" width="68" height="14" rx="4" fill={WHITE} /><circle cx="168" cy="109" r="2.6" /><circle cx="186" cy="109" r="2.6" /><circle cx="204" cy="109" r="2.6" />
    <rect x="20" y="130" width="130" height="58" fill={WHITE} /><path d="M63 130v58M107 130v58M54 150v8M72 150v8M116 150v8" />
    <rect x="150" y="130" width="70" height="58" fill={WHITE} /><rect x="160" y="146" width="50" height="28" rx="4" /><path d="M160 125h18M192 125h18" strokeWidth="4" />
    <path d="M16 129h208" strokeWidth="4" />
    <rect x="34" y="119" width="30" height="7" rx="2" fill={GOLD} /><path d="M84 114h12v12H84z" fill={WHITE} />
    <rect x="236" y="158" width="30" height="6" rx="3" fill={WHITE} /><path d="m242 164-4 24M260 164l4 24M240 177h22" />
    <rect x="278" y="72" width="32" height="116" rx="5" fill={WHITE} /><path d="M278 112h32M284 92v10M284 122v14" />
    <circle cx="248" cy="26" r="9" fill={WHITE} /><circle cx="248" cy="26" r="2" fill={NAVY} />
    <ellipse cx="118" cy="204" rx="20" ry="5" fill="#bcd8ee" stroke="none" />
  </> },
  living: { floor: 188, art: <>
    <rect x="78" y="42" width="56" height="38" rx="4" fill={WHITE} /><path d="m86 72 14-14 10 9 8-6 10 11" />
    {glow(26, 68, 24)}<path d="M26 188V78M18 188h16" /><path d="M14 78h24l-5-22H19z" fill={GOLD} />
    <rect x="46" y="108" width="124" height="44" rx="12" fill={PALE} /><rect x="40" y="140" width="136" height="30" rx="9" fill={WHITE} /><path d="M52 170v18M164 170v18M108 140v30" />
    <path d="M186 142h30M201 142v46M192 188h18" /><rect x="194" y="135" width="13" height="6" rx="2" fill={NAVY} />
    <rect x="244" y="104" width="52" height="34" rx="4" fill={NAVY} /><path d="M270 138v14" /><rect x="238" y="152" width="64" height="36" rx="4" fill={WHITE} /><path d="M270 152v36" />
    <rect x="278" y="38" width="16" height="22" rx="5" fill={WHITE} /><path d="M271 44q-4 5 0 10M301 44q4 5 0 10" stroke={BLUE} />
    <rect x="64" y="196" width="118" height="10" rx="5" fill={GOLD} opacity=".75" /><path d="M182 201q8-10 14-3" />
    <path d="M238 196q-10 12-22 4t-18 6" />
    <path d="M30 213h70M140 213h150" stroke={BLUE} strokeDasharray="2 7" />
  </> },
  entry: { floor: 214, art: <>
    {glow(105, 94, 24)}<path d="M98 84h14v20H98z" fill={GOLD} /><path d="M105 78v6M96 84h18" />
    <rect x="124" y="60" width="72" height="128" rx="5" fill={WHITE} /><rect x="136" y="72" width="48" height="40" rx="3" fill={PALE} /><rect x="136" y="122" width="48" height="52" rx="3" /><circle cx="186" cy="126" r="4.5" fill={GOLD} />
    <rect x="98" y="192" width="124" height="11" fill={WHITE} /><rect x="84" y="203" width="152" height="11" fill={WHITE} /><rect x="118" y="186" width="84" height="6" rx="2" fill={NAVY} />
    <path d="M168 197h.1M178 199h.1M187 196h.1" stroke={BLUE} strokeWidth="3.5" />
    <path d="M246 214v-44M214 192v-40M210 150l40 22" />
    <rect x="214" y="72" width="30" height="20" rx="4" fill={WHITE} /><text x="229" y="87" fontSize="12" fontWeight="800" fill={NAVY} stroke="none" textAnchor="middle">24</text>
    <path d="m40 214 4-22h20l4 22z" fill={WHITE} /><path d="M54 192q-14-18-4-34M54 192q12-16 6-30M54 192v-24" />
  </> },
  stairway: { floor: 188, art: <>
    <path d="M40 150 190 53" strokeDasharray="6 6" opacity=".45" />
    <path d="M150 6v8" /><path d="M140 14h20l-4 10h-12z" fill={GOLD} />
    <path d="M30 188h34v-22h34v-22h34v-22h34v-22h34V78h96v110z" fill={WHITE} />
    <path d="M64 166h9M98 144h9M132 122h9M166 100h9M200 78h9" stroke={GOLD} strokeWidth="4.5" />
    <path d="M64 166v-46M200 78V32M58 124l148-96" />
    <path d="M100 144q10-8 18-1" /><rect x="176" y="86" width="16" height="14" rx="2" fill={GOLD} />
    <rect x="14" y="128" width="10" height="16" rx="2.5" fill={WHITE} /><rect x="262" y="42" width="10" height="16" rx="2.5" fill={WHITE} />
    <path d="M224 66h48m-5-4 5 4-5 4M229 62l-5 4 5 4" stroke={BLUE} />
  </> },
  exterior: { floor: 188, wall: "#e6f1fa", ground: "#e3efdf", art: <>
    <circle cx="40" cy="40" r="14" fill={GOLD} opacity=".85" stroke="none" />
    <path d="M62 188v-44" /><circle cx="62" cy="116" r="30" fill="#cfe6d4" />
    <path d="m30 214 6-18h64l12 18z" fill="#dde4ea" stroke="none" />
    <path d="M240 188h28l-70 28h-52z" fill="#efe6d6" /><path d="m206 204 6-4 5 5" />
    <rect x="214" y="98" width="88" height="90" fill={WHITE} /><path d="m204 100 54-46 54 46z" fill={PALE} /><rect x="240" y="136" width="26" height="46" rx="2" fill={GOLD} /><rect x="274" y="112" width="18" height="18" rx="2" fill="#e6f1fa" />
    <rect x="232" y="182" width="42" height="6" fill={WHITE} /><path d="M274 188h36l-36-7z" fill={WHITE} /><path d="M278 181v-22M278 159l-10-6" />
    {glow(196, 170, 18)}<path d="M196 188v-13" /><circle cx="196" cy="170" r="5" fill={GOLD} />
    <path d="M128 196v-36M142 150h6v-6" /><rect x="116" y="146" width="26" height="14" rx="5" fill={WHITE} />
  </> },
};

/**
 * Illustrated room scenes. Decorative: the adjacent text names the room and the
 * detail to look at. `focus` is a question code; the scene highlights that detail.
 */
export function RoomArt({ type = "living", dimmed = false, focus }: { type?: SpaceType; dimmed?: boolean; focus?: string }) {
  const scene = SCENES[(ALIAS[type] ?? type) as SceneKey] ?? SCENES.living, spots = focus ? QUESTION_VISUALS[focus]?.at ?? [] : [];
  return <svg className={`room-art room-art--${type}${dimmed ? " room-art--dimmed" : ""}`} viewBox="0 0 320 220" aria-hidden="true" focusable="false">
    <rect x="4" y="4" width="312" height="212" rx="22" fill={scene.wall ?? "#eaf2f9"} />
    <path d={`M4 ${scene.floor}H316V194a22 22 0 0 1-22 22H26a22 22 0 0 1-22-22Z`} fill={scene.ground ?? "#f4eee3"} />
    <g className="room-art__lines" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M4 ${scene.floor}H316`} opacity=".3" />
      {scene.art}
    </g>
    {spots.map(([x, y, r], i) => <g className="scene-focus" key={`${focus}-${i}`}>
      <circle className="scene-focus__halo" cx={x} cy={y} r={r + 9} fill={GOLD} />
      <circle className="scene-focus__ring" cx={x} cy={y} r={r} fill="rgba(242,193,92,.16)" stroke="#d9912a" strokeWidth="3" />
    </g>)}
  </svg>;
}
