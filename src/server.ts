import path from 'path';
import express from 'express';
import http from 'http';
import cors from 'cors';
import SocketIO from 'socket.io';
import shortid from 'shortid';

const app = express();
const server = http.createServer(app);
const io = SocketIO(server);

app.use(cors());
app.use(express.json());

// In-memory games
const rooms: any = {};

io.on('connection', (socket) => {

  const getNextPlayerIdx = (roomId: number, playerInfo: any) => {
    // Evaluate next player
    let nextPlayerIdx = playerInfo.idx;

    while (true) {
      nextPlayerIdx++;

      if (nextPlayerIdx === playerInfo.idx) {
        console.log(`ERROR: getNextPlayerIdx evaluator has already cycled through all players. No viable candidate for next player.`);
        break;
      }

      if (nextPlayerIdx === rooms[roomId].players.length) {
        nextPlayerIdx = 0;
      }

      if (rooms[roomId].players[nextPlayerIdx].alive) {
        break;
      }
    }

    return nextPlayerIdx;
  }

  // LEAVE SOCKETIO ROOM
  socket.on('leave_socket_room', (args: any) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  // CREATE A ROOM
  socket.on('create_room', (args: any) => {
    const { playerName, playerCount = 1 } = args;

    const newRoomId = shortid.generate();

    socket.join(newRoomId);

    rooms[newRoomId] = {
      id: newRoomId,
      players: [],
      playerCount: playerCount,
      isRunning: false,
      isDone: false,
      currentPlayerTurn: 0,
    };

    rooms[newRoomId].players.push({
      name: playerName,
      alive: true,
    });

    socket.emit('create_room', rooms[newRoomId]);
  });

  // JOIN A ROOM
  socket.on('join_room', (args: any) => {
    const { roomId, playerName } = args;

    if (rooms[roomId] === undefined) {
      socket.emit('join_room', {
        roomInfo: null
      });

      return;
    }

    const playerIdx = rooms[roomId].players.length;

    socket.join(roomId);
    rooms[roomId].players.push({
      name: playerName,
      alive: true,
    });

    io.to(roomId).emit('join_room', {
      roomInfo: rooms[roomId],
      playerInfo: {
        name: playerName,
        idx: playerIdx,
      },
    });

    // Check if current players === total players
    if (rooms[roomId].players.length === rooms[roomId].playerCount) {
      rooms[roomId].isRunning = true;

      io.to(roomId).emit('start_room', rooms[roomId]);
    }
  });

  socket.on('do_move', (args: any) => {
    const { roomId, playerInfo, x, y } = args;

    // Evaluate next player
    rooms[roomId].currentPlayerTurn = getNextPlayerIdx(roomId, playerInfo);

    // Send enemy_move (difference between do_move is it sends entire room_info)
    io.to(roomId).emit('broadcast_move', {
      roomInfo: rooms[roomId],
      playerInfo,
      x,
      y,
    });
  });

  socket.on('leave_room', (args: any) => {
    const { roomId } = args;
    socket.leave(roomId);
  });

  socket.on('skip_dead_player', (args: any) => {
    const { roomId, playerInfo } = args;
    console.log(`skip_dead_player ${JSON.stringify(playerInfo)}`);

    const idx = playerInfo.idx;
    rooms[roomId].players[idx].alive = false;

    rooms[roomId].currentPlayerTurn = getNextPlayerIdx(roomId, playerInfo);

    io.to(roomId).emit('broadcast_skip', {
      roomInfo: rooms[roomId],
      playerInfo
    });
  });

  socket.on('win_check', (args: any) => {
    const { roomId } = args;

    const aliveList = rooms[roomId].players
      .filter((player: { name: string, alive: any; }) => player.alive);

    if (aliveList.length === 1) {
      rooms[roomId].isDone = true;
      rooms[roomId].isRunning = false;

      const idx = rooms[roomId].players
        .map((player: { name: string, alive: any; }) => player.alive)
        .indexOf(true);

      io.to(roomId).emit('declare_winner', {
        roomInfo: rooms[roomId],
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
