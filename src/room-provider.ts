/**
 * Stores all the game states
 * as key-value pairs.
 */
const rooms: { [key: string]: IRoom } = {};

const roomProvider: IRoomProvider = {
  getRoom(id: string) {
    return { ...rooms[id] };
  },

  getRoomVolatile(id: string) {
    return rooms[id];
  },

  setRoom(id: string, updatedRoom: IRoom) {
    rooms[id] = updatedRoom;
  },
};

export default roomProvider