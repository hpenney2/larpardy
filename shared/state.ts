export enum StateType {
  Lobby,
}

export interface GameState {
  host: string; // host ID
  players: string[]; // list of user IDs. not using Set because socket.io cannot serialize it
  state: StateType;
}
