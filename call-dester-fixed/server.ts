import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { RoomState, Participant, SharedFile, WSMessage } from './src/types.js';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  userName?: string;
  isAlive?: boolean;
}

const app = express();
const server = http.createServer(app);

// Enable HTTP Server Keep-Alive timeouts for Cloud Run and proxies
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 }); // 100MB max for files

app.use(express.json({ limit: '50mb' }));

// Global single room state
let roomState: RoomState = {
  exists: false,
  roomId: 'dester-main-room',
  creatorId: '',
  controllerId: '',
  participants: [],
  maxParticipants: 3,
  sharedFile: null,
};

// Client connections map: userId -> ExtendedWebSocket
const clients = new Map<string, ExtendedWebSocket>();

function broadcastRoomState() {
  const payload = JSON.stringify({
    type: 'room:state',
    payload: roomState,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function sendToUser(userId: string, message: WSMessage) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// WebSocket Connection Handler
wss.on('connection', (ws: ExtendedWebSocket) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Send initial room state to newly connected client
  ws.send(
    JSON.stringify({
      type: 'room:state',
      payload: roomState,
    })
  );

  ws.on('message', (data: string) => {
    ws.isAlive = true;
    try {
      const msg: WSMessage = JSON.parse(data.toString());

      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }

      switch (msg.type) {
        case 'room:create': {
          const { name, userId } = msg.payload;
          if (roomState.exists) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Комната уже существует.' },
              })
            );
            return;
          }

          ws.userId = userId;
          ws.userName = name;
          clients.set(userId, ws);

          const creator: Participant = {
            id: userId,
            name: name || 'Участник 1',
            isOwner: true,
            cameraOn: true,
            micOn: true,
            joinedAt: Date.now(),
          };

          roomState = {
            exists: true,
            roomId: 'dester-main-room',
            creatorId: userId,
            controllerId: userId,
            participants: [creator],
            maxParticipants: 3,
            sharedFile: null,
          };

          broadcastRoomState();
          break;
        }

        case 'room:join': {
          const { name, userId } = msg.payload;

          if (!roomState.exists) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Комната еще не создана.' },
              })
            );
            return;
          }

          if (roomState.participants.length >= roomState.maxParticipants) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Комната заполнена (максимум 3 участника).' },
              })
            );
            return;
          }

          ws.userId = userId;
          ws.userName = name;
          clients.set(userId, ws);

          // Check if already in participants
          const existingIndex = roomState.participants.findIndex((p) => p.id === userId);
          if (existingIndex === -1) {
            const isOwner = roomState.participants.length === 0;
            const newParticipant: Participant = {
              id: userId,
              name: name || `Участник ${roomState.participants.length + 1}`,
              isOwner: isOwner,
              cameraOn: true,
              micOn: true,
              joinedAt: Date.now(),
            };

            if (isOwner) {
              roomState.creatorId = userId;
              roomState.controllerId = userId;
            }

            roomState.participants.push(newParticipant);
          }

          broadcastRoomState();
          break;
        }

        case 'user:update_media': {
          if (!ws.userId) return;
          const { cameraOn, micOn } = msg.payload;
          const participant = roomState.participants.find((p) => p.id === ws.userId);
          if (participant) {
            participant.cameraOn = cameraOn;
            participant.micOn = micOn;
            broadcastRoomState();
          }
          break;
        }

        case 'webrtc:offer':
        case 'webrtc:answer':
        case 'webrtc:candidate': {
          const { targetId } = msg.payload;
          if (targetId) {
            sendToUser(targetId, {
              type: msg.type,
              payload: {
                ...msg.payload,
                fromId: ws.userId,
              },
            });
          }
          break;
        }

        case 'file:upload': {
          if (!ws.userId) return;
          if (roomState.sharedFile) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Файл уже загружен.' },
              })
            );
            return;
          }

          const fileData: SharedFile = {
            id: 'file-' + Date.now(),
            name: msg.payload.name,
            type: msg.payload.type,
            totalPages: msg.payload.totalPages || 1,
            currentPage: 1,
            dataUrl: msg.payload.dataUrl,
            pagesDataUrls: msg.payload.pagesDataUrls || [],
            uploadedBy: ws.userId,
            uploadedByName: ws.userName || 'Участник',
          };

          roomState.sharedFile = fileData;
          broadcastRoomState();
          break;
        }

        case 'file:remove': {
          if (!ws.userId) return;
          // Only creator, controller, or uploader can remove file
          const isController = ws.userId === roomState.controllerId;
          const isCreator = ws.userId === roomState.creatorId;
          const isUploader = roomState.sharedFile?.uploadedBy === ws.userId;

          if (isController || isCreator || isUploader) {
            roomState.sharedFile = null;
            broadcastRoomState();
          }
          break;
        }

        case 'file:page_change': {
          if (!ws.userId) return;
          // Only the current controller can flip pages
          if (ws.userId !== roomState.controllerId) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'Только управляющий просмотром может переключать страницы.' },
              })
            );
            return;
          }

          if (roomState.sharedFile) {
            const newPage = Math.max(1, Math.min(msg.payload.page, roomState.sharedFile.totalPages));
            roomState.sharedFile.currentPage = newPage;
            broadcastRoomState();
          }
          break;
        }

        case 'control:transfer': {
          if (!ws.userId) return;
          // Only current controller or owner can transfer control
          const isController = ws.userId === roomState.controllerId;
          const isOwner = ws.userId === roomState.creatorId;

          if (!isController && !isOwner) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: 'У вас нет прав для передачи управления.' },
              })
            );
            return;
          }

          const targetUserId = msg.payload.targetUserId;
          const targetUser = roomState.participants.find((p) => p.id === targetUserId);
          if (targetUser) {
            roomState.controllerId = targetUserId;
            broadcastRoomState();
          }
          break;
        }

        case 'room:leave': {
          handleUserDisconnect(ws);
          break;
        }
      }
    } catch (err) {
      console.error('Error parsing WS message:', err);
    }
  });

  ws.on('close', () => {
    handleUserDisconnect(ws);
  });
});

function handleUserDisconnect(ws: ExtendedWebSocket) {
  if (!ws.userId) return;
  const userId = ws.userId;
  
  // If the active socket for this userId is different, do not disconnect the user
  if (clients.get(userId) === ws) {
    clients.delete(userId);
  } else if (clients.has(userId)) {
    return;
  }

  if (!roomState.exists) return;

  roomState.participants = roomState.participants.filter((p) => p.id !== userId);

  // If no participants left, delete room
  if (roomState.participants.length === 0) {
    roomState = {
      exists: false,
      roomId: 'dester-main-room',
      creatorId: '',
      controllerId: '',
      participants: [],
      maxParticipants: 3,
      sharedFile: null,
    };
  } else {
    // If owner disconnected, assign new owner to first remaining participant
    if (roomState.creatorId === userId) {
      roomState.creatorId = roomState.participants[0].id;
      roomState.participants[0].isOwner = true;
    }

    // If controller disconnected, transfer control to owner/first participant
    if (roomState.controllerId === userId) {
      roomState.controllerId = roomState.creatorId || roomState.participants[0].id;
    }
  }

  broadcastRoomState();
}

// Heartbeat ping interval
const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    if (extWs.isAlive === false) {
      handleUserDisconnect(extWs);
      return extWs.terminate();
    }
    extWs.isAlive = false;
    extWs.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // API Health Route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      roomExists: roomState.exists,
      participantsCount: roomState.participants.length,
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Call Dester server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
