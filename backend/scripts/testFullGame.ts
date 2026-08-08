import { io, Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:5000';
const TEST_CODE = 'T3ST99';

async function cleanup() {
  // Clear any existing test team records to ensure clean slate
  const team = await prisma.team.findUnique({
    where: { inviteCode: TEST_CODE }
  });
  if (team) {
    await prisma.submission.deleteMany({ where: { teamId: team.id } });
    await prisma.user.deleteMany({ where: { teamId: team.id } });
    await prisma.team.delete({ where: { id: team.id } });
    console.log('[Cleanup] Removed pre-existing test team records.');
  }
}

async function runTest() {
  console.log('\n==================================================');
  console.log('  STARTING FULL GAME END-TO-END INTEGRATION TEST ');
  console.log('==================================================\n');

  await cleanup();

  // 1. Register test team via HTTP endpoint
  console.log('[1/7] Registering team "Test Crew" via HTTP...');
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamName: 'Test Crew' })
  });

  const regData = await regRes.json();
  if (regData.error) {
    throw new Error('Registration failed: ' + regData.error);
  }

  // Force database to map our custom test invite code
  await prisma.team.update({
    where: { id: regData.teamId },
    data: { inviteCode: TEST_CODE }
  });
  console.log(`[+] Team registered successfully. Custom invite code set: "${TEST_CODE}"`);

  // 2. Register/Join player user
  console.log('[2/7] Joining teammate user "bot_tester" via invite code...');
  const joinRes = await fetch(`${BACKEND_URL}/api/auth/join-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'bot_tester',
      password: 'testpassword123',
      inviteCode: TEST_CODE
    })
  });

  const joinData = await joinRes.json();
  if (joinData.error) {
    throw new Error('Join-team request failed: ' + joinData.error);
  }
  const token = joinData.token;
  console.log(`[+] Player registered. JWT session token generated: ${token.slice(0, 15)}...`);

  // 3. Connect via Socket.IO
  console.log('[3/7] Connecting to Socket.IO gateway with player credentials...');
  const socket: Socket = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket']
  });

  return new Promise<void>((resolve, reject) => {
    let taskList: any[] = [];
    let completedA = false;
    let completedB = false;

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Test timed out. Sockets did not reply or advance.'));
    }, 15000);

    socket.on('connect', () => {
      console.log('[+] Real-time Socket channel successfully connected.');
    });

    socket.on('team:info', (data: any) => {
      console.log(`[4/7] Team info loaded. Current level: "${data.level.title}" | Score: ${data.team.score}`);
      taskList = data.level.tasks;
      
      // Select and mount Task A
      const taskA = taskList.find(t => t.taskRole === 'TASK_A');
      if (taskA) {
        console.log(`[5/7] Mounting Task A: "${taskA.name}"...`);
        socket.emit('task:mount', { taskId: taskA.id });
      } else {
        socket.disconnect();
        reject(new Error('Task A not found in level list.'));
      }
    });

    socket.on('task:mounted', (data: any) => {
      console.log(`[+] Workspace mounted. CWD: "${data.cwd}"`);
      
      if (!completedA) {
        // Execute command and submit flag for Task A
        console.log('[6/7] Running commands in simulated shell...');
        socket.emit('command:execute', { commandLine: 'ls -la' });
        
        setTimeout(() => {
          console.log('[+] Submitting correct flag key for Task A...');
          socket.emit('command:execute', { commandLine: 'submit flag{welcome_to_linux_terminal_challenges}' });
        }, 1000);
      } else if (!completedB) {
        // Submitting flag for Task B
        console.log('[7/7] Submitting correct flag key for Task B...');
        socket.emit('command:execute', { commandLine: 'submit flag{hidden_files_begin_with_dot}' });
      }
    });

    socket.on('terminal:output', (data: any) => {
      if (data.stdout && data.stdout.length > 0) {
        data.stdout.forEach((line: string) => {
          if (line.includes('SECURE SHELL') || line.includes('verified')) {
            console.log(`    [Server Output] ${line.trim()}`);
          }
        });
      }
      if (data.stderr && data.stderr.length > 0) {
        data.stderr.forEach((line: string) => console.log(`    [Server Error] ${line.trim()}`));
      }
    });

    socket.on('task:completed', (data: any) => {
      console.log(`[+] Task completion broadcast received! Solver: ${data.username} | Role: ${data.taskRole} | Score: ${data.score}`);
      
      if (data.taskRole === 'TASK_A') {
        completedA = true;
        // Mount Task B
        const taskB = taskList.find(t => t.taskRole === 'TASK_B');
        if (taskB) {
          console.log('[+] Mounting Task B: "' + taskB.name + '"...');
          socket.emit('task:mount', { taskId: taskB.id });
        }
      } else if (data.taskRole === 'TASK_B') {
        completedB = true;
      }
    });

    socket.on('level:advance', (data: any) => {
      console.log(`\n\x1b[1;32m==================================================\x1b[0m`);
      console.log(`\x1b[1;32m   CONGRATULATIONS! LEVEL ADVANCED SUCCESSFULLY!  \x1b[0m`);
      console.log(`  Message:    ${data.message}`);
      console.log(`  Next Level: Level ${data.nextLevelId} - ${data.level.title}`);
      console.log(`  New Score:  ${data.score} pts`);
      console.log(`\x1b[1;32m==================================================\x1b[0m\n`);
      
      clearTimeout(timeout);
      socket.disconnect();
      cleanup().then(() => resolve()).catch(reject);
    });

    socket.on('error', (err: any) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(new Error('Socket raised an error: ' + err.message));
    });
  });
}

runTest()
  .then(() => {
    console.log('Integration test run completed successfully without errors.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\x1b[1;31m[Test Failed]\x1b[0m', err);
    process.exit(1);
  });
