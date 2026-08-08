import { PrismaClient, ValidationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.submission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.level.deleteMany({});

  console.log('Seeding levels and tasks...');

  // Level 1
  const level1 = await prisma.level.create({
    data: {
      id: 1,
      title: 'Level 1: Shell Navigation Essentials',
      description: 'Acclimate to path changes, hidden files, and command structures.',
      points: 100,
    },
  });

  await prisma.task.create({
    data: {
      levelId: level1.id,
      name: 'Task 1A: Inspect the Flag',
      taskRole: 'TASK_A',
      startDirectory: '/home/student',
      initialVFS: {
        name: '/',
        type: 'directory',
        permissions: '755',
        owner: 'root',
        group: 'root',
        children: {
          home: {
            name: 'home',
            type: 'directory',
            permissions: '755',
            owner: 'root',
            group: 'root',
            children: {
              student: {
                name: 'student',
                type: 'directory',
                permissions: '700',
                owner: 'student',
                group: 'student',
                children: {
                  'flag.txt': {
                    name: 'flag.txt',
                    type: 'file',
                    permissions: '644',
                    owner: 'student',
                    group: 'student',
                    content: 'flag{welcome_to_linux_terminal_challenges}'
                  }
                }
              }
            }
          }
        }
      },
      validationType: ValidationType.OUTPUT,
      validationTarget: 'flag{welcome_to_linux_terminal_challenges}',
      hintText: 'Type "cat flag.txt" to read the content of the file and type "submit <content>" to submit.',
    },
  });

  await prisma.task.create({
    data: {
      levelId: level1.id,
      name: 'Task 1B: Find Hidden Backups',
      taskRole: 'TASK_B',
      startDirectory: '/home/student',
      initialVFS: {
        name: '/',
        type: 'directory',
        permissions: '755',
        owner: 'root',
        group: 'root',
        children: {
          home: {
            name: 'home',
            type: 'directory',
            permissions: '755',
            owner: 'root',
            group: 'root',
            children: {
              student: {
                name: 'student',
                type: 'directory',
                permissions: '700',
                owner: 'student',
                group: 'student',
                children: {
                  '.backup_file': {
                    name: '.backup_file',
                    type: 'file',
                    permissions: '644',
                    owner: 'student',
                    group: 'student',
                    content: 'flag{hidden_files_begin_with_dot}'
                  }
                }
              }
            }
          }
        }
      },
      validationType: ValidationType.OUTPUT,
      validationTarget: 'flag{hidden_files_begin_with_dot}',
      hintText: 'Use "ls -a" to view hidden files, then "cat .backup_file". Submit the value with "submit <flag>".',
    },
  });

  // Level 2
  const level2 = await prisma.level.create({
    data: {
      id: 2,
      title: 'Level 2: Pipelines & Grepping Logs',
      description: 'Learn to pipe stdout stream streams and match patterns.',
      points: 200,
    },
  });

  await prisma.task.create({
    data: {
      levelId: level2.id,
      name: 'Task 2A: Find Threat Flag',
      taskRole: 'TASK_A',
      startDirectory: '/home/student',
      initialVFS: {
        name: '/',
        type: 'directory',
        permissions: '755',
        owner: 'root',
        group: 'root',
        children: {
          home: {
            name: 'home',
            type: 'directory',
            permissions: '755',
            owner: 'root',
            group: 'root',
            children: {
              student: {
                name: 'student',
                type: 'directory',
                permissions: '700',
                owner: 'student',
                group: 'student',
                children: {
                  'server_audit.log': {
                    name: 'server_audit.log',
                    type: 'file',
                    permissions: '644',
                    owner: 'student',
                    group: 'student',
                    content: '[INFO] Port 22 scanner connection\n[DEBUG] Heartbeat ok\n[CRITICAL] SQL Injection attempt found. Flag: flag{grep_keeps_critical_events_clear}\n[INFO] Session timeout'
                  }
                }
              }
            }
          }
        }
      },
      validationType: ValidationType.OUTPUT,
      validationTarget: 'flag{grep_keeps_critical_events_clear}',
      hintText: 'Learn to use grep: "cat server_audit.log | grep CRITICAL". Submit the flag.',
    },
  });

  await prisma.task.create({
    data: {
      levelId: level2.id,
      name: 'Task 2B: Count Warning Lines',
      taskRole: 'TASK_B',
      startDirectory: '/home/student',
      initialVFS: {
        name: '/',
        type: 'directory',
        permissions: '755',
        owner: 'root',
        group: 'root',
        children: {
          home: {
            name: 'home',
            type: 'directory',
            permissions: '755',
            owner: 'root',
            group: 'root',
            children: {
              student: {
                name: 'student',
                type: 'directory',
                permissions: '700',
                owner: 'student',
                group: 'student',
                children: {
                  'auth.log': {
                    name: 'auth.log',
                    type: 'file',
                    permissions: '644',
                    owner: 'student',
                    group: 'student',
                    content: '[WARNING] Invalid password\n[INFO] User logins\n[WARNING] Attempt admin expired\n[INFO] Exit server'
                  }
                }
              }
            }
          }
        }
      },
      validationType: ValidationType.OUTPUT,
      validationTarget: '2',
      hintText: 'Use "cat auth.log | grep WARNING | wc -l" to get the count. Submit the number (e.g. submit 2).',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
