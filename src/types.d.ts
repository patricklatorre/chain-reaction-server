// interface IRoomDetails {
//   id: string;
//   playerCount: number;
//   isDone: boolean;
//   currentPlayerTurn: number;
// }

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
  playerInfo: any;
  x: number;
  y: number;
}

interface ISkipDeadPlayerArgs {
  roomId: string;
  playerInfo: any;
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

interface IChainpopServices {

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


