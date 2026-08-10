import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'overthewiresupersecretkey123';

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Pre-handler hook to authenticate admin role
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.code(401).send({ error: 'Authorization header missing' });
      }
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Access forbidden: Admin privilege required' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized or invalid token' });
    }
  });

  // 1. Get all teams
  fastify.get('/api/admin/teams', async (request, reply) => {
    try {
      const teams = await prisma.team.findMany({
        include: {
          users: true,
          currentLevel: true
        },
        orderBy: {
          score: 'desc'
        }
      });
      return reply.send(teams);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch teams', details: err.message });
    }
  });

  // 2. Create a team
  fastify.post('/api/admin/teams', async (request, reply) => {
    const { name } = request.body as { name: string };
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Team name is required' });
    }

    try {
      const inviteCode = generateInviteCode();
      const team = await prisma.team.create({
        data: {
          name: name.trim(),
          inviteCode,
          score: 0,
          currentLevelId: 1
        }
      });
      return reply.code(201).send(team);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Team name is already taken' });
      }
      return reply.code(500).send({ error: 'Failed to create team', details: err.message });
    }
  });

  // 3. Delete a team
  fastify.delete('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.submission.deleteMany({ where: { teamId: id } });
      await prisma.user.deleteMany({ where: { teamId: id } });
      await prisma.team.delete({ where: { id } });
      return reply.send({ message: 'Team deleted successfully' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete team', details: err.message });
    }
  });

  // 4. Get all submissions (live audit feed)
  fastify.get('/api/admin/submissions', async (request, reply) => {
    try {
      const submissions = await prisma.submission.findMany({
        include: {
          team: true,
          user: true,
          task: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      });
      return reply.send(submissions);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to list submissions', details: err.message });
    }
  });
}
