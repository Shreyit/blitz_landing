import { useId } from "react";

/** Shared ball artwork in a 200 × 200 coordinate space centred on the origin. */
export function FootballBall() {
  const id = useId().replace(/:/g, "");
  const surface = `football-surface-${id}`;
  const shade = `football-shade-${id}`;
  const clip = `football-clip-${id}`;
  return (
    <g>
      <defs>
        <radialGradient id={surface} cx="32%" cy="24%" r="85%">
          <stop stopColor="#fffefa" />
          <stop offset=".65" stopColor="#eef0e8" />
          <stop offset="1" stopColor="#c2cdc0" />
        </radialGradient>
        <linearGradient id={shade} x1="0" y1="0" x2="1" y2="1">
          <stop offset=".3" stopColor="#202820" stopOpacity="0" />
          <stop offset="1" stopColor="#202820" stopOpacity=".24" />
        </linearGradient>
        <clipPath id={clip}>
          <circle r="98" />
        </clipPath>
      </defs>
      <circle
        r="99"
        fill={`url(#${surface})`}
        stroke="#26362b"
        strokeWidth="2"
      />
      <g clipPath={`url(#${clip})`}>
        <g
          fill="none"
          stroke="#778579"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="M-15-38-14-77M22-20 66-32M15 19 35 64M-23 29-44 68M-46-2-78-16M-14-77 21-84 66-32 84 8 35 64-5 85-44 68-82 27-78-16-59-65-14-77" />
          <path d="M21-84 37-98M66-32 93-48M84 8l16 9M35 64l27 20M-5 85l-6 19M-44 68l-24 11M-82 27l-20 2M-78-16l-22-13M-59-65l-15-15" />
        </g>
        <g
          fill="#26362b"
          stroke="#1d2b22"
          strokeWidth="1.3"
          strokeLinejoin="round"
        >
          <path d="M-15-38 22-20 15 19-23 29-46-2z" />
          <path d="M-14-77-36-94-5-106 37-98 21-84z" />
          <path d="M66-32 93-48 109-15 100 17 84 8z" />
          <path d="M35 64 62 84 35 103-11 104-5 85z" />
          <path d="M-44 68-68 79-94 60-102 29-82 27z" />
          <path d="M-78-16-100-29-96-57-74-80-59-65z" />
        </g>
        <circle r="99" fill={`url(#${shade})`} />
        <path
          d="M-67-49q16-24 43-29"
          stroke="#fffff5"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".72"
          fill="none"
        />
        <path
          d="M-34-6-18-28 11-15"
          stroke="#fffff5"
          strokeWidth="1.5"
          opacity=".14"
          fill="none"
        />
      </g>
    </g>
  );
}
