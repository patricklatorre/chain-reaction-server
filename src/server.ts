import express from 'express';
import http from 'http';
import cors from 'cors';
import SocketIO from 'socket.io';
import shortid from 'shortid';
import rp from './room-provider';

const app = express();
const server = http.createServer(app);
const io = SocketIO(server);

app.use(cors());
app.use(express.json());

/**
 * Helper method for evaluating next player.
 * @param roomId 
 * @param playerInfo 
 */
const getNextPlayerIdx = (roomId: string, playerInfo: any) => {
  const room = rp.getRoomVolatile(roomId);

  // Evaluate next player
  let nextPlayerIdx = playerInfo.idx;

  while (true) {
    nextPlayerIdx++;

    if (nextPlayerIdx === playerInfo.idx) {
      console.log(`ERROR: getNextPlayerIdx evaluator has already cycled through all players. No viable candidate for next player.`);
      break;
    }

    if (nextPlayerIdx === room.players.length) {
      nextPlayerIdx = 0;
    }

    if (room.players[nextPlayerIdx].alive) {
      break;
    }
  }

  return nextPlayerIdx;
}

/**
 * SOCKET CONNECTION
 * Client sends "actions" to server. These
 * actions are multiplexed to other clients
 * in the same game.
 */
io.on('connection', (socket) => {

  /**
   * LEAVE_SOCKET_ROOM LISTENER
   * Prevents client from sending/receiving any
   * more data in a game.
   */
  socket.on('leave_socket_room', (args: ILeaveRoomArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  /**
   * CREATE_ROOM LISTENER
   * Creates a new game and sets creator as player 1.
   */
  socket.on('create_room', (args: ICreateRoomArgs) => {
    const { playerName, playerCount = 1 } = args;

    // Sanitize player count
    let cleanPlayerCount = playerCount;
    const minCount = 2;
    const maxCount = 10;

    // Enforce min and max players
    if (typeof playerCount === 'number') {
      if (playerCount < minCount) {
        cleanPlayerCount = minCount;
      } else if (playerCount > maxCount) {
        cleanPlayerCount = maxCount;
      }
    } else {
      cleanPlayerCount = minCount;
    }

    // Remove decimal val
    cleanPlayerCount = Math.trunc(cleanPlayerCount);

    // Generate room id, also used for the invite link
    const newRoomId = shortid.generate();

    // Subscribe client to roomId
    socket.join(newRoomId);

    const firstPlayer: IPlayerStatus = {
      name: playerName,
      alive: true,
    };

    const newRoom: IRoom = {
      id: newRoomId,
      players: [firstPlayer],
      playerCount: cleanPlayerCount,
      isRunning: false,
      isDone: false,
      currentPlayerTurn: 0,
    };

    // Register game
    rp.setRoom(newRoomId, newRoom);

    socket.emit('create_room', newRoom);
  });

  /**
   * JOIN_ROOM
   * Joins a game that has not started yet.
   */
  socket.on('join_room', (args: IJoinRoomArgs) => {
    const { roomId, playerName } = args;
    const room = rp.getRoomVolatile(roomId);

    // Return null if game does not exist or game is full
    if (room === undefined || room.players.length >= room.playerCount) {
      socket.emit('join_room', {
        roomInfo: null
      });

      return;
    }

    const playerIdx = room.players.length;

    socket.join(roomId);

    room.players.push({
      name: playerName,
      alive: true,
    });

    io.to(roomId).emit('join_room', {
      roomInfo: room,
      playerInfo: {
        name: playerName,
        idx: playerIdx,
      },
    });

    // Check if current players === total players
    if (room.players.length === room.playerCount) {
      room.isRunning = true;

      io.to(roomId).emit('start_room', room);
    }
  });

  /**
   * DO_MOVE LISTENER
   * Broadcasts the move and next player.
   */
  socket.on('do_move', (args: IDoMoveArgs) => {
    const { roomId, playerInfo, x, y } = args;
    const room = rp.getRoomVolatile(roomId);

    // Evaluate next player
    room.currentPlayerTurn = getNextPlayerIdx(roomId, playerInfo);

    // Send move to all players (including origin player)
    io.to(roomId).emit('broadcast_move', {
      roomInfo: room,
      playerInfo,
      x,
      y,
    });
  });

  /**
   * LEAVE_ROOM LISTENER
   * Prevents client from sending/receiving any
   * more data in a game.
   */
  socket.on('leave_room', (args: ILeaveRoomArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  /**
   * LEAVE_GAME LISTENER
   * Prevents client from sending/receiving any
   * more data from entire site.
   */
  socket.on('leave_game', (args: ILeaveGameArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
    socket.disconnect();
  });

  /**
   * SKIP_DEAD_PLAYER LISTENER
   * Broadcasts an "empty move" and next player. Also
   * updates player status to alive:false.
   */
  socket.on('skip_dead_player', (args: ISkipDeadPlayerArgs) => {
    const { roomId, playerInfo } = args;
    const room = rp.getRoomVolatile(roomId);

    console.log(`skip_dead_player ${JSON.stringify(playerInfo)}`);

    const idx = playerInfo.idx;
    room.players[idx].alive = false;

    room.currentPlayerTurn = getNextPlayerIdx(roomId, playerInfo);

    io.to(roomId).emit('broadcast_skip', {
      roomInfo: room,
      playerInfo
    });
  });

  /**
   * WIN_CHECK LISTENER
   * Checks if only 1 player remains alive. If so,
   * send declare_winner event to players in the game.
   */
  socket.on('win_check', (args: IWinCheckArgs) => {
    const { roomId } = args;
    const room = rp.getRoomVolatile(roomId);

    const aliveList = room.players
      .filter((player: IPlayerStatus) => player.alive);

    if (aliveList.length === 1) {
      room.isDone = true;
      room.isRunning = false;

      const idx = room.players
        .map((player: IPlayerStatus) => player.alive)
        .indexOf(true);

      io.to(roomId).emit('declare_winner', {
        roomInfo: room,
        playerInfo: {
          name: aliveList[0].name,
          idx: idx,
        }
      });
    }
  });
});

io.on('disconnect', () => console.log('Client has disconnected'));

export default server;
