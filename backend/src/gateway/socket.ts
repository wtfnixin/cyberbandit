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

interface DecodedToken {
  userId: string;
  username: string;
  role: string;
  teamId: string;
}

async function broadcastLeaderboard(io: Server) {
  try {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        score: true
      },
      orderBy: {
        score: 'desc'
      },
      take: 10
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

    if (role === 'GUEST') {
      console.log('Guest connected for public live standings tracker');
      await broadcastLeaderboard(io);
      return;
    }

    if (role === 'SUPER_ADMIN') {
      await socket.join('admin:room');
      console.log(`Super Admin ${username} connected to admin:room`);
      await broadcastLeaderboard(io);
      return;
    }

    const teamRoom = `team:${teamId}`;
    
    // Join the Socket.IO room for team broadcasts
    await socket.join(teamRoom);
    console.log(`User ${username} (${userId}) connected to room ${teamRoom}`);

    // Send initial team stats and level information
    const team = await getTeam(teamId);
    if (team) {
      const progress = await getTeamProgress(teamId);
      socket.emit('team:info', {
        team: { id: team.id, name: team.name, score: team.score, currentLevelId: team.currentLevelId },
        level: team.currentLevel,
        progress
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

        // Cache the active taskId in user socket data
        socket.data.activeTaskId = taskId;

        // Initialize user VFS and working directory in Redis
        const initialVfs = task.initialVFS as any as DirectoryNode;
        await initializeUserSession(userId, initialVfs, task.startDirectory);

        socket.emit('task:mounted', {
          taskId,
          taskName: task.name,
          cwd: task.startDirectory,
          hint: task.hintText
        });
      } catch (err: any) {
        socket.emit('error', { message: 'Failed to mount task: ' + err.message });
      }
    });

    // 2. Command Execution
    socket.on('command:execute', async (data: { commandLine: string }) => {
      const { commandLine } = data;
      const activeTaskId = socket.data.activeTaskId;

      if (!activeTaskId) {
        return socket.emit('terminal:output', {
          stdout: [],
          stderr: ['System: Please select and mount a task from the dashboard tab interface before typing commands.'],
          cwd: '/'
        });
      }

      try {
        // Fetch active workspace state
        const vfs = await getUserVFS(userId);
        const cwd = await getUserCWD(userId);

        if (!vfs) {
          return socket.emit('terminal:output', {
            stdout: [],
            stderr: ['System: VFS session expired. Please re-mount the task.'],
            cwd
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

        // Broadcast telemetry logs to admin panel
        const teamObj = await getTeam(teamId);
        io.to('admin:room').emit('admin:activity:feed', {
          teamName: teamObj?.name || 'Unknown Team',
          username,
          commandLine,
          cwd: executionResult.cwd,
          timestamp: new Date().toISOString()
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
      console.log(`User ${username} (${userId}) disconnected`);
    });
  });
}
