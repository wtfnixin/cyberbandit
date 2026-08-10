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
  Activity,
  Shield,
  Plus,
  Trash2,
  ArrowLeft
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

  // Admin Session States
  const [isAdminMode] = useState<boolean>(window.location.pathname === '/admin');
  const [isLeaderboardPage] = useState<boolean>(window.location.pathname === '/leaderboard');
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [isAdminLogged, setIsAdminLogged] = useState<boolean>(!!adminToken);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [showAdminLeaderboard, setShowAdminLeaderboard] = useState(false);

  const initializePublicSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io({
      auth: { isPublicLeaderboard: true }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Registered to live public standings gateway');
    });

    socket.on('leaderboard:update', (data: any[]) => {
      setLeaderboard(data);
    });
  };

  useEffect(() => {
    if (isLeaderboardPage) {
      initializePublicSocket();
    }
  }, [isLeaderboardPage]);

  const fetchTeams = async (tokenVal: string) => {
    try {
      const res = await fetch('/api/admin/teams', {
        headers: { 'Authorization': `Bearer ${tokenVal}` }
      });
      const data = await res.json();
      if (!data.error) {
        setAdminTeams(data);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      return setAdminError('Username and password are required');
    }
    setAdminError(null);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (data.error) {
        setAdminError(data.error);
      } else {
        setAdminToken(data.token);
      }
    } catch (err: any) {
      setAdminError('Admin login request failed: ' + err.message);
    }
  };

  const handleAdminLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setAdminToken(null);
    setIsAdminLogged(false);
    setAdminTeams([]);
    setAdminLogs([]);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: newTeamName })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewTeamName('');
        if (adminToken) fetchTeams(adminToken);
      }
    } catch (err: any) {
      alert('Failed to create team: ' + err.message);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? All progress and users will be erased.')) return;

    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        if (adminToken) fetchTeams(adminToken);
      }
    } catch (err: any) {
      alert('Failed to delete team: ' + err.message);
    }
  };

  const addAdminLog = (text: string, type: 'success' | 'system' | 'command') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAdminLogs(prev => [
      { id: Math.random().toString(), timestamp, text, type },
      ...prev.slice(0, 50)
    ]);
  };

  const initializeAdminSocket = (tokenVal: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io({
      auth: { token: tokenVal }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      addAdminLog('Admin Pipeline connected to socket gateway', 'system');
    });

    socket.on('leaderboard:update', (data: any[]) => {
      setLeaderboard(data);
    });

    socket.on('admin:activity:feed', (data: any) => {
      addAdminLog(`[${data.teamName}] ${data.username}: ${data.commandLine}`, 'command');
    });

    socket.on('admin:solve:alert', (data: any) => {
      addAdminLog(`🎉 [${data.teamName}] ${data.username} solved ${data.taskName}! (+${data.pointsAdded} pts)`, 'success');
      fetchTeams(tokenVal);
    });

    socket.on('disconnect', () => {
      addAdminLog('Admin Pipeline severed. Sync offline.', 'system');
    });
  };

  useEffect(() => {
    if (isAdminMode && adminToken) {
      localStorage.setItem('admin_token', adminToken);
      setIsAdminLogged(true);
      fetchTeams(adminToken);
      initializeAdminSocket(adminToken);
    } else {
      localStorage.removeItem('admin_token');
      setIsAdminLogged(false);
    }
  }, [adminToken, isAdminMode]);

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

    socket.on('leaderboard:update', (data: any[]) => {
      setLeaderboard(data);
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

  if (isLeaderboardPage) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#040711',
        fontFamily: 'var(--font-mono), monospace',
        color: '#94a3b8',
        padding: '40px',
        overflowY: 'auto'
      }}>
        {/* Tech Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '20px',
          marginBottom: '40px',
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto 40px auto'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--amber)', letterSpacing: '2px', fontWeight: 'bold' }}>
              // LIVE_STANDINGS_LOGISTICS
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc', marginTop: '4px', letterSpacing: '-0.5px' }}>
              TOURNAMENT LEADERBOARD
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: '#475569' }}>STREAM: </span>
              <span style={{ color: 'var(--jade)', fontWeight: 'bold' }}>ONLINE</span>
            </div>
            <div>
              <span style={{ color: '#475569' }}>SYNC_TYPE: </span>
              <span style={{ color: 'var(--cyan)' }}>REALTIME_PUSH</span>
            </div>
          </div>
        </div>

        {/* Score Grid Table */}
        <div style={{
          margin: '0 auto',
          width: '100%',
          maxWidth: '900px',
          border: '1px solid #1e293b',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '6px',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
        }}>
          {/* Table Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 160px',
            borderBottom: '1px solid #1e293b',
            background: 'rgba(30, 41, 59, 0.3)',
            padding: '16px 32px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            color: '#cbd5e1',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <span>Rank</span>
            <span>Team Identifier</span>
            <span style={{ textAlign: 'right' }}>Score</span>
          </div>

          {/* Table Content */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px', color: '#475569', fontSize: '0.9rem' }}>
                -- NO ACTIVE DATASTREAM DETECTED --
              </div>
            ) : (
              leaderboard.map((entry, index) => {
                const isWinner = index === 0;
                return (
                  <div 
                    key={entry.id || entry.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 160px',
                      borderBottom: index === leaderboard.length - 1 ? 'none' : '1px solid #1e293b',
                      padding: '20px 32px',
                      fontSize: '1.05rem',
                      alignItems: 'center',
                      background: isWinner ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                      color: isWinner ? '#f8fafc' : '#94a3b8'
                    }}
                  >
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: isWinner ? 'var(--amber)' : '#cbd5e1' 
                    }}>
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontWeight: isWinner ? 'bold' : 'normal' }}>
                      {entry.name}
                    </span>
                    <span style={{ 
                      textAlign: 'right', 
                      fontWeight: 'bold',
                      color: isWinner ? 'var(--amber)' : 'var(--cyan)'
                    }}>
                      {entry.score} PTS
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer info line */}
        <div style={{
          textAlign: 'center',
          marginTop: '64px',
          fontSize: '0.75rem',
          color: '#475569',
          letterSpacing: '1.5px',
          textTransform: 'uppercase'
        }}>
          LOGISTICS BROADCAST PROTOCOLS ACTIVE // LIVE FEED SYNCHRONIZED
        </div>
      </div>
    );
  }

  if (isAdminMode) {
    if (showAdminLeaderboard) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: '#040711',
          fontFamily: 'var(--font-mono), monospace',
          color: '#94a3b8',
          padding: '40px',
          overflowY: 'auto'
        }}>
          {/* Small escape button in the top left corner */}
          <button 
            onClick={() => setShowAdminLeaderboard(false)}
            style={{
              position: 'absolute',
              top: '40px',
              left: '40px',
              width: '42px',
              height: '42px',
              borderRadius: '6px',
              background: 'rgba(15, 23, 42, 0.3)',
              border: '1px solid #1e293b',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 100
            }}
            title="Leave Standings - Back to Admin Console"
          >
            <ArrowLeft size={18} style={{ color: '#cbd5e1' }} />
          </button>

          {/* Tech Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '20px',
            marginBottom: '40px',
            maxWidth: '900px',
            width: '100%',
            margin: '0 auto 40px auto'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--amber)', letterSpacing: '2px', fontWeight: 'bold' }}>
                // LIVE_STANDINGS_LOGISTICS
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc', marginTop: '4px', letterSpacing: '-0.5px' }}>
                LIVE LEADERBOARD STANDINGS
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#475569' }}>STREAM: </span>
                <span style={{ color: 'var(--jade)', fontWeight: 'bold' }}>ONLINE</span>
              </div>
              <div>
                <span style={{ color: '#475569' }}>SYNC_TYPE: </span>
                <span style={{ color: 'var(--cyan)' }}>REALTIME_PUSH</span>
              </div>
            </div>
          </div>

          {/* Score Grid Table */}
          <div style={{
            margin: '0 auto',
            width: '100%',
            maxWidth: '900px',
            border: '1px solid #1e293b',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '6px',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Table Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 160px',
              borderBottom: '1px solid #1e293b',
              background: 'rgba(30, 41, 59, 0.3)',
              padding: '16px 32px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              color: '#cbd5e1',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <span>Rank</span>
              <span>Team Identifier</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>

            {/* Table Content */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', color: '#475569', fontSize: '0.9rem' }}>
                  -- NO ACTIVE DATASTREAM DETECTED --
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const isWinner = index === 0;
                  return (
                    <div 
                      key={entry.id || entry.name}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr 160px',
                        borderBottom: index === leaderboard.length - 1 ? 'none' : '1px solid #1e293b',
                        padding: '20px 32px',
                        fontSize: '1.05rem',
                        alignItems: 'center',
                        background: isWinner ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                        color: isWinner ? '#f8fafc' : '#94a3b8'
                      }}
                    >
                      <span style={{ 
                        fontWeight: 'bold', 
                        color: isWinner ? 'var(--amber)' : '#cbd5e1' 
                      }}>
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontWeight: isWinner ? 'bold' : 'normal' }}>
                        {entry.name}
                      </span>
                      <span style={{ 
                        textAlign: 'right', 
                        fontWeight: 'bold',
                        color: isWinner ? 'var(--amber)' : 'var(--cyan)'
                      }}>
                        {entry.score} PTS
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer info line */}
          <div style={{
            textAlign: 'center',
            marginTop: '64px',
            fontSize: '0.75rem',
            color: '#475569',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            LOGISTICS BROADCAST PROTOCOLS ACTIVE // LIVE FEED SYNCHRONIZED
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Admin Header */}
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
            <Shield style={{ color: 'var(--amber)' }} size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--amber) 0%, var(--rose) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
              OverTheWire SUPER ADMIN PANEL
            </h1>
            {isAdminLogged && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--jade)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--jade)', display: 'inline-block' }} />
                Live Sync
              </span>
            )}
          </div>
          {isAdminLogged && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={() => setShowAdminLeaderboard(true)}
                style={{ 
                  background: 'rgba(248, 158, 27, 0.1)', 
                  border: '1px solid rgba(248, 158, 27, 0.25)', 
                  color: 'var(--amber)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Award size={14} />
                <span>Leaderboard</span>
              </button>
              <button 
                onClick={handleAdminLogout}
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
          {!isAdminLogged ? (
            /* Admin Log in block */
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <div className="glass-container" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={22} style={{ color: 'var(--amber)' }} /> Admin Access Gate
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  Secure configurations panel. Enter credentials defined in backend environment settings.
                </p>

                {adminError && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    {adminError}
                  </div>
                )}

                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Username</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Username key" 
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="••••••••" 
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn" style={{ marginTop: '8px', background: 'linear-gradient(135deg, var(--amber) 0%, var(--rose) 100%)', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.2)' }}>
                    Verify & Authenticate
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Admin Core Dashboard Screen */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: '16px', width: '100%', height: '100%' }}>
              
              {/* Column 1: Team stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

                {/* Team Roster Grid list */}
                <div className="glass-container" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} style={{ color: 'var(--cyan)' }} /> Registered Teams ({adminTeams.length})
                  </h3>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {adminTeams.map(t => (
                      <div 
                        key={t.id}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          background: 'rgba(15, 23, 42, 0.3)',
                          border: '1px solid var(--border-glass)',
                          padding: '10px 14px',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Code: <code style={{ color: 'var(--cyan)' }}>{t.inviteCode}</code> | Level {t.currentLevelId}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteTeam(t.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--rose)', cursor: 'pointer', padding: '4px' }}
                          title="Delete Team"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 2: Live Activity Streams */}
              <div className="glass-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity style={{ color: 'var(--cyan)' }} size={16} /> Real-time Activity Telemetry
                </h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {adminLogs.length === 0 ? (
                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Listening for live actions on websocket server...</span>
                  ) : (
                    adminLogs.map(log => (
                      <div 
                        key={log.id} 
                        style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          padding: '8px 12px', 
                          background: log.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : log.type === 'system' ? 'rgba(248, 158, 27, 0.08)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${log.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : log.type === 'system' ? 'rgba(248, 158, 27, 0.2)' : 'var(--border-glass)'}`,
                          borderRadius: '6px'
                        }}
                      >
                        <span style={{ color: 'var(--cyan)' }}>{log.timestamp}</span>
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

              {/* Column 3: Configuration details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Create Team Form */}
                <div className="glass-container" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} style={{ color: 'var(--amber)' }} /> Add New Tournament Team
                  </h3>
                  <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team Identifier Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Red Devils" 
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn" style={{ background: 'linear-gradient(135deg, var(--cyan) 0%, var(--indigo) 100%)' }}>
                      Create Team Profile
                    </button>
                  </form>
                </div>

                {/* DB & Deployment info card */}
                <div className="glass-container" style={{ flex: 1, padding: '20px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                    System Metrics & Access
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <strong>Prisma Client Connector:</strong>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                        PostgreSQL Active
                      </div>
                    </div>
                    <div>
                      <strong>WebSocket Gateway:</strong>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                        admin:room Listening
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.75rem' }}>
                        Instruct players to login at their root URL. Handlers dynamically register player actions instantly.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    );
  }

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
        {isLogged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {team && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                <Users size={16} style={{ color: 'var(--indigo)' }} />
                <strong>{team.name}</strong>
              </div>
            )}
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
