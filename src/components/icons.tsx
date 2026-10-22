import { useId, type CSSProperties } from "react";
import { FootballBall } from "./football-art";
export function Bolt({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width="24"
      height="28"
      viewBox="0 0 24 28"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 0 1 16h9L8 28l15-17h-9z" />
    </svg>
  );
}
export function SportArt({
  sport,
  className = "",
}: {
  sport: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className={className} viewBox="0 0 300 240" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-orange`} cx="28%" cy="22%" r="85%"><stop stopColor="#f9bf91"/><stop offset=".55" stopColor="#e68b61"/><stop offset="1" stopColor="#a75030"/></radialGradient>
        <radialGradient id={`${id}-green`} cx="25%" cy="20%" r="90%"><stop stopColor="#7b9f78"/><stop offset=".5" stopColor="#315a36"/><stop offset="1" stopColor="#193920"/></radialGradient>
        <radialGradient id={`${id}-blue`} cx="20%" cy="15%" r="90%"><stop stopColor="#8da8ce"/><stop offset=".5" stopColor="#466da3"/><stop offset="1" stopColor="#233f66"/></radialGradient>
        <radialGradient id={`${id}-ivory`} cx="25%" cy="15%" r="85%"><stop stopColor="#ffffff"/><stop offset=".6" stopColor="#fffff5"/><stop offset="1" stopColor="#c5d0b5"/></radialGradient>
        <radialGradient id={`${id}-red`} cx="25%" cy="20%" r="85%"><stop stopColor="#e8957a"/><stop offset=".45" stopColor="#bd6039"/><stop offset="1" stopColor="#783d2b"/></radialGradient>
        <linearGradient id={`${id}-wood`}><stop stopColor="#b8884e"/><stop offset=".22" stopColor="#e7c797"/><stop offset=".55" stopColor="#f5dbaf"/><stop offset="1" stopColor="#b98a54"/></linearGradient>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b1b9b0"/><stop offset=".35" stopColor="#fffff5"/><stop offset=".6" stopColor="#bac6b6"/><stop offset="1" stopColor="#536451"/></linearGradient>
        <pattern id={`${id}-grip`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h6v6H0z" fill="#315a36"/><path d="m0 5 6-4" stroke="#d9f46b" strokeWidth="1" opacity=".55"/></pattern>
        <pattern id={`${id}-strings`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0h10v10" stroke="#688768" strokeWidth=".8" opacity=".6"/></pattern>
        <clipPath id={`${id}-racket`}><ellipse cy="-24" rx="47" ry="60"/></clipPath>
        <radialGradient id={`${id}-halo`}><stop stopColor="#fffff5" stopOpacity=".8"/><stop offset="1" stopColor="#fffff5" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="150" cy="116" r="107" fill={paint("halo")}/>
      <g stroke="currentColor" strokeOpacity=".08"><circle cx="150" cy="120" r="96"/><circle cx="150" cy="120" r="77"/><path d="M16 185h268"/></g>
      <ellipse className="equipment-shadow" cx="150" cy="208" rx="67" ry="8" fill="#193920" opacity=".15"/>
      <g className="sport-object">
        {sport === "Football" ? (
          <g className="equipment-primary"><g transform="translate(150 120) rotate(-18) scale(.77)"><FootballBall/></g></g>
        ) : sport === "Cricket" ? (
          <g>
            <g className="equipment-primary"><g transform="translate(132 116) rotate(32)">
              <rect x="-23" y="-35" width="46" height="125" rx="8" fill={paint("wood")} stroke="#a47b49" strokeWidth="1.5"/>
              <path d="M-16-29v108M-10-29V82M7-29V83M15-29v109" stroke="#a77c44" strokeWidth=".7" opacity=".4"/>
              <path d="M-23 55h46v23h-46z" fill="#315a36"/><path d="m5 59-12 11h8l-3 7 13-12H3z" fill="#d9f46b"/>
              <path d="M-20-27h40" stroke="#fffff5" strokeWidth="2" opacity=".6"/>
              <rect x="-7" y="-107" width="14" height="75" rx="5" fill={paint("grip")}/>
              <path d="M-7-36H7" stroke="#d9f46b" strokeWidth="4"/>
            </g></g>
            <g className="equipment-secondary"><g transform="translate(221 167) rotate(-25)"><circle r="25" fill={paint("red")}/><path d="M-4-24q-15 24 0 48M4-24q-15 24 0 48" stroke="#fff4dc" strokeWidth="1.5"/><path d="M-8-21q-15 21 0 42M8-21q-15 21 0 42" stroke="#fff4dc" strokeWidth="1" strokeDasharray="2 3"/><path d="M-15-13q5-7 11-8" stroke="#ffffff" strokeWidth="2" opacity=".6" strokeLinecap="round"/></g></g>
          </g>
        ) : sport === "Badminton" ? (
          <g>
            <g className="equipment-primary"><g transform="translate(132 119) rotate(28)">
              <ellipse cy="-24" rx="52" ry="65" fill="#315a36"/><ellipse cy="-24" rx="48" ry="61" fill={paint("ivory")}/><ellipse cy="-24" rx="47" ry="60" fill={paint("strings")}/>
              <path d="M-45-57q7-18 22-25" stroke="#d9f46b" strokeWidth="2.5" strokeLinecap="round"/><path d="m-13 38 13 25 13-25" stroke={paint("steel")} strokeWidth="3"/>
              <path d="M0 52v43" stroke="#889582" strokeWidth="6"/><path d="M-1 54v38" stroke="#fffff5" strokeWidth="1.5"/><rect x="-7" y="88" width="14" height="38" rx="5" fill={paint("grip")}/>
            </g></g>
            <g className="equipment-secondary"><g transform="translate(228 94) rotate(-25)">
              <path d="m-12 4-15-44q27-13 54 0L12 4z" fill={paint("ivory")} stroke="#b3c0a7" strokeWidth="1"/>
              <path d="m-24-38 14 41M-13-43l8 46M0-46V4M13-43 5 3M24-38 10 3M-19-17h38" stroke="#b3c0a7" strokeWidth="1"/>
              <path d="M-12 0h24v10q-12 14-24 0z" fill={paint("wood")}/><path d="M-12 1h24" stroke="#315a36" strokeWidth="4"/>
            </g></g>
          </g>
        ) : sport === "Table tennis" ? (
          <g>
            <g className="equipment-primary"><g transform="translate(137 119) rotate(25)">
              <path d="M-12 39h24l-3 71q-9 13-18 0z" fill={paint("wood")} stroke="#a47b49" strokeWidth="1"/>
              <path d="M-4 51v54M3 51v54" stroke="#a47b49" opacity=".45"/>
              <ellipse cy="-12" rx="57" ry="66" fill="#f3d8a7" stroke="#193920" strokeWidth="2"/>
              <ellipse cx="-1" cy="-15" rx="54" ry="63" fill={paint("red")}/>
              <path d="M-46-39q8-22 29-29" stroke="#ffd4b0" strokeWidth="2" opacity=".6" strokeLinecap="round"/>
              <path d="M-40 27q40 15 80 0" stroke="#e8b69c" strokeWidth="1" opacity=".5"/>
            </g></g>
            <g className="equipment-secondary"><circle cx="224" cy="88" r="19" fill={paint("ivory")} stroke="#c5d0b5" strokeWidth="1"/><path d="m215 78 5-3" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></g>
          </g>
        ) : sport === "Weightlifting" ? (
          <g className="equipment-primary"><g transform="translate(150 120) rotate(-16)">
            <rect x="-119" y="-6" width="238" height="12" rx="5" fill={paint("steel")}/>
            <path d="M-25-5v10M-19-5v10M-13-5v10M-7-5v10M7-5v10M13-5v10M19-5v10M25-5v10" stroke="#667460" strokeWidth="1"/>
            {[-80, -57, 57, 80].map((x) => <g key={x}><rect x={x-11} y={Math.abs(x)===57?-64:-47} width="22" height={Math.abs(x)===57?128:94} rx="7" fill={paint("blue")} stroke="#233f66" strokeWidth="1.5"/><path d={`M${x-5} ${Math.abs(x)===57?-55:-38}v${Math.abs(x)===57?110:76}`} stroke="#b5cee8" strokeWidth="2" opacity=".5"/></g>)}
            <path d="M-97-11v22M97-11v22" stroke="#315a36" strokeWidth="7" strokeLinecap="round"/>
          </g></g>
        ) : sport === "Chess" ? (
          <g className="equipment-primary"><g transform="translate(150 115)">
            <path d="m-79 65 112-14 51 43-111 17z" fill="#b9c7a4" stroke="#94a585" strokeWidth="1"/>
            <path d="m-52 62 53 45m-27-48 53 46M0 56l53 46m-111-5 110-15m-126 1 110-15" stroke="#fffff5" strokeWidth="1"/>
            <path d="M-50 70h100v13q-50 14-100 0z" fill="#193920"/>
            <ellipse cy="69" rx="50" ry="12" fill={paint("green")}/>
            <path d="M-20-20h40l9 61 17 25q-46 13-92 0l17-25z" fill={paint("green")} stroke="#24452a" strokeWidth="1"/>
            <ellipse cy="-20" rx="24" ry="7" fill={paint("green")}/>
            <circle cy="-51" r="29" fill={paint("green")}/>
            <path d="M-16-63q5-9 15-10M-14-8l-5 42" stroke="#d9f46b" strokeWidth="3" opacity=".75" strokeLinecap="round"/>
            <ellipse cy="48" rx="33" ry="7" stroke="#719166" strokeWidth="2"/>
          </g></g>
        ) : sport === "Tug of war" ? (
          <g>
            <g stroke="#315a36" strokeLinecap="round"><path d="M150 174v20" strokeWidth="3"/><path d="M92 168v20M208 168v20" strokeWidth="2" strokeDasharray="3 4" opacity=".45"/></g>
            <g className="equipment-primary">
              <path d="M16 120q134 9 268 0" stroke="#947046" strokeWidth="15" strokeLinecap="round"/>
              <path d="M16 118q134 9 268 0" stroke="#ead0a0" strokeWidth="9" strokeDasharray="4 5" strokeLinecap="round"/>
              <path d="M10 114l-6-4m6 10H2m8 6-6 4M290 114l6-4m-6 10h8m-8 6 6 4" stroke="#947046" strokeWidth="2" strokeLinecap="round"/>
              <g transform="translate(46 120)"><rect x="-12" y="-19" width="24" height="38" rx="10" fill={paint("green")} stroke="#193920" strokeWidth="1"/><path d="M-12-6h24M-12 4h24M-12 13h24" stroke="#fffff5" strokeWidth="1" opacity=".35"/><rect x="-12" y="15" width="24" height="5" rx="2" fill="#d9f46b"/></g><g transform="translate(78 120)"><rect x="-12" y="-19" width="24" height="38" rx="10" fill={paint("green")} stroke="#193920" strokeWidth="1"/><path d="M-12-6h24M-12 4h24M-12 13h24" stroke="#fffff5" strokeWidth="1" opacity=".35"/><rect x="-12" y="15" width="24" height="5" rx="2" fill="#d9f46b"/></g><g transform="translate(222 120) scale(-1 1)"><rect x="-12" y="-19" width="24" height="38" rx="10" fill={paint("orange")} stroke="#a75030" strokeWidth="1"/><path d="M-12-6h24M-12 4h24M-12 13h24" stroke="#fffff5" strokeWidth="1" opacity=".35"/><rect x="-12" y="15" width="24" height="5" rx="2" fill="#d9f46b"/></g><g transform="translate(254 120) scale(-1 1)"><rect x="-12" y="-19" width="24" height="38" rx="10" fill={paint("orange")} stroke="#a75030" strokeWidth="1"/><path d="M-12-6h24M-12 4h24M-12 13h24" stroke="#fffff5" strokeWidth="1" opacity=".35"/><rect x="-12" y="15" width="24" height="5" rx="2" fill="#d9f46b"/></g>
              <g className="tug-flag"><path d="M144 122h12l-1 40-5-7-5 7z" fill={paint("red")}/><path d="M147 126v26" stroke="#f9bf91" strokeWidth="1.5" opacity=".8"/><rect x="141" y="115" width="18" height="10" rx="3" fill="#783d2b"/></g>
            </g>
            <g className="tug-arrows" stroke="#315a36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".55"><path d="M118 80H70m12-11-12 11 12 11"/><path d="M182 80h48m-12-11 12 11-12 11"/></g>
          </g>
        ) : (
          <g className="equipment-primary"><g transform="translate(150 120) rotate(-24)">
            <circle r="77" fill={paint("orange")} stroke="#b96840" strokeWidth="1.5"/>
            <path d="M-74-19q74-24 148 0M-74 19q74 24 148 0" stroke="#bd6039" strokeWidth="7"/>
            <path d="M-74-21q74-24 148 0M-74 17q74 24 148 0" stroke="#ffe5be" strokeWidth="3"/>
            <path d="M-46-46q17-18 41-20" stroke="#ffe5be" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
            <path d="m8-4-16 17h11l-3 12 20-23H8z" fill="#fff3d5" opacity=".8"/>
          </g></g>
        )}
      </g>
      <g className="equipment-speed-lines" stroke="#315a36" strokeWidth="2" strokeLinecap="round" opacity="0"><path d="M35 77H17M30 92H5M34 107H14"/></g>
    </svg>
  );
}
