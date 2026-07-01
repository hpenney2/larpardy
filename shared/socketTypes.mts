export interface ServerToClientEvents {}

export interface ClientToServerEvents {
  ready: (instanceId: string) => void;
}
