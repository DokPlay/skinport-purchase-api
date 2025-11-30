import Fastify from 'fastify';
import { env } from './env.js';
import { registerItemRoutes } from './routes/items.js';
import { registerPurchaseRoutes } from './routes/purchase.js';

// Build a Fastify instance with all routes and shared configuration.
const buildServer = () => {
  const server = Fastify({ logger: true });

  server.get('/health', async () => ({ status: 'ok' }));
  server.register(registerItemRoutes);
  server.register(registerPurchaseRoutes);

  return server;
};

// Start the HTTP server unless we are running in a test environment.
const start = async () => {
  const server = buildServer();

  try {
    await server.listen({ port: env.port, host: '0.0.0.0' });
    console.log(`Server is running on port ${env.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { buildServer };
