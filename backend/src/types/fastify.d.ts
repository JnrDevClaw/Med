import '@fastify/jwt';
import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    requireRole: (role: string) => any;
  }
  interface FastifyRequest {
    user: {
      userId: string;
      did: string;
      role?: string;
    };
  }
}
