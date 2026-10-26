import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState({}); // conversationId -> Array of message objects
  const [typingUsers, setTypingUsers] = useState({}); // conversationId -> Array of { id, username, fullName }
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId;

  // 1. Fetch conversations when user logs in
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingConversations(true);
    try {
      const data = await api.get('/api/conversations');
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 2. Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const data = await api.get(`/api/conversations/${conversationId}/messages`);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: data.messages || []
      }));
    } catch (err) {
      console.error(`Failed to load messages for ${conversationId}:`, err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // 3. Select Conversation & Mark as Read
  const selectConversation = useCallback(
    async (convId) => {
      setActiveConversationId(convId);
      if (!convId) return;

      // Join socket room
      if (socket) {
        socket.emit('conversation:join', { conversationId: convId });
      }

      // Mark as read immediately on client & server
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );

      try {
        await api.post(`/api/conversations/${convId}/read`);
      } catch (err) {
        console.warn('Error marking read:', err);
      }

      // Fetch messages
      await fetchMessages(convId);
    },
    [socket, fetchMessages]
  );

  // 4. Send Message
  const sendMessage = async (text) => {
    if (!activeConversationId || !text.trim()) return null;
    try {
      const data = await api.post(`/api/conversations/${activeConversationId}/messages`, {
        text: text.trim()
      });
      // Stop typing on send
      stopTyping(activeConversationId);
      return data.message;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  // 5. Edit Message
  const editMessage = async (messageId, newText) => {
    try {
      const data = await api.put(`/api/messages/${messageId}`, { text: newText.trim() });
      return data.message;
    } catch (err) {
      console.error('Error editing message:', err);
      throw err;
    }
  };

  // 6. Delete Message
  const deleteMessage = async (messageId) => {
    try {
      const data = await api.delete(`/api/messages/${messageId}`);
      return data.message;
    } catch (err) {
      console.error('Error deleting message:', err);
      throw err;
    }
  };

  // 6b. Toggle Emoji Reaction
  const toggleReaction = async (messageId, emoji) => {
    try {
      const data = await api.post(`/api/messages/${messageId}/reactions`, { emoji });
      return data.message;
    } catch (err) {
      console.error('Error toggling reaction:', err);
      throw err;
    }
  };

  // 7. Direct & Group Chat Creation
  const createDirectChat = async (recipientId) => {
    try {
      const data = await api.post('/api/conversations/direct', { recipientId });
      const conv = data.conversation;
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        if (exists) {
          return prev.map((c) => (c.id === conv.id ? conv : c));
        }
        return [conv, ...prev];
      });
      await selectConversation(conv.id);
      return conv;
    } catch (err) {
      console.error('Error creating direct chat:', err);
      throw err;
    }
  };

  const createGroupChat = async ({ name, description, participantIds }) => {
    try {
      const data = await api.post('/api/conversations/group', {
        name,
        description,
        participantIds
      });
      const conv = data.conversation;
      setConversations((prev) => [conv, ...prev]);
      await selectConversation(conv.id);
      return conv;
    } catch (err) {
      console.error('Error creating group chat:', err);
      throw err;
    }
  };

  // 8. Group Member Management
  const updateGroupInfo = async (conversationId, updateData) => {
    try {
      const data = await api.put(`/api/conversations/${conversationId}`, updateData);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? data.conversation : c))
      );
      return data.conversation;
    } catch (err) {
      console.error('Error updating group info:', err);
      throw err;
    }
  };

  const addGroupMember = async (conversationId, userId) => {
    try {
      const data = await api.post(`/api/conversations/${conversationId}/members`, { userId });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? data.conversation : c))
      );
      return data.conversation;
    } catch (err) {
      console.error('Error adding member to group:', err);
      throw err;
    }
  };

  const removeGroupMember = async (conversationId, targetUserId) => {
    try {
      const data = await api.delete(`/api/conversations/${conversationId}/members/${targetUserId}`);
      if (targetUserId === user?.id) {
        // Current user left the group
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? data.conversation : c))
        );
      }
      return data;
    } catch (err) {
      console.error('Error removing group member:', err);
      throw err;
    }
  };

  // 9. Typing Indicators with auto-stop timeout
  const typingTimeoutRef = useRef(null);

  const startTyping = useCallback(
    (convId) => {
      const targetId = convId || activeIdRef.current;
      if (!socket || !targetId) return;

      socket.emit('typing:start', { conversationId: targetId });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(targetId);
      }, 2500);
    },
    [socket]
  );

  const stopTyping = useCallback(
    (convId) => {
      const targetId = convId || activeIdRef.current;
      if (!socket || !targetId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('typing:stop', { conversationId: targetId });
    },
    [socket]
  );

  // 10. Real-time Socket Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ message }) => {
      const currentActive = activeIdRef.current;
      const isCurrent = currentActive === message.conversationId;

      // Update message list
      setMessages((prev) => {
        const existing = prev[message.conversationId] || [];
        if (existing.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [message.conversationId]: [...existing, message]
        };
      });

      // Update conversations list (last message & unread badge)
      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id === message.conversationId) {
            const isMine = message.senderId === user?.id;
            const newUnread = isCurrent || isMine ? 0 : (conv.unreadCount || 0) + 1;
            return {
              ...conv,
              lastMessage: {
                id: message.id,
                text: message.text,
                senderId: message.senderId,
                senderName: message.sender?.fullName || message.sender?.username,
                createdAt: message.createdAt
              },
              unreadCount: newUnread,
              updatedAt: message.createdAt
            };
          }
          return conv;
        });

        // Reorder conversations with newest message first
        return updated.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(a.updatedAt);
          const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(b.updatedAt);
          return timeB - timeA;
        });
      });

      // If active conversation, clear unread on server
      if (isCurrent && message.senderId !== user?.id) {
        api.post(`/api/conversations/${message.conversationId}/read`).catch(() => {});
      }

      // Clear typing indicator for sender
      setTypingUsers((prev) => {
        const list = prev[message.conversationId] || [];
        return {
          ...prev,
          [message.conversationId]: list.filter((u) => u.id !== message.senderId)
        };
      });
    };

    const handleUpdatedMessage = ({ message }) => {
      setMessages((prev) => {
        const list = prev[message.conversationId] || [];
        return {
          ...prev,
          [message.conversationId]: list.map((m) => (m.id === message.id ? message : m))
        };
      });
    };

    const handleDeletedMessage = ({ message }) => {
      setMessages((prev) => {
        const list = prev[message.conversationId] || [];
        return {
          ...prev,
          [message.conversationId]: list.map((m) => (m.id === message.id ? message : m))
        };
      });
    };

    const handleConversationCreated = ({ conversation }) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversation.id);
        if (exists) return prev;
        return [conversation, ...prev];
      });
      socket.emit('conversation:join', { conversationId: conversation.id });
    };

    const handleConversationUpdated = ({ conversation }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? conversation : c))
      );
    };

    const handleConversationRemoved = ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeIdRef.current === conversationId) {
        setActiveConversationId(null);
      }
    };

    const handleTypingStart = ({ conversationId, user: typingUser }) => {
      setTypingUsers((prev) => {
        const currentList = prev[conversationId] || [];
        if (currentList.some((u) => u.id === typingUser.id)) return prev;
        return {
          ...prev,
          [conversationId]: [...currentList, typingUser]
        };
      });
    };

    const handleTypingStop = ({ conversationId, userId }) => {
      setTypingUsers((prev) => {
        const currentList = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: currentList.filter((u) => u.id !== userId)
        };
      });
    };

    const handleMessagesRead = ({ conversationId, readerId, readAt }) => {
      setMessages((prev) => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: list.map((msg) => {
            if (msg.senderId !== readerId) {
              const readBy = msg.readBy || [];
              if (!readBy.some((r) => r.userId === readerId)) {
                return {
                  ...msg,
                  readBy: [...readBy, { userId: readerId, readAt }]
                };
              }
            }
            return msg;
          })
        };
      });
    };

    const handleMessageReaction = ({ messageId, conversationId, reactions }) => {
      setMessages((prev) => {
        const list = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: list.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        };
      });
    };

    const handleUserProfileUpdated = ({ user: updatedUser }) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.type === 'direct' && conv.otherUser?.id === updatedUser.id) {
            return {
              ...conv,
              otherUser: { ...conv.otherUser, ...updatedUser }
            };
          }
          if (conv.type === 'group') {
            const updatedParticipants = conv.participants?.map((p) =>
              p.id === updatedUser.id ? { ...p, ...updatedUser } : p
            );
            return {
              ...conv,
              participants: updatedParticipants
            };
          }
          return conv;
        })
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleUpdatedMessage);
    socket.on('message:deleted', handleDeletedMessage);
    socket.on('messages:read', handleMessagesRead);
    socket.on('message:reaction', handleMessageReaction);
    socket.on('user:profile_updated', handleUserProfileUpdated);
    socket.on('conversation:created', handleConversationCreated);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('conversation:removed', handleConversationRemoved);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleUpdatedMessage);
      socket.off('message:deleted', handleDeletedMessage);
      socket.off('messages:read', handleMessagesRead);
      socket.off('message:reaction', handleMessageReaction);
      socket.off('user:profile_updated', handleUserProfileUpdated);
      socket.off('conversation:created', handleConversationCreated);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('conversation:removed', handleConversationRemoved);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, user?.id]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const currentTypingUsers = activeConversationId ? typingUsers[activeConversationId] || [] : [];

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        activeMessages,
        currentTypingUsers,
        isLoadingConversations,
        isLoadingMessages,
        selectConversation,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        createDirectChat,
        createGroupChat,
        updateGroupInfo,
        addGroupMember,
        removeGroupMember,
        startTyping,
        stopTyping,
        refreshConversations: fetchConversations
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
