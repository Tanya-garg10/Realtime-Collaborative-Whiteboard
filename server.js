const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store canvas state: array of draw events for new joiners
let canvasState = [];
// Store active users
let users = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Assign a random display name and color
  const userColor = generateColor(socket.id);
  users[socket.id] = {
    id: socket.id,
    name: `User_${socket.id.substring(0, 4)}`,
    color: userColor,
    cursor: { x: 0, y: 0 }
  };

  // Send current canvas state to the newly connected user
  socket.emit('canvas-state', canvasState);

  // Send updated users list to everyone
  io.emit('users-update', Object.values(users));

  // Handle draw events
  socket.on('draw', (data) => {
    // Persist draw event to canvas state
    canvasState.push(data);
    // Broadcast to all OTHER clients
    socket.broadcast.emit('draw', data);
  });

  // Handle cursor movement
  socket.on('cursor-move', (data) => {
    if (users[socket.id]) {
      users[socket.id].cursor = data;
      socket.broadcast.emit('cursor-move', {
        id: socket.id,
        name: users[socket.id].name,
        color: users[socket.id].color,
        x: data.x,
        y: data.y
      });
    }
  });

  // Handle clear canvas
  socket.on('clear-canvas', () => {
    canvasState = [];
    io.emit('clear-canvas');
  });

  // Handle undo (removes last batch of draw events from this user)
  socket.on('undo', () => {
    // Remove the last stroke segment from this user
    const lastIndex = canvasState.map(e => e.userId).lastIndexOf(socket.id);
    if (lastIndex !== -1) {
      // Find the start of this stroke (beginPath marker)
      let start = lastIndex;
      while (start > 0 && canvasState[start - 1].userId === socket.id && canvasState[start].type !== 'begin') {
        start--;
      }
      canvasState.splice(start, lastIndex - start + 1);
    }
    io.emit('canvas-state', canvasState);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete users[socket.id];
    io.emit('users-update', Object.values(users));
    io.emit('user-disconnected', socket.id);
  });
});

// Generate a consistent color from a socket ID
function generateColor(id) {
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#607d8b'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Whiteboard server running at http://localhost:${PORT}`);
});
