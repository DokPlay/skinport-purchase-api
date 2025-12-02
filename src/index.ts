import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { closeDbClient } from './db.js';
import { env } from './env.js';
import { closeRedisClient } from './redisClient.js';
import { registerItemRoutes } from './routes/items.js';
import { registerPurchaseRoutes } from './routes/purchase.js';

// Build a Fastify instance with all routes and shared configuration.
const buildServer = () => {
  const server = Fastify({ logger: true });

  // Security headers
  void server.register(helmet);

  // Rate limiting
  void server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // CORS
  void server.register(cors, {
    origin: true, // Reflect the request origin
  });

  server.get('/health', async () => ({ status: 'ok' }));
  void server.register(swagger, {
    openapi: {
      info: {
        title: 'Skinport Purchase API',
        description: 'API for caching Skinport item prices and processing demo purchases',
        version: '1.0.0',
      },
    },
  });
  void server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
    },
  });
  server.register(registerItemRoutes);
  server.register(registerPurchaseRoutes);

  // Ensure shared connections are released when the server is shut down
  // (useful for tests or external orchestrators calling `server.close()`).
  server.addHook('onClose', async () => {
    await Promise.allSettled([closeRedisClient(), closeDbClient()]);
  });

  return server;
};

// Start the HTTP server unless we are running in a test environment.
const start = async () => {
  const server = buildServer();
  let shuttingDown = false;

  const shutdown = async (signal?: string, exitCode = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    server.log.info({ signal }, 'Shutting down server');

    try {
      await server.close();
    } catch (error) {
      server.log.error({ err: error }, 'Error while closing HTTP server');
    }

    await Promise.allSettled([closeRedisClient(), closeDbClient()]);

    process.exit(exitCode);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await server.listen({ port: env.port, host: '0.0.0.0' });
    console.log(`Server is running on port ${env.port}`);
  } catch (error) {
    server.log.error(error);
    await shutdown('STARTUP_ERROR', 1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { buildServer };
