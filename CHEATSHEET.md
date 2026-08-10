# OverTheWire Terminal Challenge - Quick Reference Cheatsheet

This cheatsheet provides a quick reference for running, debugging, and solving the terminal game environment.

---

## 🔗 Services & Web Links

| App Service | Host URL | Description |
| :--- | :--- | :--- |
| **Vite UI Frontend** | 🌐 [http://localhost:3000](http://localhost:3000) | Live interactive terminal dashboard for players |
| **Fastify Backend API** | 🌐 [http://localhost:5000](http://localhost:5000) | Shell execution engine & Socket.IO server |
| **Prisma Studio Visual DB** | 🌐 [http://localhost:5555](http://localhost:5555) | Postgres relational browser to edit scores/teams |

---

## ⚡ Setup Commands: From Zero to Running

### 1. Databases (Docker Desktop)
Launch Docker Desktop app, navigate to `backend/`, and boot environment:
```powershell
cd backend
$env:DOCKER_API_VERSION="1.47"; docker compose up -d
```d

### 2. Setup database values (PostgreSQL)
Still inside `backend/` directory, initialize databases and seed target answers:
```bash
# Apply schema tables:
npx prisma migrate dev --name init

# Seed Levels and tasks flag:
npx ts-node prisma/seed.ts
```

### 3. Start Backend server
Build processes and boot Fastify listening server:
```bash
npm run dev
```

### 4. Start React Frontend UI
Open a **separate shell** at the repository root folder, navigate to `frontend/`, and boot Vite:
```bash
cd frontend
npm run dev
```

---

## 🏅 Preset Credentials (DB Defaults)

* **Pre-seeded Invite Code:** `OTW123` *(linked to **Alpha Team**)*

---

## 🔑 Level Solutions (Cheat Codes)

Here are the correct flags seeded in the challenge levels for quick testing validation:

### 🚩 Level 1 Details
* **Task A: Inspect the Flag**
  * *Mount directory:* `/home/student`
  * *Shell utility command:* `cat flag.txt`
  * *Correct flag key:* `submit flag{welcome_to_linux_terminal_challenges}`
* **Task B: Find Hidden Backups**
  * *Mount directory:* `/home/student`
  * *Shell utility command:* `ls -a` followed by `cat .backup_file`
  * *Correct flag key:* `submit flag{hidden_files_begin_with_dot}`

### 🚩 Level 2 Details
* **Task A: Find Threat Flag**
  * *Mount directory:* `/home/student`
  * *Shell utility command:* `cat server_audit.log | grep CRITICAL`
  * *Correct flag key:* `submit flag{grep_keeps_critical_events_clear}`
* **Task B: Count Warning Lines**
  * *Mount directory:* `/home/student`
  * *Shell utility command:* `cat auth.log | grep WARNING | wc -l`
  * *Correct flag key:* `submit 2`
