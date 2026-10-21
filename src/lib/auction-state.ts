import type { AuctionState } from './event';

// HTTP responses and command results may arrive in a different order. Never
// replace a newer purse/roster with an older snapshot from an in-flight request.
export function mergeAuctionState(current: AuctionState, incoming: AuctionState): AuctionState {
  if (!Number.isInteger(incoming.version) || incoming.version < 0 || incoming.phase === 'preview') return current;
  return current.phase !== 'preview' && incoming.version < current.version ? current : incoming;
}
