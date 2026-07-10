import { GameState } from "./state";

export interface ServerToClientEvents {
  stateUpdate: (state: GameState, callback: () => void) => void;
}

export interface ClientToServerEvents {
  ready: () => void;
}
