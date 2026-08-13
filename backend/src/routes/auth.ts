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

  // 2. Join a Team (Registers User link to invite code)
  fastify.post('/api/auth/join-team', async (request, reply) => {
    const { username, password, inviteCode } = request.body as {
      username: string;
      password?: string;
      inviteCode: string;
    };

    if (!username || !password || !inviteCode) {
      return reply.code(400).send({ error: 'Username, password, and Invite Code are required' });
    }

    try {
      const team = await prisma.team.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() }
      });

      if (!team) {
        return reply.code(400).send({ error: 'Invalid invite code' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          role: 'STUDENT',
          teamId: team.id
        }
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, teamId: team.id },
        JWT_SECRET,
        { expiresIn: '6h' }
      );

      return reply.code(201).send({
        message: 'Joined team successfully',
        token,
        user: { id: user.id, username: user.username, role: user.role },
        team: { id: team.id, name: team.name }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Username is already taken' });
      }
      return reply.code(500).send({ error: 'Failed to join team', details: err.message });
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

      if (!user) {
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

  // 4. Super Admin environment-based login
  fastify.post('/api/auth/admin-login', async (request, reply) => {
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

  // 5. Safe Level data lookup for students
  fastify.get('/api/levels/:levelId', async (request, reply) => {
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

    const { levelId } = request.params as { levelId: string };
    try {
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
