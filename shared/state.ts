export enum StateType {
  Lobby,
  GameStartIntro,
  GameStartShowCategories,
  SelectClue,
  AnsweringClue,
  BuzzedIn,
  GameOver,
}

export const StateFriendlyNames: Readonly<Record<StateType, string>> = {
  [StateType.Lobby]: "Lobby",
  [StateType.GameStartIntro]: "Starting game",
  [StateType.GameStartShowCategories]: "Revealing categories...!",
  [StateType.SelectClue]: "Selecting clue",
  [StateType.AnsweringClue]: "Answering a question",
  [StateType.BuzzedIn]: "Someone buzzed in!",
  [StateType.GameOver]: "Finishing a game",
};

export interface BoardClue {
  value: number;
  question: string | null;
  answer: string | null;
  revealed: boolean;
  answered: boolean;
}

export interface BoardCategory {
  name: string;
  clues: BoardClue[];
}

export type GameBoard = BoardCategory[];

export interface Scores {
  [user: string]: number;
}

export interface Settings {
  isHostless: boolean; // "hostless" mode (host can play)
}

export const DEFAULT_SETTINGS: Settings = {
  isHostless: false,
};

export interface GameState {
  host: string; // host ID
  players: string[]; // list of user IDs. not using Set because socket.io cannot serialize it
  readyForNextState: string[]; // list of user IDs that have correctly acknowledged the current state and are ready to progress
  isReadyForNext: boolean;
  state: StateType;

  settings: Settings;

  board: GameBoard;
  // visitedClues: { [category: number]: number[] }; // category -> list of clues (by index)
  currentlyAnsweringCategory?: number; // category index
  currentlyAnsweringClue?: number; // clue index
  activePlayer?: string; // ID of the player taking the current action
  score: Scores;

  canBuzzInAt?: number; // unix timestamp when buzzing in is allowed. should only be used by the client if the time offset is added
  buzzedPlayer?: string; // ID of the player who has buzzed in
  buzzedInAt?: number; // unix timestamp when that player buzzed in
  alreadyBuzzed?: string[]; // players who've buzzed in already (and were wrong)
}

/** Time before a player can buzz in milliseconds. */
export const BUZZ_DELAY = 5000;
