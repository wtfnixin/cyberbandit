import { prisma } from './db';
import { ValidationType } from '@prisma/client';
import { redis } from './redis';

function buildVfsTree(files: Record<string, string>) {
  const root: any = {
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
            children: {}
          }
        }
      }
    }
  };

  for (const [fullPath, content] of Object.entries(files)) {
    const normalizedPath = fullPath.startsWith('/') ? fullPath : `/home/student/${fullPath}`;
    const parts = normalizedPath.split('/').filter(Boolean);
    
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      
      if (!current.children) {
        current.children = {};
      }
      
      if (isLast) {
        current.children[part] = {
          name: part,
          type: 'file',
          permissions: part.startsWith('.') ? '600' : '644',
          owner: normalizedPath.startsWith('/home/student') ? 'student' : 'root',
          group: normalizedPath.startsWith('/home/student') ? 'student' : 'root',
          content: content
        };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'directory',
            permissions: '755',
            owner: normalizedPath.startsWith('/home/student') ? 'student' : 'root',
            group: normalizedPath.startsWith('/home/student') ? 'student' : 'root',
            children: {}
          };
        }
        current = current.children[part];
      }
    }
  }

  return root;
}

export async function seedSystemLevels(): Promise<void> {
  // 1. Clear submissions, tasks, and reset all teams to level 1 and 0 score
  await prisma.submission.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.team.updateMany({
    data: {
      currentLevelId: 1,
      score: 0,
      streakCount: 0
    }
  });

  // Ensure Level 1 exists
  await prisma.level.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, title: 'Level 1: The Suspicious Update Script', description: 'Init', points: 100 }
  });

  // Clear all Redis session progress cache
  const keys = await redis.keys('*');
  if (keys.length > 0) {
    await redis.del(keys);
  }

  // 2. Syllabus levels data array (3 Tasks per level)
  const levelsData = [
    {
      id: 1,
      title: "Level 1: The Suspicious Update Script",
      description: "A developer running system maintenance left behind a script that modifies configuration directories.",
      points: 100,
      tasks: [
        {
          name: "Task 1: Identify Script Type",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "update.sh": "#!/bin/bash\necho 'Performing updates...'\nmv config/* level1_secrets/\necho 'Complete.'",
            "level1_secrets/settings.conf": "Host: 127.0.0.1\nPort: 8080\nEnv: production"
          }),
          validationType: "OUTPUT",
          validationTarget: "POSIX shell script",
          hintText: "Verify the script type in current folder using: file update.sh"
        },
        {
          name: "Task 2: Locate Config Reference",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "update.sh": "#!/bin/bash\necho 'Performing updates...'\nmv config/* level1_secrets/\necho 'Complete.'",
            "level1_secrets/settings.conf": "Host: 127.0.0.1\nPort: 8080\nEnv: production"
          }),
          validationType: "OUTPUT",
          validationTarget: "level1_secrets",
          hintText: "Browse script configuration reference destination using: cat update.sh"
        },
        {
          name: "Task 3: Read Config Port",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "update.sh": "#!/bin/bash\necho 'Performing updates...'\nmv config/* level1_secrets/\necho 'Complete.'",
            "level1_secrets/settings.conf": "Host: 127.0.0.1\nPort: 8080\nEnv: production"
          }),
          validationType: "OUTPUT",
          validationTarget: "8080",
          hintText: "Navigate inside level1_secrets folder and locate the Port key inside settings.conf."
        }
      ]
    },
    {
      id: 2,
      title: "Level 2: Hidden Log Files",
      description: "A critical system crash occurred, but logs were written to a hidden lock file.",
      points: 200,
      tasks: [
        {
          name: "Task 1: Spot the Hidden Log",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".error_log": "[INFO] Start server\n[CRITICAL] Package size exceeded 1033\n[DEBUG] Terminating thread",
            "backup_config": "activation_99".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: ".error_log",
          hintText: "List files folder contents including hidden files: ls -la"
        },
        {
          name: "Task 2: Read Anomalous Warning",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".error_log": "[INFO] Start server\n[CRITICAL] Package size exceeded 1033\n[DEBUG] Terminating thread",
            "backup_config": "activation_99".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: "1033",
          hintText: "Search for critical issues from hidden logs: grep 'critical' .error_log"
        },
        {
          name: "Task 3: Find Backup Config",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".error_log": "[INFO] Start server\n[CRITICAL] Package size exceeded 1033\n[DEBUG] Terminating thread",
            "backup_config": "activation_99".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: "activation_99",
          hintText: "Locate exact backup files with size 1033 bytes: find . -type f -size 1033c"
        }
      ]
    },
    {
      id: 3,
      title: "Level 3: Network File Transmission",
      description: "A remote monitoring process is pushing Base64-encoded filenames over a local socket loopback.",
      points: 300,
      tasks: [
        {
          name: "Task 1: Query local listener",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "secret_data.txt": "db_master_pass"
          }),
          validationType: "OUTPUT",
          validationTarget: "c2VjcmV0X2RhdGEudHh0",
          hintText: "Query query port listener 1337: nc localhost 1337"
        },
        {
          name: "Task 2: Decipher Filename",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "secret_data.txt": "db_master_pass"
          }),
          validationType: "OUTPUT",
          validationTarget: "secret_data.txt",
          hintText: "Decode the base64 formatted payload: echo \"c2VjcmV0X2RhdGEudHh0\" | base64 -d"
        },
        {
          name: "Task 3: Extract Password",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "secret_data.txt": "db_master_pass"
          }),
          validationType: "OUTPUT",
          validationTarget: "db_master_pass",
          hintText: "Retrieve decrypted file details inside data target: cat secret_data.txt"
        }
      ]
    },
    {
      id: 4,
      title: "Level 4: Log Deduplication",
      description: "An intruder hijacked the scheduler and flooded raw access logs with repeated decoy lines.",
      points: 400,
      tasks: [
        {
          name: "Task 1: Locate Log Source",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "auth_backup.txt": "[AUDIT] session open\n[AUDIT] session open\nROT13:pelcgb\n[AUDIT] session open"
          }),
          validationType: "OUTPUT",
          validationTarget: "auth_backup.txt",
          hintText: "List directory files to locate output records: ls -la"
        },
        {
          name: "Task 2: Extract Unique Line",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "auth_backup.txt": "[AUDIT] session open\n[AUDIT] session open\nROT13:pelcgb\n[AUDIT] session open"
          }),
          validationType: "OUTPUT",
          validationTarget: "pelcgb",
          hintText: "Isolate unique log records using: sort auth_backup.txt | uniq -u"
        },
        {
          name: "Task 3: Decrypt Username",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "auth_backup.txt": "[AUDIT] session open\n[AUDIT] session open\nROT13:pelcgb\n[AUDIT] session open"
          }),
          validationType: "OUTPUT",
          validationTarget: "crypto",
          hintText: "Apply a characters offset ROT13 shift decode: echo \"pelcgb\" | tr 'A-Za-z' 'N-ZA-Mn-za-m'"
        }
      ]
    },
    {
      id: 5,
      title: "Level 5: Binary Strings Extraction",
      description: "The developer compiled system access credentials directly into a database management executable.",
      points: 500,
      tasks: [
        {
          name: "Task 1: Verify Binary File",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "main.exe": "ELF_HEADER_PLACEHOLDER\nkey=cGFzc19zdWNjZXNz"
          }),
          validationType: "OUTPUT",
          validationTarget: "ELF 64-bit LSB executable",
          hintText: "Confirm machine executable type config: file main.exe"
        },
        {
          name: "Task 2: Extract String Parameters",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "main.exe": "ELF_HEADER_PLACEHOLDER\nkey=cGFzc19zdWNjZXNz"
          }),
          validationType: "OUTPUT",
          validationTarget: "cGFzc19zdWNjZXNz",
          hintText: "Read binary variables matching database keyword: strings main.exe | grep 'key'"
        },
        {
          name: "Task 3: Decode Payload",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "main.exe": "ELF_HEADER_PLACEHOLDER\nkey=cGFzc19zdWNjZXNz"
          }),
          validationType: "OUTPUT",
          validationTarget: "pass_success",
          hintText: "Submit plain text password from base64 decode: echo \"cGFzc19zdWNjZXNz\" | base64 -d"
        }
      ]
    },
    {
      id: 6,
      title: "Level 6: Navigating the Space Vault",
      description: "Security policies enforce namespaces containing space characters.",
      points: 600,
      tasks: [
        {
          name: "Task 1: Locate Invisible Directory",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".vault/secret passcode": "vault_opened_2026"
          }),
          validationType: "OUTPUT",
          validationTarget: ".vault",
          hintText: "List hidden directories using: ls -la"
        },
        {
          name: "Task 2: Navigate and Find Spaced File",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".vault/secret passcode": "vault_opened_2026"
          }),
          validationType: "OUTPUT",
          validationTarget: "secret passcode",
          hintText: "Check hidden folder files layout: cd .vault && ls -la"
        },
        {
          name: "Task 3: Read File Contents",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".vault/secret passcode": "vault_opened_2026"
          }),
          validationType: "OUTPUT",
          validationTarget: "vault_opened_2026",
          hintText: "Use double quotes option format parameters to print spaced filename content: cat \".vault/secret passcode\""
        }
      ]
    },
    {
      id: 7,
      title: "Level 7: Deduplication and Redirection",
      description: "System updates generated duplicate configs; only the single unique record points to valid entries.",
      points: 700,
      tasks: [
        {
          name: "Task 1: Inspect Config File",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "data.txt": "/opt/backup\n/opt/backup\n/var/opt/secrets_dir\n/opt/backup",
            "/var/opt/secrets_dir/token.txt": "active_token_99"
          }),
          validationType: "OUTPUT",
          validationTarget: "data.txt",
          hintText: "Read variables inside raw files: cat data.txt"
        },
        {
          name: "Task 2: Filter Unique Path",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "data.txt": "/opt/backup\n/opt/backup\n/var/opt/secrets_dir\n/opt/backup",
            "/var/opt/secrets_dir/token.txt": "active_token_99"
          }),
          validationType: "OUTPUT",
          validationTarget: "/var/opt/secrets_dir",
          hintText: "Clean duplicate routes listing using sort/uniq: sort data.txt | uniq -u"
        },
        {
          name: "Task 3: Extract Roster Token",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "data.txt": "/opt/backup\n/opt/backup\n/var/opt/secrets_dir\n/opt/backup",
            "/var/opt/secrets_dir/token.txt": "active_token_99"
          }),
          validationType: "OUTPUT",
          validationTarget: "active_token_99",
          hintText: "Open the decrypted activation index: cat /var/opt/secrets_dir/token.txt"
        }
      ]
    },
    {
      id: 8,
      title: "Level 8: Encrypted File Dispatch",
      description: "Security telemetry dispatches ROT13 encrypted destination paths inside public directories.",
      points: 800,
      tasks: [
        {
          name: "Task 1: Spot Encryption File",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "cipher.txt": "ROT13:yriry8_inhyg",
            "level8_vault/pass.conf": "key_valid"
          }),
          validationType: "OUTPUT",
          validationTarget: "cipher.txt",
          hintText: "Find the text file containing system encryption details: ls -la"
        },
        {
          name: "Task 2: Decrypt Folder Name",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "cipher.txt": "ROT13:yriry8_inhyg",
            "level8_vault/pass.conf": "key_valid"
          }),
          validationType: "OUTPUT",
          validationTarget: "level8_vault",
          hintText: "ROT13 translate output target: cat cipher.txt | tr 'A-Za-z' 'N-ZA-Mn-za-m'"
        },
        {
          name: "Task 3: Read Passcode details",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "cipher.txt": "ROT13:yriry8_inhyg",
            "level8_vault/pass.conf": "key_valid"
          }),
          validationType: "OUTPUT",
          validationTarget: "key_valid",
          hintText: "Inspect passcode keys: cd level8_vault && cat pass.conf"
        }
      ]
    },
    {
      id: 9,
      title: "Level 9: Precision File Search",
      description: "A cluster node dropped system diagnostics inside a multi-nested directory structure.",
      points: 900,
      tasks: [
        {
          name: "Task 1: Search File by Size",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "diagnostics/node1/logs": "placeholder info",
            "diagnostics/node2/logs": "log ok",
            "diagnostics/node3/logs": "diag_db_password".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: "./diagnostics/node3/logs",
          hintText: "Find file under diagnostics tree matching size exactly 1033 bytes: find diagnostics -type f -size 1033c"
        },
        {
          name: "Task 2: Check File Encoding",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "diagnostics/node1/logs": "placeholder info",
            "diagnostics/node2/logs": "log ok",
            "diagnostics/node3/logs": "diag_db_password".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: "ASCII text",
          hintText: "Confirm target encoding format: file ./diagnostics/node3/logs"
        },
        {
          name: "Task 3: Read Diagnostics Password",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "diagnostics/node1/logs": "placeholder info",
            "diagnostics/node2/logs": "log ok",
            "diagnostics/node3/logs": "diag_db_password".padEnd(1033, ' ')
          }),
          validationType: "OUTPUT",
          validationTarget: "diag_db_password",
          hintText: "Read configuration password parameter: cat ./diagnostics/node3/logs"
        }
      ]
    },
    {
      id: 10,
      title: "Level 10: Remote Port Query",
      description: "A background daemon listener handles token query events via local port bindings.",
      points: 1000,
      tasks: [
        {
          name: "Task 1: Read Bind Port Details",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "endpoints.txt": "Port: 30001"
          }),
          validationType: "OUTPUT",
          validationTarget: "30001",
          hintText: "Validate localhost bind port definitions: cat endpoints.txt"
        },
        {
          name: "Task 2: query Network Stream",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "endpoints.txt": "Port: 30001"
          }),
          validationType: "OUTPUT",
          validationTarget: "c2VydmVyX3NjcmFwZV9va2F5",
          hintText: "Connect to target using netcat connection parameters: nc localhost 30001"
        },
        {
          name: "Task 3: Decode Domain Code",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "endpoints.txt": "Port: 30001"
          }),
          validationType: "OUTPUT",
          validationTarget: "server_scrape_okay",
          hintText: "Translate target using base64 decoding utilities: echo \"c2VydmVyX3NjcmFwZV9va2F5\" | base64 -d"
        }
      ]
    },
    {
      id: 11,
      title: "Level 11: Relative Shell Bypass",
      description: "Filenames starting with special shell redirects can lock input flows.",
      points: 1100,
      tasks: [
        {
          name: "Task 1: Find Shell-Protected File",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "-": "cGFzc19kYXNoXzEx"
          }),
          validationType: "OUTPUT",
          validationTarget: "-",
          hintText: "Locate the file starting with a hyphen: ls -la"
        },
        {
          name: "Task 2: Read Relative Path",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "-": "cGFzc19kYXNoXzEx"
          }),
          validationType: "OUTPUT",
          validationTarget: "cGFzc19kYXNoXzEx",
          hintText: "Bypass shell parameter lookup via relative naming sequence: cat ./-"
        },
        {
          name: "Task 3: Retrieve Plaintext",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "-": "cGFzc19kYXNoXzEx"
          }),
          validationType: "OUTPUT",
          validationTarget: "pass_dash_11",
          hintText: "Decode base64 validation value inside: echo \"cGFzc19kYXNoXzEx\" | base64 -d"
        }
      ]
    },
    {
      id: 12,
      title: "Level 12: System Service Strings",
      description: "System services run compiled processes that cache credentials inside binary variables.",
      points: 1200,
      tasks: [
        {
          name: "Task 1: Locate Hidden Binary",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".service.bin": "BINARY_PLACEHOLDER\ntoken=ROT13:greg"
          }),
          validationType: "OUTPUT",
          validationTarget: ".service.bin",
          hintText: "Check folder contents for hidden files: ls -la"
        },
        {
          name: "Task 2: Scan Binary Strings",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".service.bin": "BINARY_PLACEHOLDER\ntoken=ROT13:greg"
          }),
          validationType: "OUTPUT",
          validationTarget: "token=ROT13:greg",
          hintText: "Grep for definitions containing equal signs inside compiled structures: strings .service.bin | grep '='"
        },
        {
          name: "Task 3: Decipher Server Secret",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            ".service.bin": "BINARY_PLACEHOLDER\ntoken=ROT13:greg"
          }),
          validationType: "OUTPUT",
          validationTarget: "test",
          hintText: "Translate the target variable value using ROT13: echo \"greg\" | tr 'A-Za-z' 'N-ZA-Mn-za-m'"
        }
      ]
    },
    {
      id: 13,
      title: "Level 13: Spaced Files and Keyword Filters",
      description: "Database backups are stored using space-separated filenames.",
      points: 1300,
      tasks: [
        {
          name: "Task 1: Spot Backup File",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "database config": "db_host=localhost\ndatabase_port=5432\ndb_user=student"
          }),
          validationType: "OUTPUT",
          validationTarget: "database config",
          hintText: "Locate configuration backup file: ls -la"
        },
        {
          name: "Task 2: Filter Port Config",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "database config": "db_host=localhost\ndatabase_port=5432\ndb_user=student"
          }),
          validationType: "OUTPUT",
          validationTarget: "database_port=5432",
          hintText: "Access variables using quotes to check targets: cat \"database config\" | grep 'port'"
        },
        {
          name: "Task 3: Isolate Port Number",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "database config": "db_host=localhost\ndatabase_port=5432\ndb_user=student"
          }),
          validationType: "OUTPUT",
          validationTarget: "5432",
          hintText: "Submit backup port integer: 5432"
        }
      ]
    },
    {
      id: 14,
      title: "Level 14: Log Traffic Forensic",
      description: "A developer deployed a test endpoint, but forgot which unique folder was accessed.",
      points: 1400,
      tasks: [
        {
          name: "Task 1: Read Endpoint traffic",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "web.log": "/api/users\n/api/users\n/etc/unique_auth/\n/api/users",
            "/etc/unique_auth/credentials.txt": "auth_level_14"
          }),
          validationType: "OUTPUT",
          validationTarget: "web.log",
          hintText: "Read raw server weblogs: cat web.log"
        },
        {
          name: "Task 2: Isolate Anomalous Endpoint",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "web.log": "/api/users\n/api/users\n/etc/unique_auth/\n/api/users",
            "/etc/unique_auth/credentials.txt": "auth_level_14"
          }),
          validationType: "OUTPUT",
          validationTarget: "/etc/unique_auth/",
          hintText: "Sort logs sequence and check for unique entries: sort web.log | uniq -u"
        },
        {
          name: "Task 3: Read Endpoint settings",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "web.log": "/api/users\n/api/users\n/etc/unique_auth/\n/api/users",
            "/etc/unique_auth/credentials.txt": "auth_level_14"
          }),
          validationType: "OUTPUT",
          validationTarget: "auth_level_14",
          hintText: "cat configuration coordinates from details path: cat /etc/unique_auth/credentials.txt"
        }
      ]
    },
    {
      id: 15,
      title: "Level 15: Secured Dispatch Port",
      description: "A secure dispatcher service listens on an alternative port.",
      points: 1500,
      tasks: [
        {
          name: "Task 1: Read Dispatch settings",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "ports.conf": "dispatcher_port: 50000"
          }),
          validationType: "OUTPUT",
          validationTarget: "50000",
          hintText: "Inspect active server port parameters: cat ports.conf"
        },
        {
          name: "Task 2: query Dispatch Socket",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "ports.conf": "dispatcher_port: 50000"
          }),
          validationType: "OUTPUT",
          validationTarget: "ROT13:fhjnl",
          hintText: "Connect to target dispatch port using netcat: nc localhost 50000"
        },
        {
          name: "Task 3: Decrypt Dispatcher Key",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "ports.conf": "dispatcher_port: 50000"
          }),
          validationType: "OUTPUT",
          validationTarget: "subway",
          hintText: "Translate the cipher key using ROT13 shifts: echo \"fhjnl\" | tr 'A-Za-z' 'N-ZA-Mn-za-m'"
        }
      ]
    },
    {
      id: 16,
      title: "Level 16: Backup Size Inspection",
      description: "Target config variables are hidden inside multi-nested log folders.",
      points: 1600,
      tasks: [
        {
          name: "Task 1: Locate Target Backup file",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "/var/backups/node1.conf": "pass_18_val"
          }),
          validationType: "OUTPUT",
          validationTarget: "/var/backups/node1.conf",
          hintText: "Find configurations file matching size exactly 12 bytes: find /var/backups -type f -size 12c"
        },
        {
          name: "Task 2: Classify configuration type",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "/var/backups/node1.conf": "pass_18_val"
          }),
          validationType: "OUTPUT",
          validationTarget: "ASCII text",
          hintText: "Check target file meta type parameters: file /var/backups/node1.conf"
        },
        {
          name: "Task 3: Output config key",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "/var/backups/node1.conf": "pass_18_val"
          }),
          validationType: "OUTPUT",
          validationTarget: "pass_18_val",
          hintText: "Output secret configurations line: cat /var/backups/node1.conf"
        }
      ]
    },
    {
      id: 17,
      title: "Level 17: Hidden Vault Credentials",
      description: "Passwords are hidden inside hidden subdirectories to bypass quick file lookups.",
      points: 1700,
      tasks: [
        {
          name: "Task 1: List Vault Contents",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "vault/.passcode": "YWN0aXZhdGVfMTc="
          }),
          validationType: "OUTPUT",
          validationTarget: ".passcode",
          hintText: "Identify hidden variables file inside the vault: cd vault && ls -la"
        },
        {
          name: "Task 2: Read Hidden Passcode",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "vault/.passcode": "YWN0aXZhdGVfMTc="
          }),
          validationType: "OUTPUT",
          validationTarget: "YWN0aXZhdGVfMTc=",
          hintText: "Examine hidden file payload details: cat vault/.passcode"
        },
        {
          name: "Task 3: Decode base64 vault passcode",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "vault/.passcode": "YWN0aXZhdGVfMTc="
          }),
          validationType: "OUTPUT",
          validationTarget: "activate_17",
          hintText: "Submit the base64 decoded string: echo \"YWN0aXZhdGVfMTc=\" | base64 -d"
        }
      ]
    },
    {
      id: 18,
      title: "Level 18: local Binary Strings",
      description: "Executable checkers embed system credentials inside compiled string tables.",
      points: 1800,
      tasks: [
        {
          name: "Task 1: Identify local Binary",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "list_check": "BINARY_PLACEHOLDER\nflag=ROT13:grag"
          }),
          validationType: "OUTPUT",
          validationTarget: "ELF 64-bit LSB executable",
          hintText: "Check system executable type specification: file list_check"
        },
        {
          name: "Task 2: Extract text indicators",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "list_check": "BINARY_PLACEHOLDER\nflag=ROT13:grag"
          }),
          validationType: "OUTPUT",
          validationTarget: "flag=ROT13:grag",
          hintText: "Find variables matching keyword flag inside the compiled structure: strings list_check | grep 'flag'"
        },
        {
          name: "Task 3: Decrypt validation label",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "list_check": "BINARY_PLACEHOLDER\nflag=ROT13:grag"
          }),
          validationType: "OUTPUT",
          validationTarget: "tent",
          hintText: "Translate the target string label using ROT13: echo \"grag\" | tr 'A-Za-z' 'N-ZA-Mn-za-m'"
        }
      ]
    },
    {
      id: 19,
      title: "Level 19: Log Inconsistency check",
      description: "Audit databases logs record user connection strings.",
      points: 1900,
      tasks: [
        {
          name: "Task 1: Locate transaction log",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "transactions.log": "sess_auth_active\nsess_auth_active\nYWRtaW5fMTk=\nsess_auth_active"
          }),
          validationType: "OUTPUT",
          validationTarget: "transactions.log",
          hintText: "Locate transaction records inside folder: ls -la"
        },
        {
          name: "Task 2: Extract Anomalous hash",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "transactions.log": "sess_auth_active\nsess_auth_active\nYWRtaW5fMTk=\nsess_auth_active"
          }),
          validationType: "OUTPUT",
          validationTarget: "YWRtaW5fMTk=",
          hintText: "Isolate unique log records: sort transactions.log | uniq -u"
        },
        {
          name: "Task 3: Resolve Hash username",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "transactions.log": "sess_auth_active\nsess_auth_active\nYWRtaW5fMTk=\nsess_auth_active"
          }),
          validationType: "OUTPUT",
          validationTarget: "admin_19",
          hintText: "Decode unique base64 credentials string: echo \"YWRtaW5fMTk=\" | base64 -d"
        }
      ]
    },
    {
      id: 20,
      title: "Level 20: The Grand Finale Socket",
      description: "The final system activation code is hosted behind a secured port linked in the local readme file.",
      points: 2000,
      tasks: [
        {
          name: "Task 1: Read Endpoint settings",
          taskRole: "TASK_A",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "instructions.txt": "Connect to local socket: 60000"
          }),
          validationType: "OUTPUT",
          validationTarget: "60000",
          hintText: "Read custom server coordinates backup file: cat instructions.txt"
        },
        {
          name: "Task 2: Send Handshake to Socket",
          taskRole: "TASK_B",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "instructions.txt": "Connect to local socket: 60000"
          }),
          validationType: "OUTPUT",
          validationTarget: "Y29tcGxldGVfMjAyNg==",
          hintText: "Query active credentials using netcat: nc localhost 60000"
        },
        {
          name: "Task 3: Decode Final system key",
          taskRole: "TASK_C",
          startDirectory: "/home/student",
          initialVFS: buildVfsTree({
            "instructions.txt": "Connect to local socket: 60000"
          }),
          validationType: "OUTPUT",
          validationTarget: "complete_2026",
          hintText: "base64 decode system activation payload: echo \"Y29tcGxldGVfMjAyNg==\" | base64 -d"
        }
      ]
    }
  ];

  // 3. Perform seeding transaction
  for (const lvl of levelsData) {
    const createdLevel = await prisma.level.upsert({
      where: { id: lvl.id },
      update: {
        title: lvl.title,
        description: lvl.description,
        points: lvl.points
      },
      create: {
        id: lvl.id,
        title: lvl.title,
        description: lvl.description,
        points: lvl.points
      }
    });

    for (const task of lvl.tasks) {
      await prisma.task.create({
        data: {
          levelId: createdLevel.id,
          name: task.name,
          taskRole: task.taskRole,
          startDirectory: task.startDirectory,
          initialVFS: task.initialVFS,
          validationType: task.validationType as ValidationType,
          validationTarget: task.validationTarget,
          hintText: task.hintText
        }
      });
    }
  }

  console.log(`[SEED] Successfully synchronized ${levelsData.length} Cyberbandit Levels and their TASK A / TASK B / TASK C workspaces.`);
}
