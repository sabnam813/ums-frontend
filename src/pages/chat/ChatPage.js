import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import './Chat.css';

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getConvName(conv, myId) {
  if (conv.type === 'group') return conv.name || 'Group Chat';
  const other = conv.participants?.find(p => (p._id || p) !== myId);
  return other?.name || other?.username || 'Unknown';
}

function getConvInitials(conv, myId) {
  return getInitials(getConvName(conv, myId));
}

function NewChatModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [type, setType] = useState('direct');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

useEffect(() => {
  axios.get('/chat/users')
    .then(r => setUsers(r.data))
    .catch(() => {});
}, []);

  const toggle = (uid) => {
    setSelected(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const canStart = type === 'direct'
    ? selected.length === 1
    : selected.length >= 1;

  const start = async () => {
    if (!canStart) return;
    setLoading(true);
    try {
      const { data } = await axios.post('/chat/conversations', {
        type,
        participantIds: selected,
        name: type === 'group' ? groupName : '',
      });
      onCreated(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="chat-modal">
        <h3>Start a Conversation</h3>
        <div className="chat-modal-tabs">
          <button className={`chat-modal-tab ${type === 'direct' ? 'active' : ''}`} onClick={() => { setType('direct'); setSelected([]); }}>
            Direct Message
          </button>
          {user?.role === 'admin' && (
            <button className={`chat-modal-tab ${type === 'group' ? 'active' : ''}`} onClick={() => { setType('group'); setSelected([]); }}>
              Group Chat
            </button>
          )}
        </div>

        {type === 'group' && (
          <div className="chat-modal-group-name">
            <input
              placeholder="Group name (e.g. Visa Team)"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>
        )}

        <div className="chat-modal-user-list">
          {users.length === 0 && <div style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>No users available</div>}
          {users.map(u => (
            <div
              key={u._id}
              className={`chat-modal-user-item ${selected.includes(u._id) ? 'selected' : ''}`}
              onClick={() => type === 'direct' ? setSelected([u._id]) : toggle(u._id)}
            >
              <div className="chat-modal-user-avatar">{getInitials(u.name || u.username)}</div>
              <div>
                <div className="chat-modal-user-name">{u.name || u.username}</div>
                <div className="chat-modal-user-role">{u.role}</div>
              </div>
              {selected.includes(u._id) && (
                <span className="chat-modal-check">✓</span>
              )}
            </div>
          ))}
        </div>

        <div className="chat-modal-actions">
          <button className="chat-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="chat-modal-start" onClick={start} disabled={!canStart || loading}>
            {loading ? 'Starting…' : 'Start Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, myId, showSender, onDelete, onForward, conversations }) {
  const mine = (msg.sender?._id || msg.sender) === myId;
  const [showActions, setShowActions] = useState(false);
  const [showForwardMenu, setShowForwardMenu] = useState(false);

  return (
    <div className={`chat-msg-row ${mine ? 'mine' : 'theirs'}`}>
      {!mine && (
        <div className="chat-msg-avatar">{getInitials(msg.sender?.name || msg.sender?.username || '?')}</div>
      )}
      <div
        className="chat-msg-container"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { setShowActions(false); setShowForwardMenu(false); }}
      >
        {!mine && showSender && (
          <div className="chat-msg-sender-name">{msg.sender?.name || msg.sender?.username}</div>
        )}
        <div className="chat-msg-bubble-wrap">
                    {showActions && mine && (
            <div className="chat-msg-actions">
              <button
                className="chat-msg-action-btn"
                onClick={() => setShowForwardMenu(v => !v)}
                title="Forward"
              >
                ↪
              </button>
              <button
                className="chat-msg-action-btn danger"
                onClick={() => onDelete(msg._id)}
                title="Delete"
              >
                ✕
              </button>
              {showForwardMenu && (
                <div className="chat-forward-menu">
                  <div className="chat-forward-title">Forward to:</div>
                  {conversations?.filter(c => c._id !== (msg.conversationId || '')).map(conv => (
                    <button
                      key={conv._id}
                      className="chat-forward-item"
                      onClick={() => {
                        onForward(msg._id, conv._id);
                        setShowForwardMenu(false);
                      }}
                    >
                      {conv.type === 'group'
                        ? conv.name || 'Group'
                        : conv.participants?.find(p => (p._id || p) !== myId)?.name || 'Unknown'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

                    <div className="chat-msg-bubble">
            {msg.isForwarded && (
              <div className="chat-msg-forwarded-tag">↪ Forwarded</div>
            )}
                        {msg.text}
          </div>
        </div>

                <div className={`chat-msg-time ${mine ? 'mine-time' : ''}`}>
          {formatMsgTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const { conversations, fetchConversations, setUnreadCount, socket, deleteConversation } = useChat();
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConv = useCallback(async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const { data } = await axios.get(`/chat/conversations/${conv._id}/messages`);
      
      const sorted = [...data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(sorted);
      
      axios.get('/chat/unread-count')
  .then(r => setUnreadCount(r.data.count))
  .catch(() => {});
    } catch { setMessages([]); }
    setLoadingMsgs(false);
  }, [setUnreadCount]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleNew = ({ conversationId, message }) => {
      if (activeConv && conversationId === activeConv._id) {
        setMessages(prev => {
          
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    };

    const handleDeleted = ({ conversationId, messageId }) => {
      if (activeConv && conversationId === activeConv._id) {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
    };

    socket.on('new_message', handleNew);
    socket.on('message_deleted', handleDeleted);
    return () => {
      socket.off('new_message', handleNew);
      socket.off('message_deleted', handleDeleted);
    };
  }, [socket, activeConv]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeConv || sending) return;
    const t = text.trim();
    setText('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSending(true);
    try {
      const { data } = await axios.post(`/chat/conversations/${activeConv._id}/messages`, { text: t });
      
      setMessages(prev => {
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
    } catch { console.error('Failed to send message'); }
    setSending(false);
  };

  const deleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await axios.delete(`/chat/conversations/${activeConv._id}/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch { console.error('Failed to delete message'); }
  };

  const forwardMessage = async (msgId, targetConvId) => {
    try {
      await axios.post(`/chat/conversations/${activeConv._id}/forward`, {
        messageId: msgId,
        targetConvId,
      });
      alert('Message forwarded!');
    } catch { console.error('Failed to forward message'); }
  };

  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this entire conversation? This cannot be undone.')) return;
    try {
      await deleteConversation(convId);
      if (activeConv?._id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
    } catch {
      console.error('Failed to delete conversation');
      alert('Failed to delete conversation');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = (conv) => {
    setShowModal(false);
    fetchConversations().then(() => openConv(conv));
  };

  const filteredConvs = conversations.filter(c => {
    const name = getConvName(c, user?._id).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const grouped = [];
  let lastDate = null;
  messages.forEach((msg, i) => {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== lastDate) {
      grouped.push({ type: 'divider', date: d, key: `d-${i}` });
      lastDate = d;
    }
    grouped.push({ type: 'msg', msg, key: msg._id || i });
  });

  const isGroup = activeConv?.type === 'group';

  return (
    <div className="chat-page">
            <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>Messages</h3>
          <button className="chat-new-btn" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New
          </button>
        </div>
        <div className="chat-search-box">
          <input placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="chat-conv-list">
          {filteredConvs.map(conv => {
            const name = getConvName(conv, user?._id);
            const initials = getConvInitials(conv, user?._id);
            const lastMsg = conv.lastMessage?.text || '';
            return (
              <div
                key={conv._id}
                className={`chat-conv-item ${activeConv?._id === conv._id ? 'active' : ''}`}
                onClick={() => openConv(conv)}
              >
                <div className={`chat-conv-avatar ${conv.type === 'group' ? 'group' : ''}`}>{initials}</div>
                <div className="chat-conv-info">
                  <div className="chat-conv-name">{name}</div>
                  {lastMsg && (
                    <div className="chat-conv-last">
                                            {lastMsg.replace(/\n+/g, ' ').slice(0, 60)}
                    </div>
                  )}
                </div>
                <div className="chat-conv-meta">
                  <span className="chat-conv-time">{formatTime(conv.lastMessageAt)}</span>
                  <button
                    className="chat-conv-delete-btn"
                    onClick={(e) => handleDeleteConversation(conv._id, e)}
                    title="Delete conversation"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredConvs.length === 0 && (
            <div style={{ padding: 20, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              No conversations yet
            </div>
          )}
        </div>
      </div>

            <div className="chat-main">
        {!activeConv ? (
          <div className="chat-main-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Select a conversation or start a new one</p>
          </div>
        ) : (
          <>
            <div className="chat-main-header">
              <div className={`chat-main-header-avatar ${isGroup ? 'group' : ''}`}>
                {getConvInitials(activeConv, user?._id)}
              </div>
              <div style={{ flex: 1 }}>
                <div className="chat-main-header-name">{getConvName(activeConv, user?._id)}</div>
                {isGroup && (
                  <div className="chat-main-header-sub">
                    {activeConv.participants?.length} members
                  </div>
                )}
              </div>
              <button
                className="chat-conv-delete-btn header"
                onClick={(e) => handleDeleteConversation(activeConv._id, e)}
                title="Delete conversation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>

            <div className="chat-messages">
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                  Loading messages…
                </div>
              )}
              {!loadingMsgs && grouped.map(item => {
                if (item.type === 'divider') {
                  return (
                    <div className="chat-date-divider" key={item.key}>
                      <span>{item.date}</span>
                    </div>
                  );
                }
                const { msg } = item;
                const mine = (msg.sender?._id || msg.sender) === user?._id;
                const showSender = isGroup && !mine;
                return (
                  <MessageBubble
                    key={item.key}
                    msg={msg}
                    myId={user?._id}
                    showSender={showSender}
                    onDelete={deleteMessage}
                    onForward={forwardMessage}
                    conversations={conversations}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-area">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!text.trim() || sending}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {showModal && <NewChatModal onClose={() => setShowModal(false)} onCreated={handleNewChat} />}
    </div>
  );
}
