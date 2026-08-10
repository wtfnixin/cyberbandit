# Super Admin Dashboard & Dynamic Leaderboard Specification

This specification outlines the technical design, APIs, real-time WebSocket communication flows, and layout structures for introducing the **Super Admin Console** and **Live Leaderboard** into the OverTheWire Terminal Challenge.

---

## 1. Architectural Design & Security

### A. Frontend Routing & Authentication
* **Route Path:** `/admin`
* **Access Control:** Direct URL navigation only. No button or link is visible in standard user views or login pages.
* **Component Guard & Credentials:** 
  * The credentials for the Super Admin do not live in the PostgreSQL database. Instead, they are defined directly in the backend `.env` variables:
    * `ADMIN_USERNAME=secretadmin`
    * `ADMIN_PASSWORD=supersecurepassword123`
  * When logging in via the `/admin` page, the backend validates user input parameters directly against these environment values. If verified, the server signs and returns a stateless JWT containing the claim `role: 'SUPER_ADMIN'`.
  * The frontend keeps this token in localStorage and validates the decrypted payload role to allow admin view elements to render.

### B. Cloud Deployment Readiness
* **Stateless Token Verification:** All Admin endpoints require a `Bearer <token>` HTTP Authorization header verified using Fastify plugins, comparing role assertions in the payload.
* **CORS Settings:** Configured to dynamically resolve trusted origin strings from the `FRONTEND_URL` environment variable.
* **Redis Connection Options:** Configured to use secure TLS connections (`rediss://`) and respect Redis container connection pooling when deployed to cloud providers like Render, Heroku, or AWS.

---

## 2. API Endpoints (`/api/admin/*`)

All administrative routes are protected by a role-gate validator.

### A. Team Administration
* **`GET /api/admin/teams`**
  * *Returns:* JSON list of all teams, their members, current level, and total scores.
* **`POST /api/admin/teams`**
  * *Payload:* `{ name: string, inviteCode?: string }`
  * *Behavior:* Synchronously creates a team record with `score: 0` and auto-provisions Level 1.
* **`DELETE /api/admin/teams/:id`**
  * *Behavior:* Force deletes a team. Cascade-clears related User profiles, Redis session states, and Submission history entries.

### B. Level & Mission Management
* **`GET /api/admin/levels`**
  * *Returns:* Dynamic listing of seeded Levels and Tasks.
* **`POST /api/admin/tasks`**
  * *Payload:* `{ levelId: number, name: string, taskRole: "TASK_A"|"TASK_B", validationTarget: string, hintText: string, startDirectory: string, initialV1Vfs: JSON }`
  * *Behavior:* Hot-plugs a new task into the database.
* **`DELETE /api/admin/tasks/:taskId`**
  * *Behavior:* Removes a task.

### C. Live Audits
* **`GET /api/admin/submissions`**
  * *Returns:* Chronological log of all student shell executions, command parameters, validation results, and exact times.

---

## 3. Real-Time WebSockets (`Socket.IO` Events)

To enforce zero-delay live tracking, admin clients subscribe to a dedicated admin gateway room on connection: `socket.join('admin:room')`.

```
[Student Terminal]  ──(command:execute)──► [Backend Engine]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
             (Emit to admin:room)                          (Emit to teamRoom)
        "admin:activity:feed"                      "terminal:output" / "task:completed"
```

### A. Live Feed Streams
Whenever a player issues a command line, the backend broadcasts detailed server telemetry logs to the admin room:
* **Event:** `admin:activity:feed`
* **Broadcast Payload:**
  ```json
  {
    "teamName": "Ghost Shell",
    "username": "alice",
    "commandLine": "cat sec_key.txt | grep flag",
    "cwd": "/home/student",
    "timestamp": "2026-08-10T14:30:15.105Z"
  }
  ```

### B. Task Completed Alerts
When a teammate submits a correct flag, the server emits:
* **Event:** `admin:solve:alert`
* **Broadcast Payload:**
  ```json
  {
    "teamName": "Ghost Shell",
    "username": "alice",
    "taskName": "Find Hidden Backups",
    "pointsAdded": 500,
    "newTotalScore": 2500,
    "timestamp": "2026-08-10T14:30:18.000Z"
  }
  ```

---

## 4. Live Leaderboard Mechanism

The leaderboard displays team rankings by score and must update without refresh.

### A. Sync Flow
```
[Player Correct Submit] ──► [Prisma: Update Team Score]
                                       │
                                       ▼
                     [Redis: Update ZSET Leaderboard]
                                       │
                                       ▼
                   [WS Broadcast: "leaderboard:update"]
```

### B. Implementation Details
* **Redis Storage:** Scores are stored in a Redis Sorted Set (`ZSET`) keyed under `leaderboard`.
* **State Hook:** Whenever `advanceTeamLevel` or `recordSubmission` increments a score in PostgreSQL, it updates Redis `ZSET` via `ZADD leaderboard <score> <teamId>`.
* **Socket Auto-Broadcast:** The server fetches the top 10 rankings (`ZREVRANGEBYSCORE` or a fast database query) and fires:
  * **Event:** `leaderboard:update`
  * **Payload:**
    ```json
    [
      { "rank": 1, "teamName": "Ghost Shell", "score": 2500 },
      { "rank": 2, "teamName": "Root Users", "score": 1500 }
    ]
    ```
  * **Recipients:** Broadcast globally to **all** connected player sockets (`io.emit`) and admin sockets to redraw the ranking side-panels dynamically.
