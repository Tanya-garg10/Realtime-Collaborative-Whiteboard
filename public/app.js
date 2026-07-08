/* =====================================================
   CollabBoard – Real-time Collaborative Whiteboard
   Client Application
   ===================================================== */

(function () {
    'use strict';

    // ───────────────────────────────────────────────
    // DOM references
    // ───────────────────────────────────────────────
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvasContainer');
    const cursorsLayer = document.getElementById('cursorsLayer');
    const sizePreview = document.getElementById('sizePreview');
    const sizeCtx = sizePreview.getContext('2d');

    // Toolbar
    const colorPicker = document.getElementById('colorPicker');
    const colorHex = document.getElementById('colorHex');
    const brushSize = document.getElementById('brushSize');
    const sizeLabel = document.getElementById('sizeLabel');
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityLabel = document.getElementById('opacityLabel');
    const toolBtns = document.querySelectorAll('.tool-btn');
    const swatches = document.querySelectorAll('.swatch');

    // Buttons
    const undoBtn = document.getElementById('undoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const copyRoomBtn = document.getElementById('copyRoomBtn');

    // Header
    const roomIdEl = document.getElementById('roomId');
    const usersAvatars = document.getElementById('usersAvatars');
    const usersCount = document.getElementById('usersCount');
    const connectionStatus = document.getElementById('connectionStatus');
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus.querySelector('.status-text');

    // Modal
    const clearModal = document.getElementById('clearModal');
    const cancelClearBtn = document.getElementById('cancelClearBtn');
    const confirmClearBtn = document.getElementById('confirmClearBtn');

    // Toast
    const toast = document.getElementById('toast');

    // ───────────────────────────────────────────────
    // State
    // ───────────────────────────────────────────────
    let currentTool = 'pen';
    let isDrawing = false;
    let currentColor = '#1a1a2e';
    let currentSize = 4;
    let currentOpacity = 1;
    let lastX = 0;
    let lastY = 0;
    let startX = 0;    // for shapes
    let startY = 0;
    let snapshotBeforeShape = null; // canvas snapshot before shape drag
    let myUserId = null;
    let remoteCursors = {};   // { socketId: domElement }
    let toastTimer = null;

    // ───────────────────────────────────────────────
    // Socket.IO
    // ───────────────────────────────────────────────
    const socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        myUserId = socket.id;
        setConnectionStatus('connected', 'Connected');
        roomIdEl.textContent = window.location.host;
        showToast('Connected to whiteboard');
    });

    socket.on('disconnect', () => {
        setConnectionStatus('disconnected', 'Disconnected');
        showToast('Disconnected — trying to reconnect…');
    });

    socket.on('connect_error', () => {
        setConnectionStatus('disconnected', 'Connection error');
    });

    // Receive full canvas state on join
    socket.on('canvas-state', (events) => {
        clearLocalCanvas();
        events.forEach(replayEvent);
    });

    // Receive a draw event from another user
    socket.on('draw', (data) => {
        replayEvent(data);
    });

    // Another user cleared the canvas
    socket.on('clear-canvas', () => {
        clearLocalCanvas();
        showToast('Canvas cleared by another user');
    });

    // User list updated
    socket.on('users-update', (users) => {
        renderUsers(users);
    });

    // Remote cursor moves
    socket.on('cursor-move', (data) => {
        updateRemoteCursor(data);
    });

    // A user disconnected — remove their cursor
    socket.on('user-disconnected', (id) => {
        removeRemoteCursor(id);
    });

    // ───────────────────────────────────────────────
    // Canvas Sizing
    // ───────────────────────────────────────────────
    function resizeCanvas() {
        // Save current image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const areaRect = container.getBoundingClientRect();
        canvas.width = areaRect.width;
        canvas.height = areaRect.height;
        ctx.putImageData(imageData, 0, 0);
    }

    // Initial size
    const areaRect = container.getBoundingClientRect();
    canvas.width = areaRect.width;
    canvas.height = areaRect.height;

    window.addEventListener('resize', () => {
        resizeCanvas();
    });

    // ───────────────────────────────────────────────
    // Drawing helpers
    // ───────────────────────────────────────────────
    function applyContextSettings(color, size, opacity, tool) {
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = tool === 'highlighter' ? Math.min(opacity * 0.45, 0.5) : opacity;
        if (tool === 'highlighter') {
            ctx.lineWidth = size * 4;
            ctx.lineCap = 'square';
        }
    }

    function clearLocalCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Replay a stored draw event onto the canvas
    function replayEvent(e) {
        if (!e) return;
        switch (e.type) {
            case 'begin':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.restore();
                break;

            case 'move':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.beginPath();
                ctx.moveTo(e.lx, e.ly);
                ctx.lineTo(e.x, e.y);
                ctx.stroke();
                ctx.restore();
                break;

            case 'dot':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;

            case 'line':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.beginPath();
                ctx.moveTo(e.x1, e.y1);
                ctx.lineTo(e.x2, e.y2);
                ctx.stroke();
                ctx.restore();
                break;

            case 'rect':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.strokeRect(e.x, e.y, e.w, e.h);
                ctx.restore();
                break;

            case 'circle':
                ctx.save();
                applyContextSettings(e.color, e.size, e.opacity, e.tool);
                ctx.beginPath();
                ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                break;
        }
    }

    // ───────────────────────────────────────────────
    // Pointer events (mouse + touch)
    // ───────────────────────────────────────────────
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return {
            x: src.clientX - rect.left,
            y: src.clientY - rect.top
        };
    }

    function onPointerDown(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
        startX = pos.x;
        startY = pos.y;

        if (['line', 'rect', 'circle'].includes(currentTool)) {
            // Snapshot the canvas before starting a shape
            snapshotBeforeShape = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return;
        }

        // Pen / highlighter / eraser: emit begin
        const event = {
            type: 'begin',
            tool: currentTool,
            x: pos.x,
            y: pos.y,
            color: currentColor,
            size: currentSize,
            opacity: currentOpacity,
            userId: myUserId
        };
        socket.emit('draw', event);
    }

    function onPointerMove(e) {
        e.preventDefault();
        const pos = getPos(e);

        // Emit cursor position (throttled)
        emitCursor(pos.x, pos.y);

        if (!isDrawing) return;

        if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
            const event = {
                type: 'move',
                tool: currentTool,
                x: pos.x,
                y: pos.y,
                lx: lastX,
                ly: lastY,
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity,
                userId: myUserId
            };
            replayEvent(event);
            socket.emit('draw', event);
            lastX = pos.x;
            lastY = pos.y;
            return;
        }

        // Shape preview: restore snapshot and draw preview
        if (snapshotBeforeShape) {
            ctx.putImageData(snapshotBeforeShape, 0, 0);
        }
        ctx.save();
        applyContextSettings(currentColor, currentSize, currentOpacity, currentTool);

        if (currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (currentTool === 'rect') {
            ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } else if (currentTool === 'circle') {
            const cx = (startX + pos.x) / 2;
            const cy = (startY + pos.y) / 2;
            const rx = Math.abs(pos.x - startX) / 2;
            const ry = Math.abs(pos.y - startY) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    function onPointerUp(e) {
        if (!isDrawing) return;
        isDrawing = false;

        const pos = e.changedTouches
            ? {
                x: e.changedTouches[0].clientX - canvas.getBoundingClientRect().left,
                y: e.changedTouches[0].clientY - canvas.getBoundingClientRect().top
            }
            : getPos(e);

        if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
            // Check if it was just a click (no movement) → draw a dot
            const dx = pos.x - startX;
            const dy = pos.y - startY;
            if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
                const event = {
                    type: 'dot',
                    tool: currentTool,
                    x: pos.x,
                    y: pos.y,
                    color: currentColor,
                    size: currentSize,
                    opacity: currentOpacity,
                    userId: myUserId
                };
                replayEvent(event);
                socket.emit('draw', event);
            }
            return;
        }

        // Commit shape
        let event = null;
        if (currentTool === 'line') {
            event = {
                type: 'line',
                tool: 'line',
                x1: startX, y1: startY,
                x2: pos.x, y2: pos.y,
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity,
                userId: myUserId
            };
        } else if (currentTool === 'rect') {
            event = {
                type: 'rect',
                tool: 'rect',
                x: startX, y: startY,
                w: pos.x - startX,
                h: pos.y - startY,
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity,
                userId: myUserId
            };
        } else if (currentTool === 'circle') {
            const cx = (startX + pos.x) / 2;
            const cy = (startY + pos.y) / 2;
            event = {
                type: 'circle',
                tool: 'circle',
                cx, cy,
                rx: Math.abs(pos.x - startX) / 2,
                ry: Math.abs(pos.y - startY) / 2,
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity,
                userId: myUserId
            };
        }

        if (event) {
            socket.emit('draw', event);
        }
        snapshotBeforeShape = null;
    }

    canvas.addEventListener('mousedown', onPointerDown, { passive: false });
    canvas.addEventListener('mousemove', onPointerMove, { passive: false });
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    // ───────────────────────────────────────────────
    // Cursor broadcasting (throttled to ~30fps)
    // ───────────────────────────────────────────────
    let lastCursorEmit = 0;
    function emitCursor(x, y) {
        const now = Date.now();
        if (now - lastCursorEmit > 33) {
            lastCursorEmit = now;
            socket.emit('cursor-move', { x, y });
        }
    }

    // ───────────────────────────────────────────────
    // Remote cursors
    // ───────────────────────────────────────────────
    function updateRemoteCursor(data) {
        let el = remoteCursors[data.id];
        if (!el) {
            el = document.createElement('div');
            el.className = 'remote-cursor';
            el.innerHTML = `
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path d="M1 1L1 17L5 13L8 21L10 20L7 12L13 12L1 1Z"
            fill="${data.color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div class="remote-cursor-label" style="--color:${data.color}">${escapeHtml(data.name)}</div>
      `;
            cursorsLayer.appendChild(el);
            remoteCursors[data.id] = el;
        }
        el.style.left = data.x + 'px';
        el.style.top = data.y + 'px';
    }

    function removeRemoteCursor(id) {
        if (remoteCursors[id]) {
            remoteCursors[id].remove();
            delete remoteCursors[id];
        }
    }

    // ───────────────────────────────────────────────
    // Users panel
    // ───────────────────────────────────────────────
    function renderUsers(users) {
        usersAvatars.innerHTML = '';
        const max = 5;
        users.slice(0, max).forEach(u => {
            const av = document.createElement('div');
            av.className = 'user-avatar';
            av.style.background = u.color;
            av.title = u.name;
            av.setAttribute('aria-label', u.name);
            av.textContent = u.name.charAt(0).toUpperCase();
            usersAvatars.appendChild(av);
        });
        if (users.length > max) {
            const more = document.createElement('div');
            more.className = 'user-avatar';
            more.style.background = '#6c757d';
            more.title = `${users.length - max} more`;
            more.textContent = `+${users.length - max}`;
            usersAvatars.appendChild(more);
        }
        usersCount.textContent = `${users.length} online`;
    }

    // ───────────────────────────────────────────────
    // Tool selection
    // ───────────────────────────────────────────────
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            currentTool = btn.dataset.tool;
            updateCursorStyle();
        });
    });

    function updateCursorStyle() {
        if (currentTool === 'eraser') {
            const s = currentSize;
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s + 4}' height='${s + 4}'><circle cx='${(s + 4) / 2}' cy='${(s + 4) / 2}' r='${s / 2}' fill='none' stroke='%23999' stroke-width='1.5'/></svg>`;
            canvas.style.cursor = `url("data:image/svg+xml,${svg}") ${(s + 4) / 2} ${(s + 4) / 2}, crosshair`;
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    // ───────────────────────────────────────────────
    // Color
    // ───────────────────────────────────────────────
    colorPicker.addEventListener('input', (e) => {
        setColor(e.target.value);
    });

    swatches.forEach(sw => {
        sw.addEventListener('click', () => {
            setColor(sw.dataset.color);
        });
    });

    function setColor(hex) {
        currentColor = hex;
        colorPicker.value = hex;
        colorHex.textContent = hex;
        swatches.forEach(s => s.classList.toggle('active', s.dataset.color === hex));
        drawSizePreview();
    }

    // ───────────────────────────────────────────────
    // Brush size
    // ───────────────────────────────────────────────
    brushSize.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value, 10);
        sizeLabel.textContent = `${currentSize}px`;
        drawSizePreview();
        updateCursorStyle();
    });

    function drawSizePreview() {
        const s = sizePreview.width;
        sizeCtx.clearRect(0, 0, s, s);
        sizeCtx.beginPath();
        sizeCtx.arc(s / 2, s / 2, Math.min(currentSize / 2, s / 2 - 2), 0, Math.PI * 2);
        sizeCtx.fillStyle = currentColor;
        sizeCtx.globalAlpha = currentOpacity;
        sizeCtx.fill();
        sizeCtx.globalAlpha = 1;
    }
    drawSizePreview();

    // ───────────────────────────────────────────────
    // Opacity
    // ───────────────────────────────────────────────
    opacitySlider.addEventListener('input', (e) => {
        currentOpacity = parseInt(e.target.value, 10) / 100;
        opacityLabel.textContent = `${e.target.value}%`;
        drawSizePreview();
    });

    // ───────────────────────────────────────────────
    // Actions
    // ───────────────────────────────────────────────

    // Undo
    undoBtn.addEventListener('click', () => {
        socket.emit('undo');
        showToast('Undo sent');
    });

    // Clear
    clearBtn.addEventListener('click', () => {
        clearModal.hidden = false;
    });

    cancelClearBtn.addEventListener('click', () => {
        clearModal.hidden = true;
    });

    clearModal.addEventListener('click', (e) => {
        if (e.target === clearModal) clearModal.hidden = true;
    });

    confirmClearBtn.addEventListener('click', () => {
        socket.emit('clear-canvas');
        clearLocalCanvas();
        clearModal.hidden = true;
        showToast('Canvas cleared');
    });

    // Save
    saveBtn.addEventListener('click', () => {
        // Composite: white background + drawing
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offCtx = offscreen.getContext('2d');
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
        offCtx.drawImage(canvas, 0, 0);

        const link = document.createElement('a');
        link.download = `collabboard-${Date.now()}.png`;
        link.href = offscreen.toDataURL('image/png');
        link.click();
        showToast('Saved as PNG');
    });

    // Copy room link
    copyRoomBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            showToast('Room link copied!');
        }).catch(() => {
            showToast('Could not copy link');
        });
    });

    // ───────────────────────────────────────────────
    // Keyboard shortcuts
    // ───────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.target !== document.body && e.target !== document.documentElement) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); undoBtn.click(); }
            if (e.key === 's') { e.preventDefault(); saveBtn.click(); }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'p': activateTool('pen'); break;
            case 'h': activateTool('highlighter'); break;
            case 'l': activateTool('line'); break;
            case 'r': activateTool('rect'); break;
            case 'c': activateTool('circle'); break;
            case 'e': activateTool('eraser'); break;
            case '[': brushSize.value = Math.max(1, currentSize - 2); brushSize.dispatchEvent(new Event('input')); break;
            case ']': brushSize.value = Math.min(50, currentSize + 2); brushSize.dispatchEvent(new Event('input')); break;
        }
    });

    function activateTool(name) {
        const btn = document.querySelector(`[data-tool="${name}"]`);
        if (btn) btn.click();
    }

    // ───────────────────────────────────────────────
    // Connection status
    // ───────────────────────────────────────────────
    function setConnectionStatus(state, text) {
        statusDot.className = `status-dot ${state}`;
        statusText.textContent = text;
    }
    setConnectionStatus('connecting', 'Connecting…');

    // ───────────────────────────────────────────────
    // Toast
    // ───────────────────────────────────────────────
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ───────────────────────────────────────────────
    // Utility
    // ───────────────────────────────────────────────
    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Initial swatch state
    swatches.forEach(s => s.classList.toggle('active', s.dataset.color === currentColor));

})();
