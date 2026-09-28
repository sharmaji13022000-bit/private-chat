const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const roomLimits = new Map();

io.on('connection', (socket) => {
  socket.on('join-room', ({ username, roomId }) => {
    const currentUsers = roomLimits.get(roomId) || 0;

    if (currentUsers >= 2) {
      socket.emit('room-full', 'Is room me pehle se 2 log jud chuke hain.');
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
    roomLimits.set(roomId, currentUsers + 1);

    socket.to(roomId).emit('system-message', `${username} chat me aa chuke hain.`);

    socket.on('send-message', (data) => {
      io.to(roomId).emit('receive-message', {
        sender: socket.username,
        text: data.text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    socket.on('disconnect', () => {
      const users = roomLimits.get(roomId);
      if (users > 1) {
        roomLimits.set(roomId, users - 1);
        socket.to(roomId).emit('system-message', `${username} offline ho gaye.`);
      } else {
        roomLimits.delete(roomId);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));