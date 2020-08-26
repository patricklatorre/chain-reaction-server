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


io.on('connection', (socket) => {

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

  // LEAVE SOCKETIO ROOM
  socket.on('leave_socket_room', (args: ILeaveRoomArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  // CREATE A ROOM
  socket.on('create_room', (args: ICreateRoomArgs) => {
    const { playerName, playerCount = 1 } = args;

    let cleanPlayerCount = playerCount;

    if (typeof playerCount === 'number') {
      if (playerCount < 2) {
        cleanPlayerCount = 2;
      } else if (playerCount > 4) {
        cleanPlayerCount = 4;
      }
    } else {
      cleanPlayerCount = 2;
    }

    cleanPlayerCount = Math.trunc(cleanPlayerCount);

    const newRoomId = shortid.generate();

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

    rp.setRoom(newRoomId, newRoom);

    socket.emit('create_room', newRoom);
  });

  // JOIN A ROOM
  socket.on('join_room', (args: IJoinRoomArgs) => {
    const { roomId, playerName } = args;
    const room = rp.getRoomVolatile(roomId);

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

  socket.on('do_move', (args: IDoMoveArgs) => {
    const { roomId, playerInfo, x, y } = args;
    const room = rp.getRoomVolatile(roomId);

    // Evaluate next player
    room.currentPlayerTurn = getNextPlayerIdx(roomId, playerInfo);

    // Send enemy_move (difference between do_move is it sends entire room_info)
    io.to(roomId).emit('broadcast_move', {
      roomInfo: room,
      playerInfo,
      x,
      y,
    });
  });

  socket.on('leave_room', (args: ILeaveRoomArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  socket.on('leave_game', (args: ILeaveGameArgs) => {
    const { roomId } = args;
    socket.leave(roomId);
    socket.disconnect();
  });

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
