import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = [
  "#4f46e5","#0891b2","#059669","#d97706","#dc2626",
  "#7c3aed","#db2777","#0284c7","#16a34a","#ca8a04"
];

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function Avatar({ name, size = 32 }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: hashColor(name), color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif"
    }}>{initials}</div>
  );
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STORAGE_KEY = "gchat_rooms";

function getRooms() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveRooms(r) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [tab, setTab] = useState("join");
  const channelRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const broadcast = useCallback((data) => {
    channelRef.current?.postMessage(data);
  }, []);

  const leaveRoom = useCallback(() => {
    if (activeRoom && username) {
      broadcast({ type: "leave", user: username, roomCode: activeRoom.code });
    }
    channelRef.current?.close();
    channelRef.current = null;
    setScreen("lobby");
    setActiveRoom(null);
    setMessages([]);
    setMembers([]);
    setInput("");
  }, [activeRoom, username, broadcast]);

  const enterRoom = useCallback((room, uname) => {
    const ch = new BroadcastChannel(`gchat_${room.code}`);
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const d = e.data;
      if (d.type === "message") {
        setMessages(m => [...m, d]);
      } else if (d.type === "join") {
        setMembers(m => m.includes(d.user) ? m : [...m, d.user]);
        setMessages(m => [...m, {
          type: "system", text: `${d.user} joined the room`, time: ts(), id: Date.now() + Math.random()
        }]);
      } else if (d.type === "leave") {
        setMembers(m => m.filter(x => x !== d.user));
        setMessages(m => [...m, {
          type: "system", text: `${d.user} left the room`, time: ts(), id: Date.now() + Math.random()
        }]);
      } else if (d.type === "ping") {
        setMembers(m => m.includes(d.user) ? m : [...m, d.user]);
      } else if (d.type === "pong") {
        setMembers(m => m.includes(d.user) ? m : [...m, d.user]);
      } else if (d.type === "request_ping") {
        ch.postMessage({ type: "pong", user: uname });
      }
    };

    setMembers([uname]);
    setMessages([{
      type: "system", text: `You joined "${room.name}"`, time: ts(), id: "init"
    }]);
    setActiveRoom(room);
    setScreen("chat");

    setTimeout(() => {
      ch.postMessage({ type: "join", user: uname, time: ts() });
      ch.postMessage({ type: "request_ping", from: uname });
    }, 100);

    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleCreate = () => {
    const uname = nameInput.trim();
    const rname = roomNameInput.trim();
    if (!uname) { setError("Enter your name"); return; }
    if (!rname) { setError("Enter a room name"); return; }
    const code = genCode();
    const room = { code, name: rname, creator: uname };
    const rooms = getRooms();
    rooms[code] = room;
    saveRooms(rooms);
    setUsername(uname);
    setRoomCode(code);
    setRoomName(rname);
    setError("");
    enterRoom(room, uname);
  };

  const handleJoin = () => {
    const uname = nameInput.trim();
    const code = joinInput.trim().toUpperCase();
    if (!uname) { setError("Enter your name"); return; }
    if (code.length < 6) { setError("Enter a valid 6-character room code"); return; }
    const rooms = getRooms();
    const room = rooms[code];
    if (!room) { setError("Room not found. Check the code and try again."); return; }
    setUsername(uname);
    setRoomCode(code);
    setRoomName(room.name);
    setError("");
    enterRoom(room, uname);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !activeRoom) return;
    const msg = {
      type: "message", id: Date.now() + Math.random(),
      user: username, text, time: ts(), self: true
    };
    setMessages(m => [...m, msg]);
    broadcast({ ...msg, self: false });
    setInput("");
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (screen === "chat" && activeRoom) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100vh",
        fontFamily: "'DM Sans', sans-serif", background: "#0f1117", color: "#e2e8f0"
      }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
          borderBottom: "1px solid #1e2433", background: "#0a0d13", flexShrink: 0
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#f1f5f9" }}>
              #{activeRoom.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {members.length} member{members.length !== 1 ? "s" : ""} online
            </div>
          </div>
          <div style={{
            background: "#1e2433", borderRadius: 8, padding: "6px 12px",
            display: "flex", alignItems: "center", gap: 8
          }}>
            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>ROOM CODE</span>
            <span style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#818cf8", fontWeight: 500, letterSpacing: 2 }}>
              {activeRoom.code}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(activeRoom.code)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#64748b", fontSize: 14, padding: "2px 4px", borderRadius: 4,
                lineHeight: 1
              }}
              title="Copy code"
            >⎘</button>
          </div>
          <button
            onClick={leaveRoom}
            style={{
              background: "#1e2433", border: "1px solid #2d3748", borderRadius: 8,
              color: "#94a3b8", padding: "7px 14px", cursor: "pointer",
              fontSize: 13, fontFamily: "'DM Sans', sans-serif"
            }}
          >Leave</button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{
            width: 200, borderRight: "1px solid #1e2433", padding: "16px 12px",
            background: "#0a0d13", overflowY: "auto", flexShrink: 0
          }}>
            <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>
              Members
            </div>
            {members.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={m} size={28} />
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#22c55e", border: "2px solid #0a0d13"
                  }} />
                </div>
                <span style={{
                  fontSize: 13, color: m === username ? "#a5b4fc" : "#cbd5e1",
                  fontWeight: m === username ? 500 : 400
                }}>
                  {m === username ? `${m} (you)` : m}
                </span>
              </div>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {messages.map((msg) => {
                if (msg.type === "system") {
                  return (
                    <div key={msg.id} style={{
                      textAlign: "center", fontSize: 12, color: "#475569",
                      padding: "6px 0", margin: "2px 0"
                    }}>{msg.text}</div>
                  );
                }
                const isSelf = msg.user === username;
                return (
                  <div key={msg.id} style={{
                    display: "flex", gap: 10, marginBottom: 14,
                    flexDirection: isSelf ? "row-reverse" : "row",
                    alignItems: "flex-end"
                  }}>
                    {!isSelf && <Avatar name={msg.user} size={30} />}
                    <div style={{ maxWidth: "70%" }}>
                      {!isSelf && (
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, paddingLeft: 2 }}>
                          {msg.user}
                        </div>
                      )}
                      <div style={{
                        background: isSelf ? "#4f46e5" : "#1e2433",
                        color: "#f1f5f9", padding: "9px 14px",
                        borderRadius: isSelf ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        fontSize: 14, lineHeight: 1.5, wordBreak: "break-word"
                      }}>{msg.text}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 3, textAlign: isSelf ? "right" : "left", paddingLeft: 2 }}>
                        {msg.time}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "12px 20px 16px", borderTop: "1px solid #1e2433", background: "#0a0d13"
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <Avatar name={username} size={32} />
                <div style={{
                  flex: 1, background: "#1e2433", borderRadius: 12,
                  border: "1px solid #2d3748", display: "flex", alignItems: "center",
                  padding: "2px 6px 2px 12px"
                }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={`Message #${activeRoom.name}…`}
                    rows={1}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      color: "#f1f5f9", fontSize: 14, resize: "none", padding: "8px 0",
                      fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
                      maxHeight: 120, overflowY: "auto"
                    }}
                    onInput={e => {
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    style={{
                      background: input.trim() ? "#4f46e5" : "#1e2433",
                      border: "none", borderRadius: 8, padding: "7px 10px",
                      cursor: input.trim() ? "pointer" : "default",
                      color: input.trim() ? "#fff" : "#475569",
                      fontSize: 16, lineHeight: 1, transition: "background 0.15s",
                      flexShrink: 0
                    }}
                  >↑</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 6, paddingLeft: 42 }}>
                Enter to send · Shift+Enter for new line · Open this page in another tab to simulate multiple users
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", background: "#0f1117", color: "#e2e8f0",
      padding: 20
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16, background: "#4f46e5",
            fontSize: 26, marginBottom: 14
          }}>💬</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "#f1f5f9" }}>GroupChat</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            Real-time group discussions with joining codes
          </p>
        </div>

        <div style={{
          background: "#0a0d13", border: "1px solid #1e2433", borderRadius: 16, padding: 28
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>
              YOUR NAME
            </label>
            <input
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setError(""); }}
              placeholder="e.g. Alice"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#1e2433", border: "1px solid #2d3748",
                borderRadius: 10, padding: "10px 14px",
                color: "#f1f5f9", fontSize: 15, outline: "none",
                fontFamily: "'DM Sans', sans-serif",
                transition: "border-color 0.15s"
              }}
            />
          </div>

          <div style={{
            display: "flex", gap: 4, background: "#1e2433",
            borderRadius: 10, padding: 4, marginBottom: 20
          }}>
            {['join', 'create'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  background: tab === t ? "#4f46e5" : "transparent",
                  color: tab === t ? "#fff" : "#64748b",
                  transition: "all 0.15s"
                }}
              >
                {t === "join" ? "Join a Room" : "Create Room"}
              </button>
            ))}
          </div>

          {tab === "join" ? (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                ROOM CODE
              </label>
              <input
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value.toUpperCase()); setError(""); }}
                placeholder="e.g. A3X7K2"
                maxLength={6}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#1e2433", border: "1px solid #2d3748",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#818cf8", fontSize: 18, outline: "none",
                  fontFamily: "'DM Mono', monospace", letterSpacing: 4,
                  marginBottom: 16
                }}
              />
              {error && (
                <div style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{error}</div>
              )}
              <button
                onClick={handleJoin}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                  background: "#4f46e5", color: "#fff", fontSize: 15, fontWeight: 500,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "opacity 0.15s"
                }}
              >Join Room →</button>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                ROOM NAME
              </label>
              <input
                value={roomNameInput}
                onChange={e => { setRoomNameInput(e.target.value); setError(""); }}
                placeholder="e.g. Design Team"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#1e2433", border: "1px solid #2d3748",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#f1f5f9", fontSize: 15, outline: "none",
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 16
                }}
              />
              {error && (
                <div style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{error}</div>
              )}
              <button
                onClick={handleCreate}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                  background: "#4f46e5", color: "#fff", fontSize: 15, fontWeight: 500,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
                }}
              >Create Room →</button>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 20, background: "#0a0d13", border: "1px solid #1e2433",
          borderRadius: 12, padding: "14px 18px"
        }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginBottom: 8 }}>
            HOW IT WORKS
          </div>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
            1. Create a room to get a 6-character code<br />
            2. Share the code with others<br />
            3. Open this page in multiple tabs to test group chat<br />
            4. Backed by BroadcastChannel API (same browser) — replace with Django Channels for production
          </div>
        </div>
      </div>
    </div>
  );
}
