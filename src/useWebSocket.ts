import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Ticket, WebSocketMessage } from './types';

export const useWebSocket = (url?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 同一オリジンに接続（プロキシ経由）
    const socketUrl = url || 'https://recipient-number-display-app.onrender.com';
    console.log('Connecting to Socket.IO at:', socketUrl);
    
    const newSocket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
      setIsConnected(true);
    });

    newSocket.on('init', (message: WebSocketMessage) => {
      try {
        setTickets(
          Array.isArray(message.data)
            ? (message.data as Ticket[])
            : [message.data as Ticket]
        );
      } catch (err) {
        console.error('Error parsing init message:', err);
      }
    });

    newSocket.on('ticket:update', (message: WebSocketMessage) => {
      try {
        switch (message.type) {
          case 'ticket:created':
            setTickets((prev) => [...prev, message.data as Ticket]);
            break;
          case 'ticket:updated': {
            const updatedTicket = message.data as Ticket;
            setTickets((prev) =>
              prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
            );
            break;
          }
          case 'ticket:deleted': {
            const deletedId = (message.data as any).id;
            setTickets((prev) => prev.filter((t) => t.id !== deletedId));
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing ticket update:', err);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url]);

  return { socket, tickets, isConnected };
};

