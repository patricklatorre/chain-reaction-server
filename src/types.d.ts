interface IRoomDetails {
  id: string;
  playerCount: number;
  isDone: boolean;
  currentPlayerTurn: number;
}

interface ICreateRoomArgs {
  playerCount: number;
}
