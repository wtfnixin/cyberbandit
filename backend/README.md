# OverTheWire Terminal Challenge - Backend Services Guide

This folder contains the core backend services, virtual execution shell, database model entities, caching interfaces, and WebSocket messaging gateway.

---

## 🛠️ Technology Stack Overview

1. **Server Host:** Fastify framework (v4) with TypeScript compilation.
2. **WebSockets:** Socket.IO for cooperative event dispatching.
3. **Database (SQL):** PostgreSQL (seeded with challenge levels and tasks).
4. **ORM Engine:** Prisma ORM for schema syncs and queries.
5. **Key-Value Cache:** Redis (tracks per-user CLI current directories & namespace trees).

---

## 🐳 Docker Stack & Datastores

### 1. Booting the Containers
Spin up the pre-configured PostgreSQL (`5432`) and Redis (`6379`) database containers in the background:
```bash
docker compose up -d
```
*(Optionally include the API Version environment variable if on a Windows machine throwing API mismatch errors: `cmd.exe /c "set DOCKER_API_VERSION=1.47 && docker compose up -d"`)*

### 2. Monitoring & Accessing Containers
* **Check Status:** `docker ps`
* **View Output Logs:** `docker compose logs`
* **Stop Container Services:** `docker compose down`

---

## 🗄️ Database Management (Prisma ORM)

Prisma controls the migrations and data structures of Postgres.

### 1. Prisma Commands Reference
* **Generate Typescript Client:**
  ```bash
  npx prisma generate
  ```
* **Apply Migrations (Sync Schemas):**
  ```bash
  npx prisma migrate dev --name init
  ```
* **Seed database tasks & filesystems:**
  ```bash
  npx ts-node prisma/seed.ts
  ```

### 2. Accessing the Data: Prisma Studio
Prisma Studio is a beautiful local visual database explorer GUI. Use it to view user records, adjust team scores, or assign custom codes manually:

* **To Start Prisma Studio:**
  ```bash
  npx prisma studio
  ```
* **Accessing the GUI:** Open your web browser and navigate to **`http://localhost:5555`**
* **Managing Teams & Scores:** Select the `Team` model schema to add new invite codes, check completed milestones, or manually override score numbers, then press `Save changes` at the top of the interface.

---

## 🚀 Environment Variables Config

Create a `.env` file at the root of the `backend/` folder to manage tokens and connections:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/overthewire?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="overthewiresupersecretkey123"
```

---

## 🧪 Vitest Validation Suite

Run automated diagnostics checks on paths resolving, streams piping, redirections, and command parsing logic:
```bash
npm test
```
