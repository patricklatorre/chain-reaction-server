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
app.use(express.static(path.join(__dirname, '../../client/build/')));
app.use(express.json());

// In-memory games
const rooms: any = {};

io.on('connection', (socket) => {

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

    rooms[newRoomId].players.push(playerName);
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
    rooms[roomId].players.push(playerName);

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

    const roomInfo = rooms[roomId];

    console.log('before: ' + rooms[roomId].currentPlayerTurn);

    // Evaluate next player
    rooms[roomId].currentPlayerTurn = (playerInfo.idx < roomInfo.players.length - 1) ?
      (playerInfo.idx + 1) : 0;

    console.log('after: ' + rooms[roomId].currentPlayerTurn);

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
});

io.on('disconnect', () => console.log('Client has disconnected'));

export default server;
