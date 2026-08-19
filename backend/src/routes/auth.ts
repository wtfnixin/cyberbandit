import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'overthewiresupersecretkey123';

// Helper to generate unique invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Register a Team
  fastify.post('/api/auth/register-team', async (request, reply) => {
    const { teamName } = request.body as { teamName: string };
    if (!teamName || !teamName.trim()) {
      return reply.code(400).send({ error: 'Team name is required' });
    }

    try {
      const inviteCode = generateInviteCode();
      const team = await prisma.team.create({
        data: {
          name: teamName.trim(),
          inviteCode,
          currentLevelId: 1
        }
      });

      return reply.code(201).send({
        message: 'Team registered successfully',
        teamId: team.id,
        inviteCode: team.inviteCode
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Team name is already taken' });
      }
      return reply.code(500).send({ error: 'Failed to create team', details: err.message });
    }
  });

  // 2. Join/Login to a Team (via Team Code + Email ID)
  fastify.post('/api/auth/join-team', async (request, reply) => {
    const { inviteCode, email } = request.body as {
      inviteCode: string;
      email: string;
    };

    if (!inviteCode || !email) {
      return reply.code(400).send({ error: 'Team Code and Email ID are required' });
    }

    try {
      const team = await prisma.team.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
        include: { allowedEmails: true }
      });

      if (!team) {
        return reply.code(400).send({ error: 'Invalid Team Code' });
      }

      const emailTrimmed = email.trim().toLowerCase();

      // Check if email is in preloaded allowed list
      const allowedEntry = team.allowedEmails.find(
        (ae) => ae.email.toLowerCase() === emailTrimmed
      );

      if (!allowedEntry) {
        return reply.code(403).send({ error: 'This email is not registered for this team.' });
      }

      // Check if user account already exists under this email
      let user = await prisma.user.findUnique({
        where: { email: emailTrimmed }
      });

      if (user) {
        // User already exists, restore session
        if (user.teamId !== team.id) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { teamId: team.id }
          });
        }
      } else {
        // First login, check limit
        const activeUsersCount = await prisma.user.count({
          where: { teamId: team.id }
        });

        if (activeUsersCount >= 2) {
          return reply.code(400).send({
            error: 'Failed to access: Max limit reached. Only 2 active players are allowed per team.'
          });
        }

        // Generate clean unique username
        let candidateUsername = allowedEntry.name?.trim() || emailTrimmed.split('@')[0];
        candidateUsername = candidateUsername.replace(/\s+/g, '-').toLowerCase();

        const existingUsername = await prisma.user.findUnique({
          where: { username: candidateUsername }
        });

        if (existingUsername) {
          candidateUsername += `-${Math.random().toString(36).substring(2, 6)}`;
        }

        user = await prisma.user.create({
          data: {
            username: candidateUsername,
            email: emailTrimmed,
            role: 'STUDENT',
            teamId: team.id
          }
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, teamId: team.id },
        JWT_SECRET,
        { expiresIn: '6h' }
      );

      return reply.code(200).send({
        message: 'Access granted successfully',
        token,
        user: { id: user.id, username: user.username, role: user.role },
        team: { id: team.id, name: team.name }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Authentication failed', details: err.message });
    }
  });

  // 3. User Login (Supports standard username/password for return checkins)
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password?: string };
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { username: username.trim() },
        include: { team: true }
      });

      if (!user || !user.passwordHash) {
        return reply.code(401).send({ error: 'Invalid username or password' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return reply.code(401).send({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          teamId: user.teamId
        },
        JWT_SECRET,
        { expiresIn: '6h' }
      );

      return reply.send({
        token,
        user: { id: user.id, username: user.username, role: user.role },
        team: user.team ? { id: user.team.id, name: user.team.name } : null
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Internal login error', details: err.message });
    }
  });

  // 4. Super Admin environment-based login (rate-limited: 5 per 15 min)
  fastify.post('/api/auth/admin-login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password?: string };
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword123';

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    if (username.trim() !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return reply.code(401).send({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      {
        userId: 'admin-id',
        username: ADMIN_USERNAME,
        role: 'SUPER_ADMIN',
        teamId: 'admin-team'
      },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    return reply.send({
      token,
      user: { id: 'admin-id', username: ADMIN_USERNAME, role: 'SUPER_ADMIN' }
    });
  });

  // 4.5 Safe Level headers lookup (Roadmap list) for students
  fastify.get('/api/levels', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'Access denied: token required' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid or expired session token' });
    }

    try {
      const levels = await prisma.level.findMany({
        select: {
          id: true,
          title: true,
          points: true
        },
        orderBy: { id: 'asc' }
      });
      return reply.send(levels);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to list levels', details: err.message });
    }
  });

  // 5. Safe Level data lookup for students
  fastify.get('/api/levels/:levelId', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'Access denied: token required' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid or expired session token' });
    }

    const { levelId } = request.params as { levelId: string };
    try {
      if (decoded.role === 'STUDENT') {
        const teamObj = await prisma.team.findUnique({
          where: { id: decoded.teamId }
        });
        if (!teamObj) {
          return reply.code(404).send({ error: 'Team not found' });
        }
        if (Number(levelId) > teamObj.currentLevelId) {
          return reply.code(403).send({ error: 'Access denied: level is locked' });
        }
      }
      const lvl = await prisma.level.findUnique({
        where: { id: Number(levelId) },
        select: {
          id: true,
          title: true,
          description: true,
          points: true,
          tasks: {
            select: {
              id: true,
              levelId: true,
              name: true,
              taskRole: true,
              hintText: true,
              startDirectory: true
            }
          }
        }
      });
      if (!lvl) {
        return reply.code(404).send({ error: 'Level not found' });
      }
      return reply.send(lvl);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to retrieve level parameters', details: err.message });
    }
  });
}
