import { NextRequest, NextResponse } from 'next/server';

import { buildVfsTree, walkVfs, resolvePath } from '@/utils/vfs';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/utils/db';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

// In-Memory Security Trackers (Layer 3 & 5)
const lastCommandTimes = new Map<string, number>();
const attemptsTracker = new Map<string, number>();
const lockoutTracker = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { commandLine, taskId, teamId, cwd: reqCwd, username: reqUsername } = await req.json();
    
    // Fallback for IP/Identity for rate limiting in serverless
    const ipIdentifier = req.headers.get('x-forwarded-for') || 'unknown-ip';
    const securityKey = `${ipIdentifier}-${teamId}`;

    if (commandLine === undefined || !taskId || !teamId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let cwd = reqCwd || '/home/student';
    
    const { rows: taskRows } = await db.query('SELECT * FROM "Task" WHERE id = $1', [taskId]);
    const currentTask = taskRows[0];
    if (!currentTask) return NextResponse.json({ output: 'Task context lost.' });
    let vfs = currentTask.initialVFS || buildVfsTree({});

    // Layer 4: Payload Size Guard
    if (commandLine.length > 512) {
      return NextResponse.json({
        output: '\x1b[31;1m[!] SECURITY ALERT:\x1b[0m Command payload too large. Maximum 512 characters allowed.',
        cwd: cwd
      });
    }

    // Layer 3: Command Rate Limiter (250ms threshold)
    const now = Date.now();
    const lastTime = lastCommandTimes.get(securityKey) || 0;
    if (now - lastTime < 250) {
      return NextResponse.json({
        output: '\x1b[31;1m[!] SECURITY ALERT:\x1b[0m Command execution rate limit exceeded (Max 4/sec). Slow down.',
        cwd: cwd
      });
    }
    lastCommandTimes.set(securityKey, now);

    const commandStr = commandLine.trim();
    let output = '';
    
    // Simulate generic commands
    const args = commandStr.split(' ').filter((a: string) => a.length > 0);
    const cmd = args[0] ? args[0].toLowerCase() : '';
    
    if (cmd === 'submit') {
      // Layer 5: Brute-Force Lockout Check
      const lockoutExpiry = lockoutTracker.get(securityKey) || 0;
      if (now < lockoutExpiry) {
        const timeLeft = Math.ceil((lockoutExpiry - now) / 1000);
        return NextResponse.json({
          output: `\x1b[31;1m[-] SECURE SHELL:\x1b[0m Submissions locked for ${timeLeft} seconds.`,
          newCwd: cwd, newVfs: vfs
        });
      }

      const flag = args.slice(1).join(' ');
      const task = currentTask;

      if (task.validationTarget.trim() === flag.trim()) {
         const client = await db.connect();
         
         try {
           const { rows: existingSubs } = await client.query('SELECT id FROM "Submission" WHERE "teamId" = $1 AND "taskId" = $2 AND "isCorrect" = true', [teamId, taskId]);
           if (existingSubs.length > 0) {
             client.release();
             return NextResponse.json({ output: 'SUCCESS! You have already solved this mission.', cwd, vfs });
           }

           output = 'SUCCESS! Flag captured.';
           attemptsTracker.delete(securityKey);

           const finalUsername = reqUsername || 'student';
           let { rows: users } = await client.query('SELECT id FROM "User" WHERE username = $1', [finalUsername]);
           let uId = users[0]?.id;
           if (!uId) {
             const { rows: tUsers } = await client.query('SELECT id FROM "User" WHERE "teamId" = $1 LIMIT 1', [teamId]);
             uId = tUsers[0]?.id;
           }

           await client.query('BEGIN');
           const { rows: teams } = await client.query('SELECT id, score, name, "currentLevelId" FROM "Team" WHERE id = $1', [teamId]);
           if (teams.length > 0) {
             const currentLevelId = teams[0].currentLevelId || 1;
             await client.query('UPDATE "Team" SET score = score + $1 WHERE id = $2', [task.points, teamId]);
             if (uId) {
               await client.query('INSERT INTO "Submission" (id, "teamId", "taskId", "userId", "commandRun", "isCorrect", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW())', [teamId, taskId, uId, commandStr]);
             }

             // Check if all tasks in the current level are solved
             const { rows: totalTasksRes } = await client.query('SELECT COUNT(*) AS total FROM "Task" WHERE "levelId" = $1', [currentLevelId]);
             const totalTasksCount = parseInt(totalTasksRes[0]?.total || '0', 10);

             const { rows: solvedTasksRes } = await client.query(
               'SELECT COUNT(DISTINCT s."taskId") AS solved FROM "Submission" s JOIN "Task" t ON s."taskId" = t.id WHERE s."teamId" = $1 AND s."isCorrect" = true AND t."levelId" = $2',
               [teamId, currentLevelId]
             );
             const solvedTasksCount = parseInt(solvedTasksRes[0]?.solved || '0', 10);

             if (solvedTasksCount >= totalTasksCount && totalTasksCount > 0) {
               // Fetch max level
               const { rows: maxLevelRes } = await client.query('SELECT MAX(id) AS max_id FROM "Level"');
               const maxLevelId = parseInt(maxLevelRes[0]?.max_id || '1', 10);
               
               if (currentLevelId < maxLevelId) {
                 await client.query('UPDATE "Team" SET "currentLevelId" = "currentLevelId" + 1 WHERE id = $1', [teamId]);
               }
             }

             await client.query('COMMIT');

             // Proper awaitable broadcasts with safety timeouts
             const adminChan = supabase.channel('admin:events');
             const p1 = new Promise<void>((resolve) => {
               const timer = setTimeout(() => resolve(), 400);
               adminChan.subscribe(async (status) => {
                 if (status === 'SUBSCRIBED') {
                   clearTimeout(timer);
                   await adminChan.send({
                     type: 'broadcast',
                     event: 'admin:solve:alert',
                     payload: { teamName: teams[0].name, username: finalUsername, taskName: task.name, pointsAdded: task.points }
                   });
                   await supabase.removeChannel(adminChan);
                   resolve();
                 } else {
                   clearTimeout(timer);
                   resolve();
                 }
               });
             });

             const pubChan = supabase.channel('public:leaderboard');
             const p2 = new Promise<void>((resolve) => {
               const timer = setTimeout(() => resolve(), 400);
               pubChan.subscribe(async (status) => {
                 if (status === 'SUBSCRIBED') {
                   clearTimeout(timer);
                   await pubChan.send({ type: 'broadcast', event: 'leaderboard:update', payload: {} });
                   await supabase.removeChannel(pubChan);
                   resolve();
                 } else {
                   clearTimeout(timer);
                   resolve();
                 }
               });
             });

             // Fire realtime broadcasts in the background (non-blocking)
             Promise.all([p1, p2]).catch(err => console.error("Realtime broadcast error:", err));
           } else {
             await client.query('ROLLBACK');
           }
         } catch (e: any) {
           await client.query('ROLLBACK');
           console.error('Fast PG Execute Error:', e);
         } finally {
           client.release();
         }

      } else {
         // Handle brute-force attempt increment
         const currentAttempts = (attemptsTracker.get(securityKey) || 0) + 1;
         attemptsTracker.set(securityKey, currentAttempts);
         
         if (currentAttempts >= 3) {
            lockoutTracker.set(securityKey, Date.now() + 30000); // 30s lockout
            attemptsTracker.delete(securityKey);
            output = `\x1b[31;1m[-] Access Denied:\x1b[0m Incorrect submission. Submissions locked for 30 seconds. (Debug: Expected: '${task.validationTarget}' / Received: '${flag}')`;
         } else {
            output = `\x1b[33m[-] Access Denied:\x1b[0m Incorrect submission. Attempt ${currentAttempts}/3 before lockout. (Debug: Expected: '${task.validationTarget}' / Received: '${flag}')`;
         }
      }
    } else {
      // General Command Processing Engine
      const target = args[1] || '';
      
      switch (cmd) {
        case 'pwd':
          output = cwd;
          break;
          
        case 'whoami':
          output = 'student';
          break;
          
        case 'clear':
          output = '\x1b[2J\x1b[3J\x1b[H'; // ANSI clear screen
          break;

        case 'cd': {
          if (!target) {
            cwd = '/home/student';
          } else {
            const nextPath = resolvePath(cwd, target);
            const node = walkVfs(vfs, nextPath);
            if (node && node.type === 'directory') cwd = nextPath;
            else output = `cd: ${target}: No such file or directory`;
          }
          break;
        }

        case 'ls': {
          let tDir = cwd;
          let showHidden = false;
          let showLong = false;
          
          for (const a of args.slice(1)) {
             if (a === '-a') showHidden = true;
             else if (a === '-al' || a === '-la' || a === '-l') { showHidden = true; showLong = true; }
             else if (!a.startsWith('-')) tDir = resolvePath(cwd, a);
          }
          
          const dirNode = walkVfs(vfs, tDir);
          if (!dirNode || dirNode.type !== 'directory') {
            output = `ls: cannot access '${target}': No such file or directory`;
          } else {
            const children = dirNode.children ? Object.values(dirNode.children) : [];
            const files = children.filter(c => showHidden || !c.name.startsWith('.'));
            
            if (showLong) {
               output = files.map(f => `${f.type === 'directory' ? 'd' : '-'}${f.permissions || 'rwxr-xr-x'} 1 ${f.owner || 'student'} ${f.group || 'student'} ${f.content ? f.content.length : 4096} ${f.name}`).join('\n');
            } else {
               output = files.map(f => f.name).join('  ');
            }
          }
          break;
        }

        case 'cat': {
          if (!target) output = 'cat: missing operand';
          else {
            const filePath = resolvePath(cwd, target);
            const fileNode = walkVfs(vfs, filePath);
            if (!fileNode) output = `cat: ${target}: No such file or directory`;
            else if (fileNode.type === 'directory') output = `cat: ${target}: Is a directory`;
            else output = fileNode.content || '';
          }
          break;
        }

        case 'file': {
          if (!target) output = 'file: missing operand';
          else {
            const fNode = walkVfs(vfs, resolvePath(cwd, target));
            if (!fNode) output = `file: ${target}: cannot open: No such file`;
            else if (fNode.type === 'directory') output = `${target}: directory`;
            else {
              if (fNode.name.endsWith('.sh') || fNode.content?.startsWith('#!/bin/bash')) output = `${target}: POSIX shell script, ASCII text executable`;
              else if (fNode.content?.includes('ELF')) output = `${target}: ELF 64-bit LSB executable`;
              else output = `${target}: ASCII text`;
            }
          }
          break;
        }

        case 'strings': {
          if (!target) output = 'strings: missing operand';
          else {
            const strNode = walkVfs(vfs, resolvePath(cwd, target));
            if (!strNode || strNode.type === 'directory') output = '';
            else output = (strNode.content || '').split('\n').filter(l => l.length > 3).join('\n');
            // Mock strings pipe grep usage gracefully
            if (commandStr.includes('|') && commandStr.includes('grep')) {
               const grepTarget = commandStr.split('grep')[1]?.trim().replace(/['"]/g, '');
               if (grepTarget) {
                 output = output.split('\n').filter(l => l.includes(grepTarget)).join('\n');
               }
            }
          }
          break;
        }

        case 'sort': {
          if (!target) output = 'sort: missing operand';
          else {
            const sortFile = walkVfs(vfs, resolvePath(cwd, target));
            if (!sortFile || sortFile.type === 'directory') output = `sort: ${target}: No such file`;
            else {
              let lines = (sortFile.content || '').split('\n');
              lines.sort();
              // Support `sort xxx | uniq` pattern mock
              if (commandStr.includes('|') && commandStr.includes('uniq')) {
                 lines = Array.from(new Set(lines));
              }
              output = lines.join('\n');
            }
          }
          break;
        }
        
        case 'nc':
        case 'netcat': {
           if (commandStr.includes('60000')) output = 'Y29tcGxldGVfMjAyNg==';
           else if (commandStr.includes('30001')) output = 'c2VydmVyX3NjcmFwZV9va2F5';
           else if (commandStr.includes('1337')) output = 'c2VjcmV0X2RhdGEudHh0';
           else if (commandStr.includes('50000')) output = 'ROT13:fhjnl';
           else output = 'nc: connect failed';
           break;
        }

        default:
          output = `bash: ${cmd}: command not found`;
      }
    }

    return NextResponse.json({
      output,
      cwd: cwd,
      vfs: vfs
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
