import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { 
  Terminal as TerminalIcon, 
  Users, 
  UserPlus, 
  Award, 
  MapPin, 
  Copy, 
  CheckCircle2, 
  Circle, 
  LogOut, 
  Key, 
  Activity
} from 'lucide-react';
import 'xterm/css/xterm.css';

// TypeScript Interfaces for States
interface Task {
  id: string;
  name: string;
  taskRole: string;
  points: number;
  hintText: string;
  startDirectory: string;
}

interface Level {
  id: number;
  title: string;
  points: number;
  tasks: Task[];
}

interface Team {
  id: string;
  name: string;
  score: number;
  currentLevelId: number;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  text: string;
  type: 'success' | 'system' | 'info';
}

export default function App() {
  // Auth Session States
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [isLogged, setIsLogged] = useState<boolean>(!!token);
  const [authMode, setAuthMode] = useState<'login' | 'join'>('join');
  
  // Auth Input Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Challenge Progress States
  const [team, setTeam] = useState<Team | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Socket and UI References
  const socketRef = useRef<Socket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cwdRef = useRef<string>('/');
  const commandBufferRef = useRef<string>('');

  // Re-load team stats on load if token exists
  useEffect(() => {
    if (token) {
      localStorage.setItem('jwt_token', token);
      setIsLogged(true);
      initializeSocket(token);
    } else {
      localStorage.removeItem('jwt_token');
      setIsLogged(false);
    }
  }, [token]);

  // Terminal lifecycle hook
  useEffect(() => {
    if (!isLogged || !terminalRef.current) return;

    // Initialize xterm client instance
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#06090e',
        foreground: '#cbd5e1',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#0f172a',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc'
      },
      fontFamily: "'Space Mono', monospace",
      fontSize: 14,
      lineHeight: 1.4,
      convertEol: true
    });
    xtermRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Print welcome banner
    term.writeln('\x1b[1;36mOverTheWire Collaborative Shell Client v1.0.0\x1b[0m');
    term.writeln('Active WebSocket pipeline initialized. Status: \x1b[1;32mCONNECTED\x1b[0m');
    term.writeln('Type \x1b[1;35mhelp\x1b[0m to view instructions, or select a task in the panel to begin.');
    term.writeln('');
    writePrompt();

    // Handle user keystrokes in console
    term.onData((data) => {
      if (!socketRef.current) return;

      const code = data.charCodeAt(0);

      // 1. Enter Key
      if (data === '\r' || data === '\n') {
        const cmd = commandBufferRef.current.trim();
        term.write('\r\n');
        
        if (cmd.length > 0) {
          if (cmd.toLowerCase() === 'help') {
            term.writeln('Custom VFS shell commands simulation:');
            term.writeln('  cd, ls, pwd, cat, mkdir, touch, rm, mv, cp, wc, grep, sort, uniq, chmod, head, tail, nano, vim, clear, find');
            term.writeln('  submit <flag-value>   - submits flag to complete task (e.g. submit flag{...})');
            commandBufferRef.current = '';
            writePrompt();
          } else {
            // Emit execution to backend
            socketRef.current.emit('command:execute', { commandLine: cmd });
            commandBufferRef.current = '';
          }
        } else {
          writePrompt();
        }
      }
      // 2. Backspace (ASCII value 127 or 8)
      else if (code === 127 || code === 8) {
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          term.write('\b \b'); // wipe char visually
        }
      }
      // 3. Normal alphanumeric characters
      else if (code >= 32 && code < 127) {
        commandBufferRef.current += data;
        term.write(data);
      }
    });

    // Resize listeners
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [isLogged]);

  // Socket client initializer
  const initializeSocket = (userToken: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io({
      auth: { token: userToken }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      addLog('Connected to websocket server', 'system');
    });

    // Receive team stats and tasks lists
    socket.on('team:info', (data: { team: Team; level: Level; progress: Record<string, string> }) => {
      setTeam(data.team);
      setLevel(data.level);
      setTasks(data.level.tasks);
      setProgress(data.progress || {});
    });

    // Mounted confirmations callback
    socket.on('task:mounted', (data: { taskId: string; taskName: string; cwd: string; hint: string }) => {
      cwdRef.current = data.cwd;
      setActiveTaskId(data.taskId);
      addLog(`Mounted Task: ${data.taskName}`, 'info');

      if (xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[1;33m[System] Mounted namespace ${data.taskName} successfully.\x1b[0m`);
        if (data.hint) {
          xtermRef.current.writeln(`\x1b[1;36m[Hint] ${data.hint}\x1b[0m`);
        }
        xtermRef.current.write('\r');
        writePrompt();
      }
    });

    // Command runner outputs callback
    socket.on('terminal:output', (data: { stdout: string[]; stderr: string[]; cwd: string; specialAction: any }) => {
      cwdRef.current = data.cwd;

      if (xtermRef.current) {
        // Output standard lines
        if (data.stdout && data.stdout.length > 0) {
          data.stdout.forEach(line => xtermRef.current?.writeln(line));
        }
        // Output error lines
        if (data.stderr && data.stderr.length > 0) {
          data.stderr.forEach(line => xtermRef.current?.writeln(`\x1b[1;31m${line}\x1b[0m`));
        }
        writePrompt();
      }
    });

    socket.on('task:completed', (data: { username: string; taskRole: string; taskId: string; progress: Record<string, string>; score?: number }) => {
      setProgress(data.progress);
      if (data.score !== undefined) {
        setTeam(prev => prev ? { ...prev, score: data.score! } : null);
      }
      addLog(`${data.username} completed ${data.taskRole}!`, 'success');
    });

    // Real-time cooperative promotion
    socket.on('level:advance', (data: { message: string; nextLevelId: number; level: Level; score: number }) => {
      setLevel(data.level);
      setTasks(data.level.tasks);
      setProgress({});
      setActiveTaskId(null);

      if (team) {
        setTeam({
          ...team,
          score: data.score,
          currentLevelId: data.nextLevelId
        });
      }

      addLog(`LEVEL ADVANCED! Moved to Level ${data.nextLevelId}`, 'success');

      if (xtermRef.current) {
        xtermRef.current.writeln('\r\n\x1b[1;42;37m                                        \x1b[0m');
        xtermRef.current.writeln(`\x1b[1;32m[LEVEL UP] ${data.message}\x1b[0m`);
        xtermRef.current.writeln('\x1b[1;42;37m                                        \x1b[0m\r\n');
        writePrompt();
      }
    });

    socket.on('match:completed', (data: { message: string; finalScore: number }) => {
      addLog('GAME COMPLETED! Congratulations!', 'success');
      if (xtermRef.current) {
        xtermRef.current.writeln('\r\n\x1b[1;43;30m========================================\x1b[0m');
        xtermRef.current.writeln(`\x1b[1;33m[CHALLENGE COMPLETED] ${data.message}\x1b[0m`);
        xtermRef.current.writeln('\x1b[1;43;30m========================================\x1b[0m\r\n');
        writePrompt();
      }
    });

    socket.on('error', (err: { message: string }) => {
      addLog(`Error: ${err.message}`, 'system');
    });

    socket.on('disconnect', () => {
      addLog('Websession severed. Sync paused.', 'system');
    });
  };

  // Helper outputs
  const writePrompt = () => {
    if (xtermRef.current) {
      xtermRef.current.write(`\r\x1b[1;32mstudent@overthewire:${cwdRef.current}$ \x1b[0m`);
    }
  };

  const addLog = (text: string, type: 'success' | 'system' | 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setActivityLogs(prev => [
      { id: Math.random().toString(), timestamp, text, type },
      ...prev.slice(0, 20)
    ]);
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !inviteCode) {
      return setAuthError('All fields are required');
    }
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/join-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, inviteCode })
      });
      const data = await res.json();
      if (data.error) {
        setAuthError(data.error);
      } else {
        setToken(data.token);
      }
    } catch (err: any) {
      setAuthError('Joining team failed: ' + err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      return setAuthError('Username and password are required');
    }
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.error) {
        setAuthError(data.error);
      } else {
        setToken(data.token);
      }
    } catch (err: any) {
      setAuthError('Login request failed: ' + err.message);
    }
  };

  const mountTask = (taskId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('task:mount', { taskId });
    }
  };

  const handleCopyCode = () => {
    if (inviteCode || (team as any)?.inviteCode) {
      const code = inviteCode || (team as any).inviteCode;
      navigator.clipboard.writeText(code);
      alert('Invite code copied to clipboard!');
    }
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setToken(null);
    setIsLogged(false);
    setTeam(null);
    setLevel(null);
    setTasks([]);
    setProgress({});
    setActiveTaskId(null);
    setActivityLogs([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header bar */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '12px 24px', 
        background: 'rgba(10, 15, 26, 0.7)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-glass)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon style={{ color: 'var(--cyan)' }} size={24} />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--cyan) 0%, var(--indigo) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
            OverTheWire Team Server
          </h1>
        </div>
        {isLogged && team && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.9rem' }}>
              <Users size={16} style={{ color: 'var(--indigo)' }} />
              <strong>{team.name}</strong>
            </div>
            <button 
              onClick={handleLogout}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '16px', gap: '16px' }}>
        {!isLogged ? (
          /* Auth Panel Container */
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <div className="glass-container" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '24px' }}>
                <button 
                  onClick={() => { setAuthMode('join'); setAuthError(null); }}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authMode === 'join' ? '2px solid var(--cyan)' : 'none', color: authMode === 'join' ? 'var(--cyan)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Join Team
                </button>
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authMode === 'login' ? '2px solid var(--cyan)' : 'none', color: authMode === 'login' ? 'var(--cyan)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Sign In
                </button>
              </div>

              {/* Error boundary */}
              {authError && (
                <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  {authError}
                </div>
              )}

              {authMode === 'join' && (
                <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invite Code</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter Team Code" 
                      style={{ textTransform: 'uppercase' }}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Player Character Username</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. nitin" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Account Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn" style={{ marginTop: '8px' }}>
                    <UserPlus size={16} /> Register & Join Team
                  </button>
                </form>
              )}

              {authMode === 'login' && (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Username</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn" style={{ marginTop: '8px' }}>
                    <Key size={16} /> Access Session
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* Active Dashboard Workspace */
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', width: '100%', height: '100%' }}>
            {/* Sidebar info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Level stats */}
              <div className="glass-container" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '8px' }}>
                  <Award size={18} />
                  <span>{level?.title || 'Level Loading...'}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cumulative Score:</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--jade) 0%, var(--cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {team?.score || 0} pts
                </div>
                {team?.id && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Invite Code:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <code style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--cyan)', padding: '2px 6px', borderRadius: '4px', fontStyle: 'normal', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {(team as any).inviteCode}
                      </code>
                      <button 
                        onClick={handleCopyCode}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        title="Copy Invite Code"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks List */}
              <div className="glass-container" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} /> Level Missions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                  {tasks.map(task => {
                    const isCompleted = progress[task.taskRole] === 'COMPLETED';
                    const isActive = activeTaskId === task.id;

                    return (
                      <div 
                        key={task.id}
                        onClick={() => mountTask(task.id)}
                        style={{ 
                          position: 'relative',
                          background: isCompleted ? 'rgba(16, 185, 129, 0.08)' : isActive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(15, 23, 42, 0.3)',
                          border: `1px solid ${isCompleted ? 'var(--jade)' : isActive ? 'var(--indigo)' : 'var(--border-glass)'}`,
                          borderRadius: '10px',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', color: isCompleted ? 'var(--jade)' : 'var(--indigo)' }}>
                            {task.taskRole}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {task.points} pts
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                          {task.name}
                        </h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.8rem', color: isCompleted ? 'var(--jade)' : 'var(--text-muted)' }}>
                          {isCompleted ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>Solved</span>
                            </>
                          ) : isActive ? (
                            <>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.5s infinite' }} />
                              <span style={{ color: 'var(--cyan)' }}>Running Session</span>
                            </>
                          ) : (
                            <>
                              <Circle size={12} />
                              <span>Click to resolve</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Console log */}
              <div className="glass-container" style={{ padding: '16px', maxHeight: '180px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                  <Activity size={14} style={{ color: 'var(--cyan)' }} />
                  <span>CO-OPERATIVE FEED</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                  {activityLogs.length === 0 ? (
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Awaiting action logs...</span>
                  ) : (
                    activityLogs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ color: 'var(--cyan)', minWidth: '45px' }}>{log.timestamp}</span>
                        <span style={{ 
                          color: log.type === 'success' ? 'var(--jade)' : log.type === 'system' ? 'var(--amber)' : 'var(--text-primary)'
                        }}>
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Terminal Panel */}
            <div className="glass-container" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'rgba(10, 15, 26, 0.5)', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--rose)' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--amber)' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--jade)' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  student@overthewire: {cwdRef.current}
                </div>
                <div></div>
              </div>
              <div style={{ flex: 1, background: '#06090e', position: 'relative' }}>
                <div ref={terminalRef} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
