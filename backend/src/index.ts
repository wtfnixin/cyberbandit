import Fastify from 'fastify';
import socketio from 'fastify-socket.io';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import { connectRedis } from './services/redis';
import { authRoutes } from './routes/auth';
import { registerSocketGateway } from './gateway/socket';

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

// Initialize Fastify
const fastify = Fastify({
  logger: true
});

async function main() {
  try {
    // 1. Setup CORS
    await fastify.register(cors, {
      origin: '*', // Custom configurations if front-end URL is defined
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    // 1.5 Setup Static File Servings
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, 'public'),
      prefix: '/'
    });

    // 2. Setup Socket.IO Integration
    await fastify.register(socketio, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // 3. Setup Redis Connections
    await connectRedis();

    // 4. Register HTTP Auth Endpoints
    await fastify.register(authRoutes);

    // 5. Initialize Websocket Game Controllers
    registerSocketGateway((fastify as any).io);

    // 6. Root Route Verification
    fastify.get('/health', async () => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    });

    // 7. Start listener server
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`System running successfully on http://${HOST}:${PORT}`);
  } catch (err: any) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
