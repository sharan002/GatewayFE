import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

/**
 * Shared Socket.IO connection for views that listen to live server events
 * (e.g. WhatsApp template status updates). Reuses one connection per login token.
 */
export function getSocket(): Socket | null {
  const token = localStorage.getItem('crm_token');
  if (!token) return null;

  // Reuse the existing instance (even while it is still connecting / reconnecting).
  if (socketInstance && socketToken === token) return socketInstance;

  if (socketInstance) socketInstance.disconnect(); // token changed (re-login)

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const SOCKET_URL = isLocal ? 'http://localhost:8004' : 'https://gateway.botkovai.in';
  const SOCKET_PATH = isLocal ? '/socket.io' : '/crmgateway/socket.io';

  socketToken = token;
  socketInstance = io(SOCKET_URL, {
    path: SOCKET_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }
}
