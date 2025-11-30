import { FastifyInstance } from 'fastify';
import { getDbClient } from '../db.js';
import { env } from '../env.js';

interface PurchaseRequestBody {
  productId: number;
}

interface DbUser {
  id: number;
  balance: number;
}

interface DbProduct {
  id: number;
  price: number;
  name: string;
}

interface PurchaseResponse {
  userId: number;
  balance: number;
}

interface ErrorResponse {
  error: string;
}

const authenticateUser = (authorizationHeader: string | undefined): number | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  const userId = env.userApiKeys[token];
  if (!userId) {
    return null;
  }

  return userId;
};

// Guard helper to ensure IDs are positive integers before hitting the database.
const isValidId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

const parseNumeric = (value: unknown): number => {
  const numeric = typeof value === 'string' ? Number(value) : value;

  if (typeof numeric !== 'number' || Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    throw new Error('INVALID_DATA');
  }

  return numeric;
};

// Expose a transactional purchase endpoint that debits balance and records the purchase atomically.
export const registerPurchaseRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const db = getDbClient();

  fastify.post<{ Body: PurchaseRequestBody; Reply: PurchaseResponse | ErrorResponse }>(
    '/purchase',
    {
      schema: {
        summary: 'Purchase a product',
        description: 'Debits the user balance and records the product purchase in a single transaction.',
        tags: ['purchase'],
        body: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'integer', minimum: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['userId', 'balance'],
            properties: {
              userId: { type: 'integer', minimum: 1 },
              balance: { type: 'number' }
            }
          },
          400: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' }
            }
          },
          401: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' }
            }
          },
          500: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = authenticateUser(request.headers.authorization);
        if (!userId) {
          reply.status(401);
          return { error: 'Unauthorized' };
        }

        const { productId } = request.body ?? {};

        if (!isValidId(productId)) {
          reply.status(400);
          return { error: 'productId must be a positive integer' };
        }

        const updatedUser = await db.begin(async (tx) => {
          const [user] = await tx<DbUser[]>`select id, balance from users where id = ${userId} for update`;
          if (!user) {
            throw new Error('USER_NOT_FOUND');
          }

          const [product] = await tx<DbProduct[]>`select id, price, name from products where id = ${productId}`;
          if (!product) {
            throw new Error('PRODUCT_NOT_FOUND');
          }

          const balance = parseNumeric(user.balance);
          const price = parseNumeric(product.price);

          if (price <= 0) {
            throw new Error('INVALID_PRICE');
          }

          if (balance < 0) {
            throw new Error('INVALID_DATA');
          }

          if (balance < price) {
            throw new Error('INSUFFICIENT_FUNDS');
          }

          const [newBalance] = await tx<DbUser[]>`update users set balance = balance - ${price} where id = ${userId} returning id, balance`;
          if (!newBalance) {
            throw new Error('INVALID_DATA');
          }
          await tx`insert into purchases (user_id, product_id, price_paid) values (${userId}, ${productId}, ${price})`;

          return newBalance;
        });

        const updatedBalance = parseNumeric(updatedUser.balance);

        return { userId, balance: updatedBalance };
      } catch (error) {
        if (error instanceof Error) {
          switch (error.message) {
            case 'USER_NOT_FOUND':
              reply.status(404);
              return { error: 'User not found' };
            case 'PRODUCT_NOT_FOUND':
              reply.status(404);
              return { error: 'Product not found' };
            case 'INSUFFICIENT_FUNDS':
              reply.status(400);
              return { error: 'Insufficient balance' };
            case 'INVALID_PRICE':
              reply.status(400);
              return { error: 'Product price must be positive' };
            case 'INVALID_DATA':
              reply.status(500);
              return { error: 'Unable to process data from database' };
            default:
              break;
          }
        }

        fastify.log.error(error);
        reply.status(500);
        return { error: 'Unable to process purchase' };
      }
    }
  );
};
