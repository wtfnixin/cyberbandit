# OverTheWire Terminal Challenge - Co-op Workspace

A real-time, team-based command-line emulation game platform. Players run simulate Linux commands on a shared canvas, submit flags, accumulate points, and advance together cooperatively.

---

## 📂 Folder Structure

The repository is organized into two separate root projects:

```text
/ (repository root)
├── backend/                       # Fastify Web Server, Prisma DB, Sockets Gateway
│   ├── src/                       # TypeScript backend application
│   ├── prisma/                    # Relational PostgreSQL schemas & test seeds
│   ├── tests/                     # Vitest suite for virtual shell validation
│   ├── scripts/                   # Integration playthrough & team tools
│   ├── package.json               # Backend packages configuration
│   ├── tsconfig.json              # Backend compilation settings
│   ├── .env                       # DB credentials configuration
│   └── docker-compose.yml         # Postgres & Redis local databases
│
└── frontend/                      # Vite + React Client Dashboard
    ├── src/                       # App.tsx visual frames & styles
    ├── index.html                 # Browser entrypage wrapper
    ├── vite.config.ts             # Port 3000 & Proxy configurations
    └── package.json               # Frontend packages configuration
```

---

## ⚡ Quick Start: Setup & Execution Guide

### Step 1: Clone the Project
Open your workspace terminal and clone the repository:
```bash
git clone <repository-url>
cd overthewire
```

---

### Step 2: Spin Up the Databases (Docker)

Make sure you have **Docker Desktop** installed and running on your system, then navigate of `backend/` directory to boot PostgreSQL and Redis:

```bash
cd backend

# Spin up containers in the background:
docker compose up -d
```

---

### Step 3: Configure Backend Services
Within the `backend/` directory, install package dependencies, initialize DB schema migrations, and inject level data:

```bash
# 1. Install Node Packages
npm install

# 2. Setup Environment Configuration (.env)
# Create a .env file inside backend/ folder containing:
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/overthewire?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="overthewiresupersecretkey123"

# 3. Apply Schema Migrations to Postgres
npx prisma migrate dev --name init

# 4. Seed Levels, Tasks, and hidden directories
npx ts-node prisma/seed.ts

# 5. Start Backend Server
npm run dev
```
*(The backend launches the REST endpoints & WebSocket gateway on **`http://localhost:5000`**)*

---

### Step 4: Run the React Dashboard Frontend
Open a **separate terminal window** at your repository root directory and execute:

```bash
cd frontend

# 1. Install packages
npm install

# 2. Boot development server
npm run dev
```

Open 👉 **`http://localhost:3000`** in your browser to start playing!

---

## 🩺 Troubleshoot & Error Resolutions

### 1. Docker Error: `500 Internal Server Error: client version is too new`
* **Cause:** Your local Docker CLI tool version is newer than the Docker virtual machine server version.
* **Resolution:** Prefix commands with the core version tag `1.47`:
  * **Windows Command Prompt (CMD):**
    ```cmd
    set DOCKER_API_VERSION=1.47
    docker compose up -d
    ```
  * **Windows PowerShell:**
    ```powershell
    $env:DOCKER_API_VERSION="1.47"
    docker compose up -d
    ```
  * **macOS / Linux Terminal:**
    ```bash
    export DOCKER_API_VERSION=1.47
    docker compose up -d
    ```

### 2. WSL2/Docker Service Failure: `Virtual Machine Platform check failed`
* **Cause:** CPU Virtualization is disabled in your machine's BIOS configurations, preventing WSL or Hyper-V hypervisors from booting.
* **Resolution:** Reboot your machine, enter the BIOS settings (usually pressing `F2`, `F10`, or `DEL` keys during startup), and set **Intel VT-x** (Intel CPUs) or **SVM Mode** (AMD CPUs) to **Enabled**.

### 3. Compilation Warnings: `setRegTeamName / handleRegisterTeam is declared but never read`
* **Cause:** Leftover inputs from the legacy team creator code.
* **Resolution:** Cleaned up automatically. All modules compile successfully with `typescript@5` under zero-error standard limits.
