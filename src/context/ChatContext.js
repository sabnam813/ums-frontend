import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth, getAccessToken } from './AuthContext';

const ChatContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function ChatProvider({ children }) {
  const { user } = useAuth();

  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState([]);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handler = ({ conversationId, message }) => {
      const myId = user?._id;
      const senderId = message.sender?._id || message.sender;

      if (senderId !== myId) {
        setUnreadCount((c) => c + 1);
      }

      setConversations((prev) =>
        prev
          .map((c) =>
            c._id === conversationId
              ? {
                  ...c,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
          )
      );
    };

    socket.on('new_message', handler);

    const deletedHandler = ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
    };
    socket.on('conversation_deleted', deletedHandler);

    return () => {
      socket.off('new_message', handler);
      socket.off('conversation_deleted', deletedHandler);
    };
  }, [socket, user]);

  const fetchUnread = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await axios.get('/chat/unread-count');
      setUnreadCount(data.count);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const fetchConversations = useCallback(async () => {
    if (!user) return [];

    try {
      const { data } = await axios.get('/chat/conversations');
      setConversations(data);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [user]);

  const deleteConversation = useCallback(async (conversationId) => {
    await axios.delete(`/chat/conversations/${conversationId}`);
    setConversations((prev) => prev.filter((c) => c._id !== conversationId));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        socket,
        unreadCount,
        setUnreadCount,
        conversations,
        setConversations,
        fetchConversations,
        fetchUnread,
        deleteConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}