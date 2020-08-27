interface ICreateRoomArgs {
  playerName: string;
  playerCount: number;
}

interface ILeaveRoomArgs {
  roomId: string;
}

interface ILeaveGameArgs {
  roomId: string;
}

interface IJoinRoomArgs {
  roomId: string;
  playerName: string;
}

interface IDoMoveArgs {
  roomId: string;
  playerInfo: IPlayerInfo;
  x: number;
  y: number;
}

interface ISkipDeadPlayerArgs {
  roomId: string;
  playerInfo: IPlayerInfo;
}

interface IWinCheckArgs {
  roomId: string;
}


/* Beta specs */
interface IRoomProvider {
  getRoom: (id: string) => IRoom;
  getRoomVolatile: (id: string) => IRoom;
  setRoom: (id: string, updatedRoom: IRoom) => void;
}

interface IPlayerInfo {
  name: string | null;
  idx: number | null | undefined;
}

interface IRoom {
  id: string;
  players: IPlayerStatus[];
  playerCount: number;
  isRunning: boolean;
  isDone: boolean;
  currentPlayerTurn: number;
}

interface IPlayerStatus {
  name: string;
  alive: boolean;
}


