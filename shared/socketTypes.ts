import { Sounds } from "./sounds";
import { GameState, Settings, StateType } from "./state";

export interface ServerToClientEvents {
  stateUpdate: (state: GameState, callback: () => void) => void;
  showAlert: (text: string) => void;
  playSound: (sound: Sounds) => void;
  shouldShowChangeLog: () => void;
}

export interface ClientToServerEvents {
  ping: (
    clientTime: number,
    callback: (clientTime: number, serverTime: number) => void,
  ) => void;
  ready: () => void;

  updateSettings: (settings: Settings) => void;
  changeHost: (newHost: string) => void;
  readyForNext: (current: StateType) => void;
  unreadyForNext: () => void;
  startGame: () => void;

  selectCustomBoard: (id: string) => void;
  resetBoard: () => void;

  selectClue: (category: number, clueValue: number) => void;
  buzz: () => void;
  correctAnswer: () => void;
  incorrectAnswer: () => void;
  giveUp: () => void;
  revealAnswerHostless: () => void;

  returnToLobby: () => void;
}
