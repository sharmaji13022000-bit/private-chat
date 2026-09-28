const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Har room ki chats ko memory me save rakhne ke liye
const roomMessages = new Map();

io.on('connection', (socket) => {
  socket.on('join-room', ({ username, roomId }) => {
    // Ab koi limit nahi hai, kitne bhi users connect ho sakte hain
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    // Purani chat history naye user ko bhejo
    const previousMessages = roomMessages.get(roomId) || [];
    socket.emit('load-history', previousMessages);

    // Baaki sabhi users ko notification bhejo
    socket.to(roomId).emit('system-message', `${username} chat me jud gaye.`);

    // Naya message aane par save karo aur group ke sabhi logon ko bhejo
    socket.on('send-message', (data) => {
      const msgData = {
        sender: socket.username,
        text: data.text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (!roomMessages.has(roomId)) {
        roomMessages.set(roomId, []);
      }
      roomMessages.get(roomId).push(msgData);

      io.to(roomId).emit('receive-message', msgData);
    });

    // Kisi ke leave karne par
    socket.on('disconnect', () => {
      if (socket.roomId && socket.username) {
        socket.to(socket.roomId).emit('system-message', `${socket.username} offline ho gaye.`);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
