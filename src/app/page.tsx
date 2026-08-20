"use client";
import React, { useState, useEffect, useRef } from 'react';
import type { Terminal } from 'xterm';
import type { FitAddon } from 'xterm-addon-fit';
import { supabase } from '@/utils/supabase';
import {
  Users,
  UserPlus,
  Award,
  MapPin,
  Copy,
  CheckCircle2,
  LogOut,
  Key,
  Activity,
  Shield,
  Trash2,
  BookOpen,
  Volume2,
  VolumeX,
  Monitor,
  ChevronDown,
  Check,
  HelpCircle,
  X,
  Lock,
  Folder,
  FileText,
  Search,
  LockKeyhole
} from 'lucide-react';
import 'xterm/css/xterm.css';
import { useCopyGuard, writeGuardedClipboardText } from '@/utils/copyGuard';
import { LeaderboardView } from '@/components/LeaderboardView';

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
  description?: string;
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
  icon: React.ElementType;
  items: CheatSheetItem[];
}

const CHEAT_SHEET_CATEGORIES: CheatSheetCategory[] = [
  {
    title: 'Navigation & Spaced Paths',
    icon: Folder,
    items: [
      { cmd: 'pwd', desc: 'Prints the current working directory path.' },
      { cmd: 'ls -la', desc: 'Lists files including hidden files (like .error_log and .vault).' },
      { cmd: 'cd "<folder>"', desc: 'Change directories. Wrap space-separated folder names in quotes (e.g. cd ".vault" or cd "database config").' },
      { cmd: 'cd ..', desc: 'Move back up to the parent directory.' }
    ]
  },
  {
    title: 'File Finding & Size Filters',
    icon: Search,
    items: [
      { cmd: 'find . -type f -size <bytes>c', desc: 'Locates files matching the exact byte size (e.g. find . -type f -size 1033c or size 12c).' },
      { cmd: 'file <filename>', desc: 'Inspects a file\'s nature/encoding (useful for identifying ELF executables).' },
      { cmd: 'cat ./-', desc: 'Reads the file named "-" using relative references to prevent command parameter conflict flags.' }
    ]
  },
  {
    title: 'Netcat Queries',
    icon: LockKeyhole,
    items: [
      { cmd: 'nc localhost <port>', desc: 'Queries background port services locally to fetch tokens (e.g., port 1337, 30001, 50000, or 60000).' }
    ]
  },
  {
    title: 'Sorting & Deduplication',
    icon: FileText,
    items: [
      { cmd: 'cat <filename>', desc: 'Outputs text contents to screen.' },
      { cmd: 'grep "<word>" <file>', desc: 'Filters and outputs matching lines containing a keyword (e.g. grep "CRITICAL" .error_log).' },
      { cmd: 'sort <filename> | uniq -u', desc: 'Sorts text contents and filters for the single unique outlier line in the file (isolates hidden flags).' }
    ]
  },
  {
    title: 'Executable Extraction',
    icon: Search,
    items: [
      { cmd: 'strings <binary> | grep "<word>"', desc: 'Extracts printable character tables from compiled binary files (e.g. strings main.exe | grep "key").' }
    ]
  },
  {
    title: 'Encryption & Decoding',
    icon: LockKeyhole,
    items: [
      { cmd: 'echo "<payload>" | base64 -d', desc: 'Decodes a Base64-encoded credential payload to reveal plain text flags.' },
      { cmd: 'echo "<cipher>" | tr \'A-Za-z\' \'N-ZA-Mn-za-m\'', desc: 'Decrypts a ROT13 cipher substitution key (e.g. translation of cipher flags).' }
    ]
  }
];

const THEMES = [
  { name: 'Matrix Green', color: '#00ff66', termBg: '#030a05', termFg: '#00ff66' },
  { name: 'Cyber Neon', color: '#00f3ff', termBg: '#070614', termFg: '#00f3ff' },
  { name: 'Hacker Amber', color: '#fbbf24', termBg: '#0f0a04', termFg: '#fbbf24' },
  { name: 'Dark Slate', color: '#38bdf8', termBg: '#090c14', termFg: '#38bdf8' }
];

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Matrix characters (mix of letters & katakana characters)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
    const charArr = chars.split('');
    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1).map(() => Math.floor(Math.random() * -100));

    const draw = () => {
      ctx.fillStyle = 'rgba(2, 6, 4, 0.08)'; // matches our theme background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(0, 255, 102, 0.18)'; // transparent neon green
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArr[Math.floor(Math.random() * charArr.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.8
      }}
    />
  );
};

