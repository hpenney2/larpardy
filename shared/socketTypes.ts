import { GameState } from "./state";

export interface ServerToClientEvents {
  stateUpdate: (state: GameState) => void;
}

export interface ClientToServerEvents {
  ready: () => void;
}
