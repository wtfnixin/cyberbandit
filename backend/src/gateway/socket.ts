import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { prisma, getTeam, advanceTeamLevel, recordSubmission } from '../services/db';
import {
  getUserVFS,
  setUserVFS,
  getUserCWD,
  setUserCWD,
  getTeamProgress,
  setTeamProgress,
  initializeUserSession,
  pushHistory,
  updateLeaderboardScore
} from '../services/redis';
import { executeCommandLine } from '../engine/pipeline';
import { DirectoryNode } from '../engine/types';

const JWT_SECRET = process.env.JWT_SECRET || 'overthewiresupersecretkey123';

export const onlineUsers = new Set<string>();

export function getClientHintText(hintText: string | null) {
  return hintText ?? '';
}

interface DecodedToken {
  userId: string;
  username: string;
  role: string;
  teamId: string;
}

export async function broadcastLeaderboard(io: Server) {
  try {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        score: true
      },
      orderBy: [
        { score: 'desc' },
        { updatedAt: 'asc' }
      ]
    });
    io.emit('leaderboard:update', teams);
  } catch (err: any) {
    console.error('Error broadcasting leaderboard:', err.message);
  }
}

export function registerSocketGateway(io: Server) {
  // Authentication Middleware
  io.use((socket: Socket, next) => {
    const isPublic = socket.handshake.auth?.isPublicLeaderboard;
    if (isPublic) {
      socket.data = {
        userId: 'guest-id',
        username: 'guest',
        role: 'GUEST',
        teamId: 'guest-team'
      };
      return next();
    }

    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, JWT_SECRET) as DecodedToken;
      socket.data = {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        teamId: decoded.teamId
      };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const { userId, username, teamId, role } = socket.data;
    console.log(`[Socket Connection] Debug Details: userId=${userId}, username=${username}, teamId=${teamId}, role=${role}`);

    if (role === 'GUEST') {
      console.log('Guest connected for public live standings tracker');
      await broadcastLeaderboard(io);
      return;
    }

    if (role === 'SUPER_ADMIN') {
      await socket.join('admin:room');
      console.log(`Super Admin ${username} connected to admin:room`);
      await broadcastLeaderboard(io);

      socket.on('admin:broadcast:alert', (data: { message: string }) => {
        console.log(`[Admin Broadcast] Emitting system announcement: ${data.message}`);
        io.emit('broadcast:alert', { message: data.message });
      });

      return;
    }

    const teamRoom = `team:${teamId}`;
    
    // Join the Socket.IO room for team broadcasts
    await socket.join(teamRoom);
    console.log(`User ${username} (${userId}) connected to room ${teamRoom}`);

    if (role === 'STUDENT') {
      onlineUsers.add(userId);
      console.log(`[Socket] Added STUDENT user ${userId} to onlineUsers. Active count: ${onlineUsers.size}`);
      io.to('admin:room').emit('admin:teams:refresh');
    }

    // Send initial team stats and level information
    const team = await getTeam(teamId);
    if (team) {
      const progress = await getTeamProgress(teamId);
      socket.emit('team:info', {
        team: { id: team.id, name: team.name, score: team.score, currentLevelId: team.currentLevelId },
        level: team.currentLevel,
        progress
      });
    } else {
      // Fallback: If team record was reset/deleted, send Level 1 data so UI tasks load cleanly
      const level1 = await prisma.level.findUnique({
        where: { id: 1 },
        include: { tasks: true }
      });
      socket.emit('team:info', {
        team: { id: teamId, name: username || 'CyberBandit Team', score: 0, currentLevelId: 1 },
        level: level1,
        progress: {}
      });
    }

    // Broadcast updated leaderboard to all upon new players entering
    await broadcastLeaderboard(io);

    // 1. Mount Sub-Task (triggers VFS copy on Redis)
    socket.on('task:mount', async (data: { taskId: string }) => {
      const { taskId } = data;
      try {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { level: true }
        });

        if (!task) {
          return socket.emit('error', { message: 'Task not found' });
        }

        if (role === 'STUDENT') {
          const teamObj = await prisma.team.findUnique({
            where: { id: teamId }
          });
          if (teamObj && task.levelId > teamObj.currentLevelId) {
            return socket.emit('error', { message: 'Access denied: task belongs to a locked level' });
          }
        }

        // Cache the active taskId in user socket data
        socket.data.activeTaskId = taskId;

        // Initialize user VFS and working directory in Redis
        const initialVfs = task.initialVFS as any as DirectoryNode;
        await initializeUserSession(userId, initialVfs, task.startDirectory);

        socket.emit('task:mounted', {
          taskId,
          taskName: task.name,
          cwd: task.startDirectory,
          hint: getClientHintText(task.hintText)
        });
      } catch (err: any) {
        socket.emit('error', { message: 'Failed to mount task: ' + err.message });
      }
    });

    // 2. Command Execution
    socket.on('command:execute', async (data: { commandLine: string; taskId?: string }) => {
      const { commandLine } = data;
      let activeTaskId = socket.data.activeTaskId || data.taskId;

      if (!activeTaskId) {
        const firstTask = await prisma.task.findFirst({ orderBy: { id: 'asc' } });
        if (firstTask) {
          activeTaskId = firstTask.id;
          socket.data.activeTaskId = activeTaskId;
          const initialVfs = firstTask.initialVFS as any as DirectoryNode;
          await initializeUserSession(userId, initialVfs, firstTask.startDirectory);
        } else {
          return socket.emit('terminal:output', {
            stdout: [],
            stderr: ['System: Please select and mount a task from the dashboard tab interface before typing commands.'],
            cwd: '/'
          });
        }
      }

      try {
        // Fetch active workspace state
        let vfs = await getUserVFS(userId);
        let cwd = await getUserCWD(userId);

        if (!vfs) {
          const activeTaskObj = await prisma.task.findUnique({ where: { id: activeTaskId } });
          if (activeTaskObj) {
            const initialVfs = activeTaskObj.initialVFS as any as DirectoryNode;
            await initializeUserSession(userId, initialVfs, activeTaskObj.startDirectory);
            vfs = await getUserVFS(userId);
            cwd = await getUserCWD(userId);
          }
        }

        if (!vfs) {
          return socket.emit('terminal:output', {
            stdout: [],
            stderr: ['System: VFS session expired. Please re-mount the task.'],
            cwd: '/'
          });
        }

        // Save entry history
        await pushHistory(userId, commandLine);

        // Run execution engine
        const executionResult = executeCommandLine(commandLine, cwd, vfs);

        // Save updated state variables back to Redis
        if (executionResult.vfsMutated && executionResult.newVFS) {
          await setUserVFS(userId, executionResult.newVFS);
        }
        if (executionResult.cwdMutated && executionResult.newCWD) {
          await setUserCWD(userId, executionResult.newCWD);
        }

        // Emit standard execution output back to player
        socket.emit('terminal:output', {
          stdout: executionResult.stdout,
          stderr: executionResult.stderr,
          cwd: executionResult.cwd,
          specialAction: executionResult.specialAction
        });


        // 3. Intercept & Evaluate SUBMIT_FLAG special actions
        if (executionResult.specialAction && executionResult.specialAction.action === 'SUBMIT_FLAG') {
          const submittedFlag = executionResult.specialAction.flag;
          
          const task = await prisma.task.findUnique({
            where: { id: activeTaskId },
            include: { level: { include: { tasks: true } } }
          }) as any;

          if (!task) {
            return socket.emit('terminal:output', {
              stdout: [],
              stderr: ['Evaluation Error: Mounted task is invalid.'],
              cwd: executionResult.cwd
            });
          }

          if (role === 'STUDENT') {
            const teamObj = await prisma.team.findUnique({
              where: { id: teamId }
            });
            if (!teamObj) {
              return socket.emit('terminal:output', {
                stdout: [],
                stderr: ['Evaluation Error: Team not found.'],
                cwd: executionResult.cwd
              });
            }
            if (task.levelId !== teamObj.currentLevelId) {
              return socket.emit('terminal:output', {
                stdout: [],
                stderr: [`Evaluation Error: Task level mismatch. Task belongs to Level ${task.levelId}, but your team is on Level ${teamObj.currentLevelId}.`],
                cwd: executionResult.cwd
              });
            }
            const progress = await getTeamProgress(teamId);
            if (progress[task.taskRole] === 'COMPLETED') {
              return socket.emit('terminal:output', {
                stdout: [],
                stderr: [`Evaluation Error: Task role ${task.taskRole} is already completed by your team.`],
                cwd: executionResult.cwd
              });
            }
          }

          const isCorrect = task.validationTarget.trim() === submittedFlag.trim();

          // Write record to database
          await recordSubmission({
            teamId,
            userId,
            taskId: activeTaskId,
            commandRun: commandLine,
            isCorrect
          });

          if (!isCorrect) {
            socket.emit('terminal:output', {
              stdout: [],
              stderr: ['[-] SECURE SHELL: Access Denied. Submitted flag is incorrect.'],
              cwd: executionResult.cwd
            });
          } else {
            // Task solved successfully!
            socket.emit('terminal:output', {
              stdout: ['[+] SECURE SHELL: Access Granted! Flag verified successfully.', ''],
              stderr: [],
              cwd: executionResult.cwd
            });

            // Update team progress dictionary: e.g., Set active task role as COMPLETED
            const progress = await getTeamProgress(teamId);
            progress[task.taskRole] = 'COMPLETED'; // Sets e.g. "TASK_A": "COMPLETED"
            await setTeamProgress(teamId, progress);

            // Broadcast task update notification to team room with updated score
            const updatedTeam = await prisma.team.findUnique({
              where: { id: teamId }
            });

            io.to(teamRoom).emit('task:completed', {
              userId,
              username,
              taskRole: task.taskRole,
              taskId: task.id,
              progress,
              score: updatedTeam?.score || 0
            });

            // Broadcast details to admin room
            io.to('admin:room').emit('admin:solve:alert', {
              teamName: updatedTeam?.name || 'Unknown Team',
              username,
              taskName: task.name,
              pointsAdded: task.points,
              newTotalScore: updatedTeam?.score || 0,
              timestamp: new Date().toISOString()
            });

            // Trigger admin teams list update
            io.to('admin:room').emit('admin:teams:refresh');

            // Update real-time leaderboard
            await broadcastLeaderboard(io);

            // Check if BOTH tasks of the level are completed
            const allTasksSolved = task.level.tasks.every((t: any) => progress[t.taskRole] === 'COMPLETED');
            
            if (allTasksSolved) {
              const nextLevelId = task.levelId + 1;
              const nextLevel = await prisma.level.findUnique({
                where: { id: nextLevelId },
                include: { tasks: true }
              });

              if (nextLevel) {
                // Advance team to the next level
                const updatedTeam = await advanceTeamLevel(teamId, nextLevelId);
                
                // Clear level progress keys for next level
                await setTeamProgress(teamId, {});

                // Recalculate leaderboard
                await updateLeaderboardScore(teamId, updatedTeam.score);
                await broadcastLeaderboard(io);

                // Trigger admin teams list update for level advancement
                io.to('admin:room').emit('admin:teams:refresh');

                // Broadcast team level:advance payload
                io.to(teamRoom).emit('level:advance', {
                  message: `Congratulations! Both Task A and Task B have been solved. Advancing to Level ${nextLevelId}!`,
                  nextLevelId,
                  level: nextLevel,
                  score: updatedTeam.score
                });
              } else {
                // No more levels. Match completed!
                const updatedTeam = await prisma.team.findUnique({ where: { id: teamId } });
                io.to(teamRoom).emit('match:completed', {
                  message: 'Excellent Work! You have completed all levels and finished the challenge!',
                  finalScore: updatedTeam?.score || 1000
                });
              }
            }
          }
        }
      } catch (err: any) {
        socket.emit('error', { message: 'Command execution failed: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      if (role === 'STUDENT') {
        onlineUsers.delete(userId);
        console.log(`[Socket] Removed STUDENT user ${userId} from onlineUsers. Active count: ${onlineUsers.size}`);
        io.to('admin:room').emit('admin:teams:refresh');
      }
      console.log(`User ${username} (${userId}) disconnected`);
    });
  });
}

export async function forceRefreshAllStudents(io: Server) {
  const sockets = await io.fetchSockets();
  for (const s of sockets) {
    if (s.data && s.data.role === 'STUDENT') {
      const teamId = s.data.teamId;
      const team = await getTeam(teamId);
      if (team) {
        const progress = await getTeamProgress(teamId);
        s.emit('team:info', {
          team: { id: team.id, name: team.name, score: team.score, currentLevelId: team.currentLevelId },
          level: team.currentLevel,
          progress
        });
      }
    }
  }
}
