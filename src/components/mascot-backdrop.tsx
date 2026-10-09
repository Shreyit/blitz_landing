import type { MascotSport } from "@/lib/mascot-behavior";

/** Original vector grounds: no image downloads, layouts remain crisp at dock size. */
export function MascotBackdrop({ sport }: { sport: MascotSport }) {
  const racket = sport === "Badminton" || sport === "Table tennis";
  return (
    <svg
      className="bolt-backdrop"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="400" height="400" rx="32" fill="var(--bolt-ground)" />
      <circle cx="330" cy="64" r="26" fill="#fffff5" opacity=".6" />
      <path
        d="M0 114q80-34 151 0t249 0v70H0z"
        fill="var(--bolt-horizon)"
        opacity=".24"
      />
      <g fill="none" stroke="#fffff5" strokeWidth="2" opacity=".65">
        <path d="M40 180h320l65 195H-25zM0 285h400" />
        {sport === "Football" && (
          <>
            <path d="M200 180v195" />
            <ellipse cx="200" cy="285" rx="61" ry="31" />
            <path d="M47 207h46v132H8M353 207h-46v132h85" />
          </>
        )}
        {sport === "Dodgeball" && (
          <>
            <path d="M200 180v195M35 225h330M0 330h400" />
            <circle cx="75" cy="305" r="13" />
            <circle cx="315" cy="235" r="13" />
          </>
        )}
        {sport === "Cricket" && (
          <>
            <ellipse cx="200" cy="278" rx="176" ry="79" />
            <path d="M166 222h68v113h-68z" />
          </>
        )}
        {racket && (
          <>
            <path d="M85 210h230l32 136H53zM98 253h205M122 210l-9 136M278 210l9 136" />
            <path d="M56 253V133M344 253V133M56 158h288M56 167h288M56 176h288M56 185h288" />
            {[80, 104, 128, 152, 176, 200, 224, 248, 272, 296, 320].map((x) => (
              <path key={x} d={`M${x} 158v27`} />
            ))}
          </>
        )}
        {sport === "Weightlifting" && (
          <path d="M84 230h232v107H84zM110 215h180M110 353h180" />
        )}
        {sport === "Tug of war" && (
          <>
            <path d="M32 268q170-18 336 0M190 259l10 25 10-25M200 285v60" />
            <path d="M66 195v47M332 195v47" />
          </>
        )}
      </g>
      {sport === "Football" && (
        <g stroke="#fffff5" strokeWidth="3" fill="none">
          <path d="M36 166v-59h70v59M36 121h70M36 139h70M53 107v59M72 107v59M90 107v59" />
        </g>
      )}
      {sport === "Weightlifting" && (
        <g transform="translate(295 116) rotate(-12)">
          <path d="M-58 0H58" stroke="#202820" strokeWidth="6" />
          {[-42, -28, 28, 42].map((x) => (
            <rect
              key={x}
              x={x - 5}
              y="-25"
              width="10"
              height="50"
              rx="3"
              fill="#466da3"
            />
          ))}
        </g>
      )}
      {sport === "Chess" && (
        <>
          <g transform="translate(86 212) skewX(-12)">
            {Array.from({ length: 32 }, (_, i) => (
              <rect
                key={i}
                x={(i % 8) * 31}
                y={Math.floor(i / 8) * 31}
                width="31"
                height="31"
                fill={(i + Math.floor(i / 8)) % 2 ? "#fffff5" : "#315a36"}
                opacity=".32"
              />
            ))}
          </g>
          <g
            transform="translate(321 115)"
            fill="#fffff5"
            stroke="#315a36"
            strokeWidth="2"
          >
            <circle cy="-18" r="14" />
            <path d="M-8-5h16l8 39h-32zM-21 34h42v10h-42z" />
          </g>
        </>
      )}
      {sport === "Cricket" && (
        <g stroke="#bd6039" strokeWidth="4">
          <path d="M302 160v-39M314 160v-39M326 160v-39M299 120h29" />
          <circle cx="72" cy="136" r="12" fill="#bd6039" />
        </g>
      )}
      {racket && (
        <g transform="translate(320 105) rotate(22)">
          <ellipse
            rx="22"
            ry="30"
            fill="#fffff5"
            stroke="#466da3"
            strokeWidth="4"
          />
          <path
            d="M0 30v35M-13-20v40M0-27v54M13-20v40M-19-10h38M-21 5h42M-17 20h34"
            stroke="#466da3"
            strokeWidth="2"
          />
        </g>
      )}
      {sport === "Dodgeball" && (
        <g
          transform="translate(76 112)"
          stroke="#bd6039"
          fill="#e68b61"
          strokeWidth="2"
        >
          <circle r="23" />
          <path d="M-22 0h44M0-23q-12 24 0 46" fill="none" />
        </g>
      )}
      {sport === "Tug of war" && (
        <g fill="#bd6039">
          <path d="M65 140v40h-2v-40zm0 0h38l-14 12 14 12H65z" />
          <path
            d="M334 140v40h-2v-40zm0 0h-38l14 12-14 12h38z"
            fill="#466da3"
          />
        </g>
      )}
    </svg>
  );
}
