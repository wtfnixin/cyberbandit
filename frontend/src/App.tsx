import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { 
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
  Trash2,
  ArrowLeft,
  BookOpen,
  Lock,
  Volume2,
  VolumeX,
  Monitor,
  ChevronDown,
  Check,
  HelpCircle,
  X
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

interface CheatSheetItem {
  cmd: string;
  desc: string;
}

interface CheatSheetCategory {
  title: string;
  icon: string;
  items: CheatSheetItem[];
}

const CHEAT_SHEET_CATEGORIES: CheatSheetCategory[] = [
  {
    title: 'File System & Navigation',
    icon: '📁',
    items: [
      { cmd: 'pwd', desc: 'Print current working directory path' },
      { cmd: 'ls -la', desc: 'List all files including hidden dotfiles with details' },
      { cmd: 'cd folder', desc: "Change directory to 'folder'" },
      { cmd: 'cd ..', desc: 'Move up one parent directory' }
    ]
  },
  {
    title: 'Reading & Searching Files',
    icon: '📄',
    items: [
      { cmd: 'cat readme.txt', desc: 'Print text file contents to screen' },
      { cmd: 'cat ./-', desc: "Read a file named '-' using relative pathing" },
      { cmd: 'cat "file with spaces"', desc: 'Read file names containing spaces using quotes' },
      { cmd: 'grep \'keyword\' data.txt', desc: "Search and filter lines containing 'keyword'" }
    ]
  },
  {
    title: 'Finding & Type Inspection',
    icon: '🔍',
    items: [
      { cmd: 'file ./inhere/*', desc: 'Determine file type (ASCII text, binary, PNG)' },
      { cmd: 'find inhere -type f -size 1033c', desc: 'Find files under 1033 bytes in size' },
      { cmd: 'sort data.txt | uniq -u', desc: 'Sort text and print ONLY non-duplicate lines' }
    ]
  },
  {
    title: 'Encodings, Strings & Network',
    icon: '🔐',
    items: [
      { cmd: 'base64 -d encoded.txt', desc: 'Decode Base64 encoded string' },
      { cmd: 'tr \'A-Za-z\' \'N-ZA-Mn-za-m\'', desc: 'Decipher ROT13 text substitution' },
      { cmd: 'strings data.dat | grep \'=\'', desc: 'Extract printable text from binary executable' },
      { cmd: 'nc localhost 1337', desc: 'Connect to local netcat port listener' }
    ]
  }
];

const THEMES = [
  { name: 'Matrix Green', color: '#00ff66', termBg: '#030a05', termFg: '#00ff66' },
  { name: 'Cyber Neon', color: '#00f3ff', termBg: '#070614', termFg: '#00f3ff' },
  { name: 'Hacker Amber', color: '#fbbf24', termBg: '#0f0a04', termFg: '#fbbf24' },
  { name: 'Dark Slate', color: '#38bdf8', termBg: '#090c14', termFg: '#38bdf8' }
];

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

  // UI & Theme States
  const [currentTheme, setCurrentTheme] = useState<string>('Matrix Green');
  const [showThemeDropdown, setShowThemeDropdown] = useState<boolean>(false);
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);
  const [showVault, setShowVault] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [passwordSubmissionInput, setPasswordSubmissionInput] = useState<string>('');
  const [revealedHintsCount, setRevealedHintsCount] = useState<number>(0);
  const [unlockedVaultKeys, setUnlockedVaultKeys] = useState<Record<string, string>>({});

  // Admin Session States
  const [isAdminMode, setIsAdminMode] = useState<boolean>(window.location.pathname === '/admin');
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
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // Admin view management and tasks creator states
  const [adminTab, setAdminTab] = useState<'dashboard' | 'content'>('dashboard');
  const [levelList, setLevelList] = useState<any[]>([]);

  // Create Level Form States
  const [newLevelId, setNewLevelId] = useState('');
  const [newLevelTitle, setNewLevelTitle] = useState('');
  const [newLevelDesc, setNewLevelDesc] = useState('');
  const [newLevelPoints, setNewLevelPoints] = useState('');

  // Create Task Form States
  const [taskLevelId, setTaskLevelId] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskRoleVal, setTaskRoleVal] = useState('TASK_A');
  const [taskStartDir, setTaskStartDir] = useState('/home/student');
  const [taskVfs, setTaskVfs] = useState(JSON.stringify({
    name: "/",
    type: "directory",
    permissions: "755",
    children: {
      home: {
        name: "home",
        type: "directory",
        permissions: "755",
        children: {
          student: {
            name: "student",
            type: "directory",
            permissions: "700",
            children: {}
          }
        }
      }
    }
  }, null, 2));
  const [taskValType, setTaskValType] = useState<'COMMAND' | 'FILE' | 'OUTPUT'>('OUTPUT');
  const [taskValTarget, setTaskValTarget] = useState('');
  const [taskHint, setTaskHint] = useState('');

  // System Announcement Broadcast State
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // Elapsed Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isLogged) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLogged]);

  // Format Elapsed Time as mm:ss
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Sound feedback
  const playClickSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // AudioContext fallback
    }
  };

  // Theme apply effect
  useEffect(() => {
    const themeClass = 'theme-' + currentTheme.toLowerCase().replace(/\s+/g, '-');
    document.body.className = themeClass;

    if (xtermRef.current) {
      const themeObj = THEMES.find(t => t.name === currentTheme) || THEMES[0];
      xtermRef.current.options.theme = {
        background: themeObj.termBg,
        foreground: themeObj.termFg,
        cursor: themeObj.termFg,
        selectionBackground: themeObj.color + '44'
      };
    }
  }, [currentTheme]);

  const handleSelectTheme = (themeName: string) => {
    setCurrentTheme(themeName);
    setShowThemeDropdown(false);
    playClickSound();
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    playClickSound();
    if (xtermRef.current) {
      commandBufferRef.current = command;
      xtermRef.current.write('\r\x1b[K');
      const prompt = `student@overthewire:${cwdRef.current || '/home/student'}$ `;
      xtermRef.current.write(prompt + command);
    }
  };

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

  const fetchLevels = async (tokenVal: string) => {
    try {
      const res = await fetch('/api/admin/levels', {
        headers: { 'Authorization': `Bearer ${tokenVal}` }
      });
      const data = await res.json();
      if (!data.error) {
        setLevelList(data);
      }
    } catch (err) {
      console.error('Failed to fetch levels:', err);
    }
  };

  const handleCreateLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLevelId || !newLevelTitle || !newLevelDesc || !newLevelPoints) {
      alert('All level fields are required');
      return;
    }

    try {
      const res = await fetch('/api/admin/levels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id: Number(newLevelId),
          title: newLevelTitle.trim(),
          description: newLevelDesc.trim(),
          points: Number(newLevelPoints)
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Level created successfully!');
        setNewLevelId('');
        setNewLevelTitle('');
        setNewLevelDesc('');
        setNewLevelPoints('');
        if (adminToken) fetchLevels(adminToken);
      }
    } catch (err: any) {
      alert('Failed to create level: ' + err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskLevelId || !taskName || !taskRoleVal || !taskValTarget) {
      alert('Level, Task Name, Role and Validation Target are required');
      return;
    }

    let parsedVfs;
    try {
      parsedVfs = JSON.parse(taskVfs.trim());
    } catch (err) {
      alert('Invalid VFS JSON layout.');
      return;
    }

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          levelId: Number(taskLevelId),
          name: taskName.trim(),
          taskRole: taskRoleVal,
          startDirectory: taskStartDir.trim(),
          initialVFS: parsedVfs,
          validationType: taskValType,
          validationTarget: taskValTarget.trim(),
          hintText: taskHint.trim()
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Challenge Task created successfully!');
        setTaskName('');
        setTaskValTarget('');
        setTaskHint('');
        if (adminToken) fetchLevels(adminToken);
      }
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim() || !socketRef.current) return;
    socketRef.current.emit('admin:broadcast:alert', { message: broadcastMsg.trim() });
    addAdminLog(`Sent system announcement: "${broadcastMsg.trim()}"`, 'system');
    setBroadcastMsg('');
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
      fetchLevels(adminToken);
      initializeAdminSocket(adminToken);
    } else {
      localStorage.removeItem('admin_token');
      setIsAdminLogged(false);
    }
  }, [adminToken, isAdminMode]);

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

    const themeObj = THEMES.find(t => t.name === currentTheme) || THEMES[0];
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: themeObj.termBg,
        foreground: themeObj.termFg,
        cursor: themeObj.termFg,
        selectionBackground: themeObj.color + '44',
        black: '#0f172a',
        red: '#f43f5e',
        green: '#00ff66',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#00f3ff',
        white: '#f8fafc'
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Space Mono', monospace",
      fontSize: 13,
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
    term.onData((data: string) => {
      playClickSound();
      if (!socketRef.current) return;

      if (data.length > 1) {
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          const charCode = char.charCodeAt(0);
          if (char === '\r' || char === '\n') {
            const cmd = commandBufferRef.current.trim();
            term.write('\r\n');
            if (cmd.length > 0) {
              socketRef.current.emit('command:execute', { commandLine: cmd });
              commandBufferRef.current = '';
            } else {
              writePrompt();
            }
          } else if (charCode >= 32 && charCode < 127) {
            commandBufferRef.current += char;
            term.write(char);
          }
        }
        return;
      }

      const code = data.charCodeAt(0);

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
            socketRef.current.emit('command:execute', { commandLine: cmd });
            commandBufferRef.current = '';
          }
        } else {
          writePrompt();
        }
      }
      else if (code === 127 || code === 8) {
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      }
      else if (code >= 32 && code < 127) {
        commandBufferRef.current += data;
        term.write(data);
      }
    });

    const handleDomPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text) {
        if (terminalRef.current && terminalRef.current.contains(document.activeElement)) {
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            if (char === '\n' || char === '\r') {
              const cmd = commandBufferRef.current.trim();
              term.write('\r\n');
              if (cmd.length > 0) {
                socketRef.current?.emit('command:execute', { commandLine: cmd });
                commandBufferRef.current = '';
              } else {
                writePrompt();
              }
            } else if (charCode >= 32 && charCode < 127) {
              commandBufferRef.current += char;
              term.write(char);
            }
          }
        }
      }
    };
    window.addEventListener('paste', handleDomPaste);

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('paste', handleDomPaste);
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

    socket.on('team:info', (data: { team: Team; level: Level; progress: Record<string, string> }) => {
      setTeam(data.team);
      setLevel(data.level);
      setTasks(data.level.tasks);
      setProgress(data.progress || {});
    });

    socket.on('leaderboard:update', (data: any[]) => {
      setLeaderboard(data);
    });

    socket.on('broadcast:alert', (data: { message: string }) => {
      setAnnouncement(data.message);
      
      if (xtermRef.current) {
        xtermRef.current.writeln(`\r\n\x1b[1;31m[⚠️ SYSTEM ANNOUNCEMENT] ${data.message}\x1b[0m`);
        xtermRef.current.write('\r');
        const prompt = `student@overthewire:${cwdRef.current || '/home/student'}$ `;
        xtermRef.current.write(prompt + commandBufferRef.current);
      }
      addLog(`⚠️ SYSTEM: ${data.message}`, 'system');
    });

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

    socket.on('terminal:output', (data: { stdout: string[]; stderr: string[]; cwd: string; specialAction: any }) => {
      cwdRef.current = data.cwd;

      if (xtermRef.current) {
        if (data.stdout && data.stdout.length > 0) {
          data.stdout.forEach(line => xtermRef.current?.writeln(line));
        }
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
      setUnlockedVaultKeys(prev => ({ ...prev, [data.taskRole]: data.taskId }));
      addLog(`${data.username} completed ${data.taskRole}!`, 'success');
    });

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

  const handlePasswordSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordSubmissionInput.trim()) return;
    if (socketRef.current) {
      socketRef.current.emit('command:execute', { commandLine: `submit ${passwordSubmissionInput.trim()}` });
      setPasswordSubmissionInput('');
      playClickSound();
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-text)', padding: '40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--theme-border)', paddingBottom: '20px', marginBottom: '40px', maxWidth: '900px', width: '100%', margin: '0 auto 40px auto' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--amber)', letterSpacing: '2px', fontWeight: 'bold' }}>// LIVE_STANDINGS_LOGISTICS</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--theme-primary)', marginTop: '4px', letterSpacing: '-0.5px' }}>TOURNAMENT LEADERBOARD</h1>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem' }}>
            <div><span style={{ color: '#475569' }}>STREAM: </span><span style={{ color: 'var(--theme-primary)', fontWeight: 'bold' }}>ONLINE</span></div>
            <div><span style={{ color: '#475569' }}>SYNC_TYPE: </span><span style={{ color: 'var(--cyan)' }}>REALTIME_PUSH</span></div>
          </div>
        </div>

        <div style={{ margin: '0 auto', width: '100%', maxWidth: '900px', border: '1px solid var(--theme-border)', background: 'var(--theme-card-bg)', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 160px', borderBottom: '1px solid var(--theme-border)', background: 'rgba(0, 255, 102, 0.05)', padding: '16px 32px', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <span>Rank</span><span>Team Identifier</span><span style={{ textAlign: 'right' }}>Score</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px', color: '#475569', fontSize: '0.9rem' }}>-- NO ACTIVE DATASTREAM DETECTED --</div>
            ) : (
              leaderboard.map((entry, index) => (
                <div key={entry.id || entry.name} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 160px', borderBottom: '1px solid var(--theme-border)', padding: '20px 32px', fontSize: '1.05rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: index === 0 ? 'var(--amber)' : 'var(--theme-primary)' }}>#{String(index + 1).padStart(2, '0')}</span>
                  <span>{entry.name}</span>
                  <span style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--theme-primary)' }}>{entry.score} PTS</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isAdminMode) {
    if (showAdminLeaderboard) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-text)', padding: '40px', overflowY: 'auto' }}>
          <button 
            onClick={() => setShowAdminLeaderboard(false)}
            style={{ position: 'absolute', top: '40px', left: '40px', width: '42px', height: '42px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--theme-border)', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100 }}
          >
            <ArrowLeft size={18} style={{ color: '#cbd5e1' }} />
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--theme-border)', paddingBottom: '20px', marginBottom: '40px', maxWidth: '900px', width: '100%', margin: '0 auto 40px auto' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--amber)', letterSpacing: '2px', fontWeight: 'bold' }}>// LIVE_STANDINGS_LOGISTICS</div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--theme-text)', marginTop: '4px' }}>LIVE LEADERBOARD STANDINGS</h1>
            </div>
          </div>
          <div style={{ margin: '0 auto', width: '100%', maxWidth: '900px', border: '1px solid var(--theme-border)', background: 'var(--theme-card-bg)', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 160px', borderBottom: '1px solid var(--theme-border)', padding: '16px 32px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <span>Rank</span><span>Team Identifier</span><span style={{ textAlign: 'right' }}>Score</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((entry, index) => (
                <div key={entry.id || entry.name} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 160px', borderBottom: '1px solid var(--theme-border)', padding: '20px 32px', fontSize: '1.05rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: index === 0 ? 'var(--amber)' : 'var(--theme-primary)' }}>#{String(index + 1).padStart(2, '0')}</span>
                  <span>{entry.name}</span>
                  <span style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--theme-primary)' }}>{entry.score} PTS</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'rgba(10, 15, 26, 0.7)', borderBottom: '1px solid var(--theme-border)', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ color: 'var(--amber)' }} size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--rose)', letterSpacing: '-0.5px' }}>OverTheWire SUPER ADMIN PANEL</h1>
            {isAdminLogged && (
              <div style={{ display: 'flex', gap: '8px', marginLeft: '32px' }}>
                <button type="button" onClick={() => setAdminTab('dashboard')} style={{ background: adminTab === 'dashboard' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', border: '1px solid ' + (adminTab === 'dashboard' ? 'rgba(56, 189, 248, 0.3)' : 'transparent'), color: adminTab === 'dashboard' ? 'var(--cyan)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>Dashboard</button>
                <button type="button" onClick={() => { setAdminTab('content'); fetchLevels(adminToken || ''); }} style={{ background: adminTab === 'content' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', border: '1px solid ' + (adminTab === 'content' ? 'rgba(56, 189, 248, 0.3)' : 'transparent'), color: adminTab === 'content' ? 'var(--cyan)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>Challenge Editor</button>
              </div>
            )}
          </div>
          {isAdminLogged && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => setShowAdminLeaderboard(true)} style={{ background: 'rgba(248, 158, 27, 0.1)', border: '1px solid rgba(248, 158, 27, 0.25)', color: 'var(--amber)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={14} /><span>Leaderboard</span>
              </button>
              <button onClick={handleAdminLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          )}
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '16px', gap: '16px' }}>
          {!isAdminLogged ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <div className="glass-container" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--rose)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={22} style={{ color: 'var(--amber)' }} /> Admin Access Gate
                </h2>
                {adminError && <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{adminError}</div>}
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input type="text" className="form-control" placeholder="Username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
                  <input type="password" className="form-control" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                  <button type="submit" className="btn" style={{ marginTop: '8px', background: 'linear-gradient(135deg, var(--amber) 0%, var(--rose) 100%)' }}>Authenticate</button>
                </form>
              </div>
            </div>
          ) : (
            adminTab === 'dashboard' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: '16px', width: '100%', height: '100%' }}>
                <div className="glass-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', color: 'var(--theme-text)' }}>Registered Teams ({adminTeams.length})</h3>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {adminTeams.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--theme-border)', padding: '10px 14px', borderRadius: '8px' }}>
                        <div><strong>{t.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>Code: {t.inviteCode}</span></div>
                        <button onClick={() => handleDeleteTeam(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', color: 'var(--theme-text)' }}>Real-time Activity Telemetry</h3>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    {adminLogs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--theme-border)', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--cyan)' }}>{log.timestamp}</span>
                        <span style={{ color: log.type === 'success' ? 'var(--jade)' : 'var(--theme-text)' }}>{log.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="glass-container" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px' }}>Add New Team</h3>
                    <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" className="form-control" placeholder="Team Name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                      <button type="submit" className="btn">Create Team</button>
                    </form>
                  </div>
                  <div className="glass-container" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--rose)', marginBottom: '16px' }}>Broadcast Alert</h3>
                    <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" className="form-control" placeholder="Alert Message..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
                      <button type="submit" className="btn" style={{ background: 'var(--rose)', color: '#fff' }}>Broadcast</button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', width: '100%', height: '100%' }}>
                <div className="glass-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  <h3>Create New Level</h3>
                  <form onSubmit={handleCreateLevel} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="number" className="form-control" placeholder="Level ID" value={newLevelId} onChange={(e) => setNewLevelId(e.target.value)} />
                    <input type="text" className="form-control" placeholder="Level Title" value={newLevelTitle} onChange={(e) => setNewLevelTitle(e.target.value)} />
                    <input type="text" className="form-control" placeholder="Description" value={newLevelDesc} onChange={(e) => setNewLevelDesc(e.target.value)} />
                    <input type="number" className="form-control" placeholder="Points" value={newLevelPoints} onChange={(e) => setNewLevelPoints(e.target.value)} />
                    <button type="submit" className="btn">Create Level</button>
                  </form>
                </div>
                <div className="glass-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  <h3>Add Task Challenge</h3>
                  <form onSubmit={handleCreateTask} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <select className="form-control" value={taskLevelId} onChange={(e) => setTaskLevelId(e.target.value)} style={{ background: '#0f172a' }}>
                      <option value="">Select Level</option>
                      {levelList.map(l => <option key={l.id} value={l.id}>Level {l.id}: {l.title}</option>)}
                    </select>
                    <input type="text" className="form-control" placeholder="Task Name" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
                    <select className="form-control" value={taskRoleVal} onChange={(e) => setTaskRoleVal(e.target.value)} style={{ background: '#0f172a' }}>
                      <option value="TASK_A">TASK A</option><option value="TASK_B">TASK B</option>
                    </select>
                    <input type="text" className="form-control" value={taskStartDir} onChange={(e) => setTaskStartDir(e.target.value)} />
                    <select className="form-control" value={taskValType} onChange={(e) => setTaskValType(e.target.value as any)} style={{ background: '#0f172a' }}>
                      <option value="OUTPUT">OUTPUT</option><option value="COMMAND">COMMAND</option><option value="FILE">FILE</option>
                    </select>
                    <input type="text" className="form-control" placeholder="Validation Target" value={taskValTarget} onChange={(e) => setTaskValTarget(e.target.value)} />
                    <input type="text" className="form-control" style={{ gridColumn: 'span 2' }} placeholder="Hint Text" value={taskHint} onChange={(e) => setTaskHint(e.target.value)} />
                    <textarea className="form-control" style={{ gridColumn: 'span 2', height: '80px' }} value={taskVfs} onChange={(e) => setTaskVfs(e.target.value)} />
                    <button type="submit" className="btn" style={{ gridColumn: 'span 2' }}>Publish Task</button>
                  </form>
                </div>
              </div>
            )
          )}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      {/* Navigation Header matching Screenshot 1 & 3 */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'rgba(3, 10, 5, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--theme-border)',
        zIndex: 50
      }}>
        {/* Left Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'rgba(0, 255, 102, 0.15)',
            border: '1px solid var(--theme-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Shield style={{ color: 'var(--theme-primary)' }} size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>
              OVERTHEWIRE CYBERBANDIT
            </h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', letterSpacing: '0.5px' }}>
              Fresher Linux CTF Edition • {level?.title || 'Interactive Shell'}
            </div>
          </div>
        </div>

        {/* Center / Right Header Badges & Action Buttons */}
        {isLogged ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Room Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 255, 102, 0.06)',
              border: '1px solid var(--theme-border)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              <Users size={14} style={{ color: 'var(--theme-primary)' }} />
              <span>ROOM: <span style={{ color: 'var(--theme-primary)' }}>TEAM: {team?.name || 'GNG'}</span></span>
            </div>

            {/* Elapsed Timer Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: '#f87171'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span>ELAPSED: {formatElapsedTime(elapsedTime)}</span>
            </div>

            {/* Profile User Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 255, 102, 0.12)',
              border: '1px solid var(--theme-primary)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              color: 'var(--theme-primary)'
            }}>
              <span>🥷 {username || 'Player'}</span>
              <button
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', color: 'var(--theme-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 2px' }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Cheat Sheet Button */}
            <button
              onClick={() => { setShowCheatSheet(true); playClickSound(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <BookOpen size={14} style={{ color: 'var(--theme-primary)' }} />
              <span>Cheat Sheet</span>
            </button>

            {/* Vault Button */}
            <button
              onClick={() => { setShowVault(true); playClickSound(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Key size={14} style={{ color: 'var(--theme-primary)' }} />
              <span>Vault</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => { setIsMuted(!isMuted); playClickSound(); }}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-primary)',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Theme Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowThemeDropdown(!showThemeDropdown); playClickSound(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <Monitor size={14} style={{ color: 'var(--theme-primary)' }} />
                <span>{currentTheme}</span>
                <ChevronDown size={14} />
              </button>

              {showThemeDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '160px',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7)',
                  overflow: 'hidden',
                  zIndex: 100
                }}>
                  {THEMES.map(t => (
                    <button
                      key={t.name}
                      onClick={() => handleSelectTheme(t.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        background: currentTheme === t.name ? '#2563eb' : 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {currentTheme === t.name ? <Check size={14} /> : <span style={{ width: '14px' }} />}
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Red Admin Button */}
            <button
              onClick={() => { setIsAdminMode(true); playClickSound(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)'
              }}
            >
              <Lock size={14} />
              <span>ADMIN</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* System Announcement Banner */}
      {announcement && (
        <div style={{ background: '#ef4444', color: '#ffffff', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '16px', fontWeight: 'bold', fontSize: '0.9rem' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>⚡ BROADCAST ALERT: {announcement}</div>
          <button onClick={() => setAnnouncement(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '12px', gap: '12px' }}>
        {!isLogged ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <div className="glass-container" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--theme-border)', marginBottom: '24px' }}>
                <button 
                  onClick={() => { setAuthMode('join'); setAuthError(null); }}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authMode === 'join' ? '2px solid var(--theme-primary)' : 'none', color: authMode === 'join' ? 'var(--theme-primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Join Team
                </button>
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: authMode === 'login' ? '2px solid var(--theme-primary)' : 'none', color: authMode === 'login' ? 'var(--theme-primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Sign In
                </button>
              </div>

              {authError && <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{authError}</div>}

              {authMode === 'join' && (
                <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input type="text" className="form-control" placeholder="Enter Team Invite Code" style={{ textTransform: 'uppercase' }} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                  <input type="text" className="form-control" placeholder="Player Character Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  <input type="password" className="form-control" placeholder="Account Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="submit" className="btn" style={{ marginTop: '8px' }}>
                    <UserPlus size={16} /> Register & Join Team
                  </button>
                </form>
              )}

              {authMode === 'login' && (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input type="text" className="form-control" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  <input type="password" className="form-control" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="submit" className="btn" style={{ marginTop: '8px' }}>
                    <Key size={16} /> Access Session
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', width: '100%', height: '100%' }}>
            {/* Left Sidebar Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              
              {/* CTF Progress */}
              <div className="glass-container" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--theme-text-muted)', marginBottom: '6px' }}>
                  <Award size={14} style={{ color: 'var(--theme-primary)' }} />
                  <span>CTF PROGRESS</span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--theme-text)', marginBottom: '4px' }}>
                  {level?.title || 'Level Loading...'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-primary)' }}>
                  {team?.score || 0} PTS
                </div>
              </div>

              {/* Submit Password Box */}
              <div className="glass-container" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--theme-text-muted)', marginBottom: '8px' }}>
                  <Key size={14} style={{ color: 'var(--theme-primary)' }} />
                  <span>SUBMIT PASSWORD</span>
                </div>
                <form onSubmit={handlePasswordSubmission} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Paste next level password..."
                    value={passwordSubmissionInput}
                    onChange={(e) => setPasswordSubmissionInput(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                  />
                  <button type="submit" className="btn" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}>
                    Submit →
                  </button>
                </form>
              </div>

              {/* Mission Tasks List */}
              <div className="glass-container" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--theme-text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> LEVEL MISSIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                  {tasks.map(task => {
                    const isCompleted = progress[task.taskRole] === 'COMPLETED';
                    const isActive = activeTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => mountTask(task.id)}
                        style={{
                          background: isCompleted ? 'rgba(0, 255, 102, 0.08)' : isActive ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0, 0, 0, 0.3)',
                          border: `1px solid ${isCompleted ? 'var(--theme-primary)' : isActive ? 'var(--cyan)' : 'var(--theme-border)'}`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: isCompleted ? 'var(--theme-primary)' : 'var(--cyan)' }}>{task.taskRole}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{task.points} pts</span>
                        </div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--theme-text)' }}>{task.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.75rem', color: isCompleted ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}>
                          {isCompleted ? <CheckCircle2 size={12} /> : isActive ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.5s infinite' }} /> : <Circle size={12} />}
                          <span>{isCompleted ? 'Solved' : isActive ? 'Active Session' : 'Click to mount'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="glass-container" style={{ padding: '12px', height: '140px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--theme-text-muted)', marginBottom: '6px' }}>
                  <Activity size={14} style={{ color: 'var(--theme-primary)' }} />
                  <span>CO-OPERATIVE FEED</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem' }}>
                  {activityLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '6px', color: log.type === 'success' ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}>
                      <span>{log.timestamp}</span>
                      <span>{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Center / Right Section (Level Card + Terminal) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
              
              {/* Level Objective & Hint Box */}
              <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--theme-primary)', background: 'rgba(0, 255, 102, 0.1)', border: '1px solid var(--theme-border)', padding: '2px 8px', borderRadius: '4px' }}>
                      Level {level?.id || 1}
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-text)', marginTop: '4px' }}>
                      {level?.title || 'Loading Level...'}
                    </h2>
                  </div>

                  {/* Try Command */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.6)', border: '1px solid var(--theme-border)', padding: '6px 12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>Try command:</span>
                    <code style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--theme-primary)' }}>
                      cat flag.txt
                    </code>
                    <button onClick={() => handleCopyCommand('cat flag.txt')} style={{ background: 'transparent', border: 'none', color: 'var(--theme-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                {/* Objective */}
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--theme-border)', borderRadius: '6px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--theme-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    &gt;_ LEVEL OBJECTIVE
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--theme-text)', lineHeight: 1.4 }}>
                    {tasks.find(t => t.id === activeTaskId)?.hintText || 'Select a task mission from the left sidebar to mount its virtual filesystem into your terminal.'}
                  </div>
                </div>

                {/* Hint Revealer */}
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--theme-border)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--theme-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      💡 GUIDED HINTS ({revealedHintsCount}/3)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--theme-text-muted)' }}>
                      {revealedHintsCount > 0 ? (
                        <div style={{ color: 'var(--amber)', fontWeight: 'bold' }}>
                          Hint #{revealedHintsCount}: {tasks.find(t => t.id === activeTaskId)?.hintText || 'Inspect files with ls -la and cat.'}
                        </div>
                      ) : (
                        "Stuck? Click 'Reveal Hint' for step-by-step assistance."
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setRevealedHintsCount(prev => Math.min(3, prev + 1)); playClickSound(); }}
                    disabled={revealedHintsCount >= 3}
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', color: '#000000', padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Reveal Hint #{revealedHintsCount + 1}
                  </button>
                </div>

              </div>

              {/* Terminal Panel */}
              <div className="glass-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'rgba(0, 0, 0, 0.6)', borderBottom: '1px solid var(--theme-border)' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--theme-text-muted)' }}>
                    student@overthewire: {cwdRef.current}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (xtermRef.current) {
                          xtermRef.current.writeln('\r\nCustom VFS shell commands simulation: cd, ls, pwd, cat, mkdir, touch, rm, mv, cp, wc, grep, sort, uniq, chmod, head, tail, nano, vim, clear, find');
                          xtermRef.current.writeln('submit <flag-value> - submits flag to complete task');
                          writePrompt();
                        }
                      }}
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-muted)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <HelpCircle size={12} /> Help
                    </button>
                    <button
                      onClick={() => {
                        if (xtermRef.current) {
                          xtermRef.current.clear();
                          writePrompt();
                        }
                      }}
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-muted)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, background: '#020604', position: 'relative' }}>
                  <div ref={terminalRef} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }} />
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Cheat Sheet Modal */}
      {showCheatSheet && (
        <div className="modal-overlay" onClick={() => setShowCheatSheet(false)}>
          <div className="glass-container" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', background: '#040d07', border: '1px solid var(--theme-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--theme-border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} /> LINUX CLI CHEAT SHEET (FRESHER EDITION)
              </h2>
              <button onClick={() => setShowCheatSheet(false)} style={{ background: 'transparent', border: 'none', color: 'var(--theme-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {CHEAT_SHEET_CATEGORIES.map(cat => (
                <div key={cat.title}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--theme-primary)', marginBottom: '10px' }}>{cat.icon} {cat.title}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {cat.items.map(item => (
                      <div key={item.cmd} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--theme-border)', padding: '10px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--theme-primary)' }}>{item.cmd}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)' }}>{item.desc}</div>
                        </div>
                        <button onClick={() => handleCopyCommand(item.cmd)} style={{ background: 'transparent', border: 'none', color: 'var(--theme-text-muted)', cursor: 'pointer' }}><Copy size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vault Modal */}
      {showVault && (
        <div className="modal-overlay" onClick={() => setShowVault(false)}>
          <div className="glass-container" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', padding: '24px', background: '#040d07', border: '1px solid var(--theme-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--theme-border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={20} /> UNLOCKED FLAGS VAULT
              </h2>
              <button onClick={() => setShowVault(false)} style={{ background: 'transparent', border: 'none', color: 'var(--theme-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {Object.keys(unlockedVaultKeys).length === 0 ? (
                <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--theme-text-muted)' }}>No completed mission flags unlocked yet. Solve tasks to fill vault.</span>
              ) : (
                Object.entries(unlockedVaultKeys).map(([role, taskId]) => (
                  <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--theme-border)', padding: '8px 12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--theme-primary)' }}>{role}</span>
                    <code style={{ fontSize: '0.8rem', color: 'var(--theme-text)' }}>{taskId}</code>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
