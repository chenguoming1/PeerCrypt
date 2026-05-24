import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface Client {
  id: string;
  name: string;
  roomId: string;
  ws: WebSocket;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Real-time peer tracking
  const clients = new Map<string, Client>();

  // Initialize WebSocket Signaler on the same HTTP server
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let clientId = "";
    let clientRoomId = "";

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case "join": {
            clientId = data.senderId;
            clientRoomId = data.roomId;
            
            // Set up client tracking
            clients.set(clientId, {
              id: clientId,
              name: data.senderName || "Anonymous Peer",
              roomId: clientRoomId,
              ws
            });

            // Get all other peers in the same room
            const currentRoomPeers = Array.from(clients.values())
              .filter(c => c.roomId === clientRoomId && c.id !== clientId)
              .map(c => ({ id: c.id, name: c.name }));

            // Notify everyone in the room that a new peer has joined
            broadcastToRoom(clientRoomId, {
              type: "peer-joined",
              peerId: clientId,
              peerName: data.senderName || "Anonymous Peer",
              peersInRoom: currentRoomPeers
            }, clientId);

            // Send back peer list and configuration to the joiner
            ws.send(JSON.stringify({
              type: "welcome",
              peerId: clientId,
              peersInRoom: currentRoomPeers
            }));
            
            console.log(`[WS] Client ${clientId} joined room: ${clientRoomId}`);
            break;
          }

          case "signal": {
            // Forward Signaling data (SDP offer, SDP answer, ICE candidate)
            // This is strictly a secure broker - forwarding E2EE encrypted SDP/candidates directly to the target peer!
            if (data.targetId) {
              const target = clients.get(data.targetId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                  type: "signal",
                  senderId: clientId,
                  senderName: clients.get(clientId)?.name || "Peer",
                  payload: data.payload
                }));
              }
            }
            break;
          }

          case "direct-message": {
            // E2EE encrypted chat message / chunk sharing broker
            const room = clients.get(clientId)?.roomId;
            if (room) {
              broadcastToRoom(room, {
                type: "encrypted-message",
                senderId: clientId,
                senderName: clients.get(clientId)?.name || "Peer",
                payload: data.payload, // iv, ciphertext, salt, fileMetadata
                isDirectOnly: data.isDirectOnly || false
              }, clientId);
            }
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          default:
            console.warn(`[WS] Unknown message type: ${data.type}`);
        }
      } catch (err) {
        console.error("[WS] Error parsing websocket message", err);
      }
    });

    ws.on("close", () => {
      if (clientId && clients.has(clientId)) {
        console.log(`[WS] Client disconnected: ${clientId}`);
        clients.delete(clientId);
        
        // Notify other peers in the room
        if (clientRoomId) {
          broadcastToRoom(clientRoomId, {
            type: "peer-left",
            peerId: clientId
          });
        }
      }
    });

    ws.on("error", (err) => {
      console.error(`[WS] Client error on ${clientId}:`, err);
    });
  });

  // Helper helper to broadcast to other clients in a room
  function broadcastToRoom(roomId: string, messageObj: any, excludeId?: string) {
    const rawMsg = JSON.stringify(messageObj);
    clients.forEach((client) => {
      if (client.roomId === roomId && client.id !== excludeId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(rawMsg);
        }
      }
    });
  }

  // Health check API point
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      wsClientsCount: wss.clients.size
    });
  });

  // Vite Integration for Assets and Dev Support
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[HTTP/WS] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
