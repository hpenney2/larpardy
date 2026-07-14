import { GameState, StateType } from "./state";

export interface ServerToClientEvents {
  stateUpdate: (state: GameState, callback: () => void) => void;
}

export interface ClientToServerEvents {
  ready: () => void;
  readyForNext: (current: StateType) => void;
  unreadyForNext: () => void;
  startGame: () => void;
}
