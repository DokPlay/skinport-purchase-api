import { FastifyInstance } from 'fastify';
import { getDbClient } from '../db.js';

interface PurchaseRequestBody {
  userId: number;
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

const isValidId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const registerPurchaseRoutes = async (fastify: FastifyInstance): Promise<void> => {
  const db = getDbClient();

  fastify.post<{ Body: PurchaseRequestBody }>(
    '/purchase',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'productId'],
          properties: {
            userId: { type: 'integer', minimum: 1 },
            productId: { type: 'integer', minimum: 1 }
          }
        }
      }
    },
    async (request, reply) => {
      const { userId, productId } = request.body;

      if (!isValidId(userId) || !isValidId(productId)) {
        reply.status(400);
        return { error: 'userId and productId must be positive integers' };
      }

      try {
        const updatedUser = await db.begin(async (tx) => {
          const [user] = await tx<DbUser[]>`select id, balance from users where id = ${userId} for update`;
          if (!user) {
            throw new Error('USER_NOT_FOUND');
          }

          const [product] = await tx<DbProduct[]>`select id, price, name from products where id = ${productId}`;
          if (!product) {
            throw new Error('PRODUCT_NOT_FOUND');
          }

          const balance = Number(user.balance);
          const price = Number(product.price);

          if (Number.isNaN(balance) || Number.isNaN(price)) {
            throw new Error('INVALID_DATA');
          }

          if (balance < price) {
            throw new Error('INSUFFICIENT_FUNDS');
          }

          const [newBalance] = await tx<DbUser[]>`update users set balance = balance - ${price} where id = ${userId} returning id, balance`;
          await tx`insert into purchases (user_id, product_id, price_paid) values (${userId}, ${productId}, ${price})`;

          return newBalance;
        });

        return { userId, balance: updatedUser.balance };
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
