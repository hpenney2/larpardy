import { GameState, Settings, StateType } from "./state";

export interface ServerToClientEvents {
  stateUpdate: (state: GameState, callback: () => void) => void;
  showAlert: (text: string) => void;
}

export interface ClientToServerEvents {
  ping: (
    clientTime: number,
    callback: (clientTime: number, serverTime: number) => void,
  ) => void;
  ready: () => void;

  updateSettings: (settings: Settings) => void;
  readyForNext: (current: StateType) => void;
  unreadyForNext: () => void;
  startGame: () => void;
  selectClue: (category: number, clueValue: number) => void;
  buzz: () => void;
}
