export const TUG_LIMIT = 6;
export type TugSide = "left" | "right";
export type TugState = {
  position: number;
  winner: TugSide | null;
  pulls: number;
};
export const INITIAL_TUG: TugState = { position: 0, winner: null, pulls: 0 };
/** An explicit pull only; no timers, automatic advantage or event-data writes. */
export function pullRope(state: TugState, side: TugSide): TugState {
  if (state.winner) return state;
  const position = Math.max(
    -TUG_LIMIT,
    Math.min(TUG_LIMIT, state.position + (side === "left" ? -1 : 1)),
  );
  return {
    position,
    winner:
      position === -TUG_LIMIT
        ? "left"
        : position === TUG_LIMIT
          ? "right"
          : null,
    pulls: state.pulls + 1,
  };
}
