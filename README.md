# CollabBoard — Real-time Collaborative Whiteboard

A real-time collaborative whiteboard application where multiple users can draw simultaneously. Built with **Node.js**, **Express**, **Socket.IO**, HTML5 Canvas, and vanilla JavaScript.

![CollabBoard Screenshot](https://via.placeholder.com/800x450.png?text=CollabBoard+Preview)

## Features

- **Real-time collaboration** — all drawing actions sync instantly across all connected users
- **Drawing tools**: Pen, Highlighter, Line, Rectangle, Circle, Eraser
- **Color picker** with 8 preset color swatches
- **Brush size** slider (1–50px)
- **Opacity** control (10–100%)
- **Undo** last stroke (Ctrl+Z)
- **Clear canvas** (with confirmation modal) — synced to all users
- **Save as PNG** — exports canvas with white background
- **Live cursor tracking** — see where other users are drawing in real-time
- **User presence** — connected users shown in header with colored avatars
- **Room link copy** — share the URL to invite collaborators
- **Keyboard shortcuts** (P, H, L, R, C, E, [ / ], Ctrl+Z, Ctrl+S)
- **Responsive design** — works on desktop and mobile/tablet
- **New user state sync** — new joiners see the full existing canvas

## Tech Stack

| Layer    | Tech                      |
|----------|---------------------------|
| Runtime  | Node.js                   |
| Server   | Express                   |
| Realtime | Socket.IO (WebSockets)    |
| Frontend | HTML5, CSS3, Canvas API   |
| Logic    | Vanilla JavaScript (ES6+) |

## Getting Started

### Prerequisites
- Node.js >= 18

### Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/collabboard.git
cd collabboard

# Install dependencies
npm install

# Start the server
npm start
# or for dev with auto-reload:
npm run dev
```

Open `http://localhost:3000` in two browser tabs/windows to test collaboration.

## Deployment

### Render (recommended — free tier)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Set:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Environment**: Node
5. Deploy — Render provides a live HTTPS URL

### Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Heroku

```bash
heroku create your-app-name
git push heroku main
```

## Project Structure

```
collabboard/
├── server.js          # Express + Socket.IO server
├── package.json
├── public/
│   ├── index.html     # App shell + toolbar markup
│   ├── style.css      # All styles (responsive)
│   └── app.js         # Canvas drawing + Socket.IO client
└── README.md
```

## How It Works

1. When a client connects, the server sends the full `canvas-state` array (all past draw events) so the new user sees the current whiteboard.
2. Each draw event (stroke point, shape, dot) is emitted via `socket.emit('draw', event)` and broadcast to all other clients.
3. Shapes (line, rect, circle) use a **snapshot + preview** technique — the canvas is saved before dragging, and re-drawn each frame until the pointer is released, then the final shape event is committed.
4. Remote cursors are rendered in a transparent overlay div above the canvas, updated on each `cursor-move` event (throttled to ~30fps).
5. The undo operation sends a request to the server to strip the last stroke from the state array, then re-emits the full state to all clients.

## Keyboard Shortcuts

| Key      | Action           |
|----------|------------------|
| P        | Pen tool         |
| H        | Highlighter tool |
| L        | Line tool        |
| R        | Rectangle tool   |
| C        | Circle tool      |
| E        | Eraser tool      |
| [ / ]    | Decrease/Increase brush size |
| Ctrl+Z   | Undo             |
| Ctrl+S   | Save as PNG      |

## License

MIT
