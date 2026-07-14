export enum StateType {
  Lobby,
  GameStartIntro,
  GameStartShowCategories,
  SelectClue,
}

export interface GameState {
  host: string; // host ID
  players: string[]; // list of user IDs. not using Set because socket.io cannot serialize it
  readyForNextState: string[]; // list of user IDs that have correctly acknowledged the current state and are ready to progress
  isReadyForNext: boolean;
  state: StateType;
}