export default function App() {
  // Auth Session States
  const [token, setToken] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState<boolean>(false);

  // Restore session from localStorage after mount (SSR safe)
  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    if (!savedToken) return;

    // Call /api/auth/me to fully re-hydrate session state
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${savedToken}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          // Token is invalid/expired — clear it
          localStorage.removeItem('jwt_token');
          return;
        }
        setToken(savedToken);
        setIsLogged(true);
        hydrateSessionState(data);
      })
      .catch(() => {
        // silent fail — don't log out, just don't restore
      });
  }, []);

  
  // Auth Input Form States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Challenge Progress States
  const [team, setTeam] = useState<Team | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  activeTaskIdRef.current = activeTaskId;
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [studentLevels, setStudentLevels] = useState<any[]>([]);
  // Derive the currently mounted task once per render to avoid repeated lookups
  const activeTask = tasks.find(t => t.id === activeTaskId) ?? null;
  const activeLevelTitle = level?.title || (selectedLevelId ? `Level ${selectedLevelId}` : 'Level 1: Objective Hub');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const hydrateSessionState = (data: any) => {
    if (data.user?.username) setUsername(data.user.username);
    if (data.team) setTeam(data.team);
    if (data.level) {
      setLevel(data.level);
      setSelectedLevelId(data.level.id);
    }
    if (data.tasks) setTasks(data.tasks);
    if (data.solvedTaskIds) {
      const pg: Record<string, string> = {};
      (data.tasks || []).forEach((t: any) => { if (data.solvedTaskIds.includes(t.id)) pg[t.taskRole] = 'COMPLETED'; });
      setProgress(pg);
    }
    if (data.activityLogs) {
      const logs = data.activityLogs.map((log: any) => {
        const time = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return {
          id: log.id,
          timestamp: time,
          text: `${log.username} solved ${log.taskName}! (+${log.points} pts)`,
          type: 'success'
        };
      });
      setActivityLogs(logs);
    }
  };

  const addLog = (text: string, type: 'success' | 'system' | 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setActivityLogs(prev => [
      { id: Math.random().toString(), timestamp, text, type },
      ...prev.slice(0, 20)
    ]);
  };

  // Socket and UI References
  const terminalRef = useRef<HTMLDivElement>(null);
  const questionContentRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cwdRef = useRef<string>('/');
  const commandBufferRef = useRef<string>('');
  const terminalStateRef = useRef<any>({});

  // UI & Theme States
  const [currentTheme, setCurrentTheme] = useState<string>('Matrix Green');
  const [showThemeDropdown, setShowThemeDropdown] = useState<boolean>(false);
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [passwordSubmissionInput, setPasswordSubmissionInput] = useState<string>('');

  // Admin Session States
  const [showStudentLeaderboard, setShowStudentLeaderboard] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isLeaderboardPage, setIsLeaderboardPage] = useState<boolean>(false);

  // Session exclusivity
  const [hasDuplicateTab, setHasDuplicateTab] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !isLogged || !username) return;

    const channel = new BroadcastChannel('cyberbandit_tabs_channel');
    
    // 1. Alert existing tabs that we just loaded
    channel.postMessage({ type: 'init', username: username });

    // 2. Listen to messages from other tabs
    channel.onmessage = (event) => {
      const { type, username: msgUsername } = event.data;
      if (msgUsername !== username) return;

      if (type === 'init') {
        // Another tab has opened with the same username. 
        // Claim ownership so it knows it is a duplicate!
        channel.postMessage({ type: 'claim', username: username });
      } else if (type === 'claim') {
        // An existing tab claimed ownership, lock this tab!
        setHasDuplicateTab(true);
      } else if (type === 'takeover') {
        // The other tab took over ownership, lock this tab!
        setHasDuplicateTab(true);
      }
    };

    return () => {
      channel.close();
    };
  }, [isLogged, username]);

  const handleTakeoverSession = () => {
    if (typeof window === 'undefined' || !username) return;
    const channel = new BroadcastChannel('cyberbandit_tabs_channel');
    channel.postMessage({ type: 'takeover', username: username });
    setHasDuplicateTab(false);
    channel.close();
  };


  useEffect(() => {
    setIsAdminMode(window.location.pathname.includes('/admin'));
    setIsLeaderboardPage(window.location.pathname.includes('/leaderboard'));
  }, []);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdminLogged, setIsAdminLogged] = useState<boolean>(false);

  // Restore admin session from localStorage after mount
  useEffect(() => {
    const savedAdminToken = localStorage.getItem('admin_token');
    if (savedAdminToken) {
      setAdminToken(savedAdminToken);
      setIsAdminLogged(true);
    }
  }, []);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMember1Name, setNewMember1Name] = useState('');
  const [newMember1Email, setNewMember1Email] = useState('');
  const [newMember2Name, setNewMember2Name] = useState('');
  const [newMember2Email, setNewMember2Email] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
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
  const [seedingLoading, setSeedingLoading] = useState(false);
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

  useCopyGuard(questionContentRef, {
    levelTitle: activeLevelTitle
  });

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

  // DevTools and Console Security Effect
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      const ctrlOrCmd = e.ctrlKey || (isMac && e.metaKey);
      if (
        ctrlOrCmd && 
        (e.shiftKey || e.altKey) && 
        (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C')
      ) {
        e.preventDefault();
        return;
      }
      if (ctrlOrCmd && (e.key === 'u' || e.key === 'U' || (e.altKey && (e.key === 'u' || e.key === 'U')))) {
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    console.log(
      '%c⚠️ SECURITY COMPLIANCE WARNING ⚠️',
      'background: #7f1d1d; color: #fecaca; font-size: 20px; font-weight: bold; padding: 10px; border-radius: 4px; border: 2px solid #ef4444;'
    );
    console.log(
      '%cConsole injections, scripts, or page tampering are strictly prohibited in this competition. All connections, logins, and API payload traces are recorded. Unauthorized attempts will trigger account locking and team disqualification.',
      'color: #fca5a5; font-size: 13px; font-style: italic; line-height: 1.5;'
    );

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const playErrorSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
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
      const prompt = `student@cyberbandit:${cwdRef.current || '/home/student'}$ `;
      xtermRef.current.write(prompt + command);
    }
  };

  const handleGuardedQuestionCommandCopy = async (command: string) => {
    await writeGuardedClipboardText(activeLevelTitle, command);
    playClickSound();
    if (xtermRef.current) {
      commandBufferRef.current = command;
      xtermRef.current.write('\r\x1b[K');
      const prompt = `student@cyberbandit:${cwdRef.current || '/home/student'}$ `;
      xtermRef.current.write(prompt + command);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (!data.error && Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (showStudentLeaderboard || showAdminLeaderboard || isLeaderboardPage) {
      fetchLeaderboard();
    }
  }, [showStudentLeaderboard, showAdminLeaderboard, isLeaderboardPage]);

  // Global realtime state syncer
  useEffect(() => {
    const pub = supabase.channel('public:leaderboard');
    pub.on('broadcast', { event: 'leaderboard:update' }, (payload: any) => {
      const eventData = payload.payload;
      fetchLeaderboard();
      if (token) {
        // Also refresh student state so score and progress visibly updates
        fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            hydrateSessionState(data);
            if (eventData && eventData.teamId === data.team?.id && eventData.username !== username) {
              addLog(`🎉 Teammate ${eventData.username} solved ${eventData.taskName}! (+${eventData.pointsAdded} pts)`, 'success');
            }
          });
      }
    })
    .on('broadcast', { event: 'admin:broadcast:alert' }, (payload: any) => {
      const msg = payload.payload?.message;
      if (msg) {
        setAnnouncement(msg);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('Registered to live public standings gateway');
    });

    return () => {
      supabase.removeChannel(pub);
    };
  }, [token, username]);

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

  const handleSeedSyllabus = async () => {
    if (!window.confirm("WARNING: Seeding the syllabus will delete ALL existing submissions, active team levels, and current tasks. Are you sure you want to proceed?")) {
      return;
    }
    setSeedingLoading(true);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Syllabus levels seeded successfully! 20 custom collaborative tasks are now active.');
        if (adminToken) fetchLevels(adminToken);
      }
    } catch (err: any) {
      alert('Failed to seed: ' + err.message);
    } finally {
      setSeedingLoading(false);
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

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    try {
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ message: broadcastMsg.trim() })
      });
      addAdminLog(`Sent system announcement: "${broadcastMsg.trim()}"`, 'system');
      setBroadcastMsg('');
    } catch (err) {
      console.error(err);
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
    setIsAdminLogged(false);
    setAdminTeams([]);
    setAdminLogs([]);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const members = [];
    if (newMember1Email.trim()) {
      members.push({ email: newMember1Email.trim(), name: newMember1Name.trim() || undefined });
    }
    if (newMember2Email.trim()) {
      members.push({ email: newMember2Email.trim(), name: newMember2Name.trim() || undefined });
    }

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: newTeamName.trim(), members })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewTeamName('');
        setNewMember1Name('');
        setNewMember1Email('');
        setNewMember2Name('');
        setNewMember2Email('');
        // Immediately update UI with new team, then sync from server
        setAdminTeams(prev => [...prev, { ...data, allowedEmails: [], users: [] }]);
        if (adminToken) {
          setTimeout(() => fetchTeams(adminToken), 500);
        }
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

  useEffect(() => {
    let adminChan: any = null;
    if (isAdminMode && adminToken) {
      localStorage.setItem('admin_token', adminToken);
      setIsAdminLogged(true);
      fetchTeams(adminToken);
      fetchLevels(adminToken);

      // Initialize Admin Socket
      adminChan = supabase.channel('admin:events');
      adminChan
        .on('broadcast', { event: 'admin:solve:alert' }, (payload: any) => {
          const data = payload.payload;
          addAdminLog(`🎉 [${data.teamName}] ${data.username} solved ${data.taskName}! (+${data.pointsAdded} pts)`, 'success');
          fetchTeams(adminToken);
        })
        .on('broadcast', { event: 'admin:teams:refresh' }, () => {
          fetchTeams(adminToken);
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            addAdminLog('Admin Pipeline connected to socket gateway', 'system');
          }
        });
    } else {
      localStorage.removeItem('admin_token');
      setIsAdminLogged(false);
    }

    return () => {
      if (adminChan) supabase.removeChannel(adminChan);
    };
  }, [adminToken, isAdminMode]);

  // Supabase Real-Time Presence: Admin Side
  useEffect(() => {
    if (isAdminMode && adminToken) {
      const pChannel = supabase.channel('admin:presence');
      pChannel.on('presence', { event: 'sync' }, () => {
        const state = pChannel.presenceState();
        const active = new Set<string>();
        for (const id in state) {
          state[id].forEach((p: any) => p.username && active.add(p.username.toLowerCase()));
        }
        setOnlineUsers(active);
      }).subscribe();

      return () => {
        supabase.removeChannel(pChannel);
      };
    }
  }, [isAdminMode, adminToken]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('jwt_token', token);
      setIsLogged(true);
      const decoded = parseJwt(token);
      if (decoded && decoded.userId) {
        setUsername(decoded.userId);  // token stores userId = username
      }
      fetch('/api/levels', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (!data.error && Array.isArray(data)) {
            setStudentLevels(data);
          }
        })
        .catch(err => console.error('Error fetching student levels:', err));
    } else {
      localStorage.removeItem('jwt_token');
      setIsLogged(false);
      setUsername('');
      setStudentLevels([]);
    }
  }, [token]);

  // Supabase Real-Time Presence: Student Side
  useEffect(() => {
    if (isLogged && username) {
      const pChannel = supabase.channel('student:presence', {
        config: { presence: { key: username } }
      });
      pChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await pChannel.track({ online: true, username: username.toLowerCase() });
        }
      });
      return () => {
        pChannel.untrack().then(() => supabase.removeChannel(pChannel));
      };
    }
  }, [isLogged, username]);

  // Synchronize base selectedLevelId with socket's active level
  useEffect(() => {
    if (level) {
      if (selectedLevelId === null) {
        setSelectedLevelId(level.id);
      }
      if (level.tasks && level.tasks.length > 0) {
        setTasks(level.tasks);
      }
    }
  }, [level, selectedLevelId]);

  // Fetch older/non-active level tasks when selectedLevelId switches
  useEffect(() => {
    if (!token) return;
    const targetLevelId = selectedLevelId || level?.id || 1;
    if (level && targetLevelId === level.id && level.tasks && level.tasks.length > 0) {
      setTasks(level.tasks);
    } else {
      const lvl = studentLevels.find(l => l.id === targetLevelId);
      if (lvl && lvl.tasks) {
        setTasks(lvl.tasks);
      }
    }
  }, [selectedLevelId, level, token]);

  // Terminal lifecycle hook
  useEffect(() => {
    if (!isLogged || !terminalRef.current) return;

    // Dynamically import xterm to avoid Next.js tracking "self is not defined" SSR errors
    const { Terminal: XTerminal } = require('xterm');
    const { FitAddon: XFitAddon } = require('xterm-addon-fit');

    const themeObj = THEMES.find(t => t.name === currentTheme) || THEMES[0];
    const term = new XTerminal({
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

    const fitAddon = new XFitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Attach custom keyboard/clipboard event handlers (Ctrl/Cmd + C, V, A)
    term.attachCustomKeyEventHandler((event: any) => {
      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.type === 'keydown') {
        if (isCtrlOrMeta && key === 'c') {
          if (term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            return false; // prevent default xterm handling
          }
        }
        if (isCtrlOrMeta && key === 'v') {
          navigator.clipboard.readText().then(text => {
            if (text) {
              const cleanText = text.replace(/[\r\n]+/g, ' '); // remove newlines
              term.write(cleanText);
              commandBufferRef.current += cleanText;
            }
          }).catch(err => {
            console.error('Failed to read clipboard:', err);
          });
          return false; // prevent default xterm handling
        }
        if (isCtrlOrMeta && key === 'a') {
          term.selectAll();
          return false; // prevent default xterm handling
        }
      }
      return true;
    });

    // Print welcome banner
    term.writeln('\x1b[1;36mCyberBandit Collaborative Shell Client v1.0.0\x1b[0m');
    term.writeln('Active WebSocket pipeline initialized. Status: \x1b[1;32mCONNECTED\x1b[0m');
    term.writeln('Type \x1b[1;35mhelp\x1b[0m to view instructions, or select a task in the panel to begin.');
    term.writeln('');
    writePrompt();

    const executeCommand = async (cmd: string) => {
      if (!activeTaskIdRef.current || !team?.id) return;
      try {
        const res = await fetch('/api/terminal/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: team.id, taskId: activeTaskIdRef.current, commandLine: cmd, cwd: cwdRef.current || '/home/student', username })
        });
        const data = await res.json();
        
        if (data.output) {
          if (Array.isArray(data.output)) {
            data.output.forEach((line: string) => term.writeln(line));
          } else {
            const outLines = String(data.output).split('\n');
            outLines.forEach((l: string) => term.writeln(l));
          }
        }
        if (data.cwd) { cwdRef.current = data.cwd; }
        writePrompt();

        const isSuccess = data.output && String(data.output).includes('SUCCESS');
        if (isSuccess && token) {
          if (activeTask) {
            addLog(`🎉 You solved ${activeTask.name}! (+${activeTask.points || 33} pts)`, 'success');
          }
          fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(meData => {
              hydrateSessionState(meData);
            });
        }
      } catch (e: any) {
        term.writeln(`\r\n\x1b[31mTerminal error: ${e.message}\x1b[0m`);
        writePrompt();
      }
    };

    // Handle user keystrokes in console
    term.onData((data: string) => {
      playClickSound();

      if (data.length > 1) {
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          const charCode = char.charCodeAt(0);
          if (char === '\r' || char === '\n') {
            const cmd = commandBufferRef.current.trim();
            term.write('\r\n');
            if (cmd.toLowerCase() === 'clear') {
              term.clear();
              commandBufferRef.current = '';
              writePrompt();
            } else if (cmd.toLowerCase() === 'exit' || cmd.toLowerCase() === 'logout' || cmd.toLowerCase() === 'back') {
              commandBufferRef.current = '';
              setActiveTaskId(null);
            } else if (cmd.length > 0) {
              executeCommand(cmd);
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
        
        if (cmd.toLowerCase() === 'clear') {
          term.clear();
          commandBufferRef.current = '';
          writePrompt();
        } else if (cmd.toLowerCase() === 'exit' || cmd.toLowerCase() === 'logout' || cmd.toLowerCase() === 'back') {
          commandBufferRef.current = '';
          setActiveTaskId(null);
        } else if (cmd.length > 0) {
          if (cmd.toLowerCase() === 'help') {
            term.writeln('Custom VFS shell commands simulation:');
            term.writeln('  cd, ls, pwd, cat, mkdir, touch, rm, mv, cp, wc, grep, sort, uniq, chmod, head, tail, nano, vim, clear, find');
            term.writeln('  submit <flag-value>   - submits flag to complete task (e.g. submit flag{...})');
            commandBufferRef.current = '';
            writePrompt();
          } else {
            executeCommand(cmd);
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
                executeCommand(cmd);
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
  }, [isLogged, activeTaskId]);

  // Socket client initializer

  const writePrompt = () => {
    if (xtermRef.current) {
      xtermRef.current.write(`\r\x1b[1;32mstudent@cyberbandit:${cwdRef.current}$ \x1b[0m`);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || !email) {
      return setAuthError('Team Code and Email ID are required');
    }
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/join-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, email })
      });
      const data = await res.json();
      if (data.error) {
        setAuthError(data.error);
      } else {
        if (data.user && data.user.username) {
          setUsername(data.user.username);
        }
        setToken(data.token);
        if (data.team) setTeam(data.team);
        if (data.level) setLevel(data.level);
        if (data.tasks) setTasks(data.tasks);
        setIsLogged(true);
      }
    } catch (err: any) {
      setAuthError('Accessing workspace failed: ' + err.message);
    }
  };

  const mountTask = async (taskId: string) => {
    setActiveTaskId(taskId);
    playClickSound();

    try {
      const res = await fetch('/api/terminal/mount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      });
      const data = await res.json();
      if (data.task && xtermRef.current) {
        const t = data.task;
        cwdRef.current = t.startDirectory || '/home/student';
        // Note: Actual VFS injection goes here when terminal engine is active
        const msgStr = `\r\n\x1b[96mMounted target VFS for mission: \x1b[1m${t.name}\x1b[0m\r\n\x1b[90mSecurity protocol initialized. Terminal sandbox starting in ${cwdRef.current}...\x1b[0m\r\n\r\nType \x1b[32m'help'\x1b[0m for available forensic commands. Use the UI submit field below when you locate the target data.\r\n`;
        xtermRef.current.write(msgStr);
        xtermRef.current.write(`\r\nstudent@cyberbandit:${cwdRef.current}$ `);
      }
    } catch (e) {
      console.error("Mount error:", e);
    }
  };

  const handlePasswordSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordSubmissionInput.trim()) return;
    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           commandLine: `submit ${passwordSubmissionInput.trim()}`,
           taskId: activeTaskIdRef.current,
           teamId: team?.id || '',
           username
        })
      });
      const data = await res.json();
      if (data.output) {
         if (xtermRef.current) xtermRef.current.write('\r\n' + data.output + '\r\n');
      }

      const isSuccess = data.output && String(data.output).includes('SUCCESS');
      if (isSuccess && token) {
        if (activeTask) {
          addLog(`🎉 You solved ${activeTask.name}! (+${activeTask.points || 33} pts)`, 'success');
        }
        fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .then(meData => {
            hydrateSessionState(meData);
          });
      }
    } catch (e) {
      console.error(e);
    }
    setPasswordSubmissionInput('');
    playClickSound();
  };

  const handleLogout = () => {
    supabase.removeAllChannels();
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
    return <LeaderboardView leaderboard={leaderboard} />;
  }

  if (isAdminMode) {
    if (showAdminLeaderboard) {
      return (
        <LeaderboardView
          leaderboard={leaderboard}
          onBack={() => setShowAdminLeaderboard(false)}
          title="LIVE LEADERBOARD STANDINGS"
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'rgba(10, 15, 26, 0.7)', borderBottom: '1px solid var(--theme-border)', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ color: 'var(--amber)' }} size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--rose)', letterSpacing: '-0.5px' }}>CyberBandit SUPER ADMIN PANEL</h1>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.25fr 1fr', gap: '16px', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                <div className="glass-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', color: 'var(--theme-text)', flexShrink: 0 }}>Registered Teams ({adminTeams.length})</h3>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', scrollbarWidth: 'thin', scrollbarColor: 'var(--theme-primary) transparent' }}>
                    {adminTeams.map(t => {
                      const isExpanded = expandedTeamId === t.id;
                      return (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--theme-border)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div 
                            onClick={() => setExpandedTeamId(isExpanded ? null : t.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}
                          >
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: '0.85rem' }}>{t.name}</strong> 
                              <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', marginTop: '2px' }}>
                                Code: <span style={{ color: 'var(--theme-primary)', fontWeight: 'bold' }}>{t.inviteCode}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleDeleteTeam(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>ROSTER & LIVE STATUS:</div>
                              {(!t.allowedEmails || t.allowedEmails.length === 0) ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>No members pre-registered.</div>
                              ) : (
                                t.allowedEmails.map((ae: any) => {
                                  const linkedUser = t.users?.find((u: any) => u.email?.toLowerCase() === ae.email.toLowerCase());
                                  const isJoined = !!linkedUser;
                                  const renderName = ae.username || ae.name || ae.email?.split('@')[0] || 'Unnamed Player';
                                  const isUserOnline = onlineUsers.has(renderName.toLowerCase());

                                  return (
                                    <div key={ae.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: '12px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--theme-text)' }}>{ae.username || ae.name || ae.email?.split('@')[0] || 'Unnamed Player'}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--theme-text-muted)' }}>{ae.email}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {isJoined ? (
                                          <>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--theme-text-muted)' }}>@{(ae.username || ae.email?.split('@')[0] || '').split(' ')[0]}</span>
                                            <span style={{
                                              display: 'inline-block',
                                              width: '8px',
                                              height: '8px',
                                              borderRadius: '50%',
                                              background: isUserOnline ? '#10b981' : '#6b7280',
                                              boxShadow: isUserOnline ? '0 0 8px #10b981' : 'none'
                                            }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: isUserOnline ? '#10b981' : '#9ca3af' }}>
                                              {isUserOnline ? 'Online' : 'Offline'}
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <span style={{ fontSize: '0.7rem', fontStyle: 'italic', color: 'var(--theme-text-muted)' }}>Offline</span>
                                            <span style={{
                                              display: 'inline-block',
                                              width: '8px',
                                              height: '8px',
                                              borderRadius: '50%',
                                              background: '#6b7280'
                                            }} />
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', color: 'var(--theme-primary)' }}>Add New Team</h3>
                    <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input type="text" className="form-control" placeholder="Team Name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} required />
                      
                      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--theme-text-muted)', borderBottom: '1px solid var(--theme-border)', paddingBottom: '4px', marginTop: '6px' }}>MEMBER 1</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" className="form-control" style={{ flex: 1 }} placeholder="Name / USN" value={newMember1Name} onChange={(e) => setNewMember1Name(e.target.value)} />
                        <input type="email" className="form-control" style={{ flex: 1.5 }} placeholder="Email ID" value={newMember1Email} onChange={(e) => setNewMember1Email(e.target.value)} />
                      </div>

                      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--theme-text-muted)', borderBottom: '1px solid var(--theme-border)', paddingBottom: '4px', marginTop: '6px' }}>MEMBER 2</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" className="form-control" style={{ flex: 1 }} placeholder="Name / USN" value={newMember2Name} onChange={(e) => setNewMember2Name(e.target.value)} />
                        <input type="email" className="form-control" style={{ flex: 1.5 }} placeholder="Email ID" value={newMember2Email} onChange={(e) => setNewMember2Email(e.target.value)} />
                      </div>

                      <button type="submit" className="btn" style={{ marginTop: '12px' }}>Create Team</button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', overflowY: 'auto' }}>
                <div className="glass-container" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--cyan)' }}>⚡ Auto-Seed Cyberbandit 20-Level Syllabus</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                      Recreate all database challenges based on the 20-level format. This resets all TASK A & B workspaces.
                    </p>
                  </div>
                  <button type="button" onClick={handleSeedSyllabus} disabled={seedingLoading} className="btn" style={{ width: 'auto', padding: '8px 16px', background: 'var(--cyan)', color: '#000', fontWeight: 'bold' }}>
                    {seedingLoading ? 'Seeding...' : '⚡ Seed 20 Levels'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', width: '100%' }}>
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
                      <option value="TASK_A">TASK A</option><option value="TASK_B">TASK B</option><option value="TASK_C">TASK C</option>
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
            </div>
            )
          )}
        </main>
      </div>
    );
  }

  if (showStudentLeaderboard) {
    return (
      <LeaderboardView
        leaderboard={leaderboard}
        onBack={() => setShowStudentLeaderboard(false)}
      />
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
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>
              CyberBandit
            </h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', letterSpacing: '0.5px' }}>
              Fresher Linux CTF Edition • {level?.title || 'Interactive Shell'}
            </div>
          </div>
        </div>

        {/* Center/Right Header Badges & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLogged && (
            <>
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
                <span>🥷 {username}</span>
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
            </>
          )}
          <img src="/logo.png" alt="CyberBandit Logo" style={{ height: '64px', objectFit: 'contain', marginLeft: '10px' }} />
        </div>
      </header>

      {/* System Announcement Banner */}
      {announcement && (
        <div style={{ 
          background: '#dc2626', 
          color: '#ffffff', 
          padding: '6px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          fontSize: '0.85rem',
          fontWeight: 'bold',
          gap: '12px'
        }}>
          {/* Badge on Left */}
          <div style={{ 
            background: '#000000', 
            color: '#ef4444', 
            padding: '4px 10px', 
            borderRadius: '4px', 
            fontSize: '0.65rem', 
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: 'monospace'
          }}>
            <span style={{ color: '#ffb900' }}>⚡</span>
            <span>BROADCAST ALERT</span>
          </div>

          {/* Centered Message */}
          <div style={{ 
            flex: 1, 
            textAlign: 'center', 
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            letterSpacing: '0.3px'
          }}>
            {announcement}
          </div>

          {/* Dismiss button on Right */}
          <button 
            onClick={() => setAnnouncement(null)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#ffffff', 
              cursor: 'pointer', 
              fontSize: '1rem',
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '12px', gap: '12px', position: 'relative' }}>
        {!isLogged ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }}>
            <MatrixRain />
            <div className="glass-container" style={{ width: '100%', maxWidth: '480px', padding: '32px', zIndex: 1, position: 'relative' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-primary)', marginBottom: '24px', textAlign: 'center', letterSpacing: '1px' }}>
                ENTER COMPONENT WORKSPACE
              </h2>

              {authError && <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{authError}</div>}

              <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input type="text" className="form-control" placeholder="Enter Team Code" style={{ textTransform: 'uppercase' }} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                <input type="email" className="form-control" placeholder="Pre-registered Email ID" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="btn" style={{ marginTop: '8px' }}>
                  <UserPlus size={16} /> Authenticate & Access Workspace
                </button>
              </form>
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

              {/* Mission Levels List */}
              <div className="glass-container" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--theme-text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> LEVEL MISSIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                  {(() => {
                    const maxLevel = team?.currentLevelId || level?.id || 1;
                    const displayList = studentLevels.length > 0 ? studentLevels : Array.from({ length: 20 }, (_, i) => ({
                      id: i + 1,
                      title: `Level ${i + 1}`,
                      points: (i + 1) * 100
                    }));

                    return displayList.map(lvl => {
                      const lvlId = lvl.id;
                      const isLocked = lvlId > maxLevel;
                      const isSelected = selectedLevelId === lvlId;
                      const isCurrent = (team?.currentLevelId || level?.id) === lvlId;
                      const title = lvl.title;

                      return (
                        <div
                          key={lvlId}
                          onClick={() => {
                            if (isLocked) {
                              playErrorSound();
                              return;
                            }
                            setSelectedLevelId(lvlId);
                            playClickSound();
                          }}
                          style={{
                            background: isSelected 
                              ? 'rgba(0, 255, 102, 0.08)' 
                              : isLocked 
                                ? 'rgba(255, 255, 255, 0.01)' 
                                : 'rgba(0, 0, 0, 0.3)',
                            border: `1px solid ${
                              isSelected 
                                ? 'var(--theme-primary)' 
                                : isLocked 
                                  ? 'rgba(255, 255, 255, 0.04)' 
                                  : 'var(--theme-border)'
                            }`,
                            borderRadius: '8px',
                            padding: '10px 12px',
                            cursor: isLocked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            opacity: isLocked ? 0.45 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold', 
                              color: isSelected 
                                ? 'var(--theme-primary)' 
                                : isLocked 
                                  ? 'var(--theme-text-muted)' 
                                  : 'var(--theme-primary)' 
                            }}>
                              LEVEL {lvlId} {isLocked ? '(LOCKED)' : ''}
                            </span>
                            <h4 style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: 700, 
                              color: isLocked ? 'var(--theme-text-muted)' : 'var(--theme-text)', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              maxWidth: '170px' 
                            }} title={title}>
                              {title}
                            </h4>
                          </div>
                          {isCurrent && (
                            <span style={{ background: 'var(--theme-primary)', color: '#000', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>ACTIVE</span>
                          )}
                          {!isCurrent && isLocked && (
                            <Lock size={12} style={{ color: 'var(--theme-text-muted)' }} />
                          )}
                        </div>
                      );
                    });
                  })()}
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
                    <div key={log.id} style={{ display: 'flex', gap: '6px', color: log.type === 'success' ? 'var(--theme-primary)' : log.type === 'system' ? '#facc15' : 'var(--theme-text-muted)' }}>
                      <span>{log.timestamp}</span>
                      <span>{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Center / Right Section (Level Card + Terminal) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', width: '100%', height: '100%' }}>
              {!activeTaskId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                  <div className="glass-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--theme-primary)', background: 'rgba(0, 255, 102, 0.1)', border: '1px solid var(--theme-border)', padding: '2px 8px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                      LEVEL {selectedLevelId || level?.id || 1} MISSION OVERVIEW
                    </span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--theme-text)', marginTop: '4px' }}>
                      {level && level.id === selectedLevelId ? level.title : `Level ${selectedLevelId}: Objective Hub`}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--theme-text-muted)' }}>
                      {level && level.id === selectedLevelId ? level.description : 'Complete exercises in this target folder workspace to solve the challenge mission.'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {((tasks && tasks.length > 0) ? tasks : (level?.tasks || [])).map(task => {
                      const isCompleted = (selectedLevelId !== null && selectedLevelId < (team?.currentLevelId || 1)) || progress[task.taskRole] === 'COMPLETED';
                      return (
                        <div
                          key={task.id}
                          onClick={() => mountTask(task.id)}
                          className="glass-container"
                          style={{
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            background: isCompleted ? 'rgba(0, 255, 102, 0.04)' : 'var(--theme-card-bg)',
                            border: '1px solid ' + (isCompleted ? 'var(--theme-primary)' : 'var(--theme-border)'),
                            borderRadius: '8px',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isCompleted ? 'rgba(0, 255, 102, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid ' + (isCompleted ? 'rgba(0, 255, 102, 0.2)' : 'rgba(56, 189, 248, 0.2)'),
                              color: isCompleted ? 'var(--theme-primary)' : 'var(--cyan)'
                            }}>
                              {task.taskRole}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--theme-text-muted)' }}>
                              {task.points || 100} PTS
                            </span>
                          </div>

                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--theme-text)' }}>
                              {task.name}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginTop: '8px', minHeight: '36px', lineHeight: 1.4 }}>
                              {task.hintText ? `Objective: ${task.hintText.substring(0, 60)}...` : 'Complete exercises in this target folder workspace to solve the challenge mission.'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--theme-border)', marginTop: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: isCompleted ? 'var(--theme-primary)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 size={14} /> Solved
                                </>
                              ) : (
                                <>
                                  <HelpCircle size={14} /> Unsolved
                                </>
                              )}
                            </span>
                          </div>

                          <button
                            onClick={() => mountTask(task.id)}
                            className="btn"
                            style={{
                              background: isCompleted ? 'rgba(0, 255, 102, 0.1)' : 'var(--theme-primary)',
                              border: isCompleted ? '1px solid var(--theme-primary)' : 'none',
                              color: isCompleted ? 'var(--theme-primary)' : '#000000',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {isCompleted ? '⚡ Re-Open Workspace' : '⚡ Launch Terminal'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Terminal layout is shown */
                <>
                  {/* Level Objective & Hint Box */}
                  <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTaskId(null);
                          playClickSound();
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid var(--theme-border)',
                          color: 'var(--theme-primary)',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        ← Back to Tasks
                      </button>
                    </div>

                    <div ref={questionContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--theme-primary)', background: 'rgba(0, 255, 102, 0.1)', border: '1px solid var(--theme-border)', padding: '2px 8px', borderRadius: '4px' }}>
                              Level {selectedLevelId || level?.id || 1}
                            </span>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--theme-text)', marginTop: '4px' }}>
                              {level && level.id === selectedLevelId ? level.title : `Level ${selectedLevelId}`}
                            </h2>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--theme-border)', borderRadius: '6px', padding: '10px 14px', position: 'relative' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--theme-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          &gt;_ LEVEL OBJECTIVE
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--theme-text)', lineHeight: 1.4 }}>
                          {activeTask?.hintText
                            ? activeTask.hintText
                            : 'Select a task mission to mount its virtual filesystem into your terminal.'}
                        </div>
                      </div>
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
                        student@cyberbandit: {cwdRef.current} (Task: {activeTask?.taskRole})
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
                </>
              )}
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
              {CHEAT_SHEET_CATEGORIES.map(cat => {
                const IconComp = cat.icon;
                return (
                  <div key={cat.title}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--theme-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IconComp size={16} /> <span>{cat.title}</span>
                    </h3>
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
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Session Duplicate Lock Overlay */}
      {hasDuplicateTab && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 10, 5, 0.95)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          padding: '24px',
          backdropFilter: 'blur(8px)',
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          <div className="glass-container" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '40px',
            border: '2px solid #ef4444',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            background: '#040d07'
          }}>
            {/* Locked Visual Icon */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '50%',
              width: '64px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              marginBottom: '20px'
            }}>
              <LockKeyhole size={36} />
            </div>

            <h2 style={{
              fontSize: '1.2rem',
              fontWeight: 900,
              color: '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '16px'
            }}>
              🚫 Session Blocked
            </h2>

            <p style={{
              fontSize: '0.85rem',
              color: '#94a3b8',
              lineHeight: 1.6,
              marginBottom: '28px'
            }}>
              Cyberbandit detected that you already have an active terminal tab open with this session code. To ensure synchronization and prevent conflicts, only one active tab is allowed.
            </p>

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={handleTakeoverSession}
                className="btn-primary"
                style={{
                  flex: 1,
                  background: '#ef4444',
                  borderColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                Take Over Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
