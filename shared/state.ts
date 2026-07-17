export enum StateType {
  Lobby,
  GameStartIntro,
  GameStartShowCategories,
  SelectClue,
}

export const StateFriendlyNames: Readonly<Record<StateType, string>> = {
  [StateType.Lobby]: "Lobby",
  [StateType.GameStartIntro]: "Starting game",
  [StateType.GameStartShowCategories]: "Revealing categories...!",
  [StateType.SelectClue]: "Selecting clue",
};

export interface BoardClue {
  value: number;
  question: string | null;
  answer: string | null;
  answered: boolean;
}

export interface BoardCategory {
  name: string;
  clues: BoardClue[];
}

export type GameBoard = BoardCategory[];

export interface GameState {
  host: string; // host ID
  players: string[]; // list of user IDs. not using Set because socket.io cannot serialize it
  readyForNextState: string[]; // list of user IDs that have correctly acknowledged the current state and are ready to progress
  isReadyForNext: boolean;
  state: StateType;

  board: GameBoard;
  currentlyAnswering: [number, number]; // [category index, clue *value*]
  activePlayer: string; // ID of the player selecting the current clue
}
