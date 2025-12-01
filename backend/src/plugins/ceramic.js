import fp from 'fastify-plugin';
import { CeramicClient } from '@ceramicnetwork/http-client';
import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import KeyDidResolver from 'key-did-resolver';
import { ComposeClient } from '@composedb/client';

export default fp(async function (fastify, opts) {
  const ceramicApiUrl = process.env.CERAMIC_API_URL || 'https://ceramic-clay.3boxlabs.com';

  // Initialize Ceramic client with timeout protection
  let ceramic = null;
  
  try {
    ceramic = new CeramicClient(ceramicApiUrl);
  } catch (error) {
    fastify.log.warn('Ceramic client initialization failed, continuing without Ceramic:', error.message);
  }

  // Create a DID for the server from a hex seed string
  const authenticateDID = async (seedHex) => {
    if (!ceramic) throw new Error('Ceramic client not available');
    if (!seedHex) throw new Error('DID seed hex required');
    const seed = Buffer.from(seedHex, 'hex');
    if (seed.length !== 32) {
      throw new Error('CERAMIC_SEED must decode to 32 bytes (64 hex chars)');
    }
    const provider = new Ed25519Provider(seed);
    const did = new DID({ provider, resolver: KeyDidResolver.getResolver() });
    await did.authenticate();
    ceramic.did = did;
    return did;
  };

  // Factory to create a ComposeDB client (optional, for graph-based schemas)
  const createComposeClient = (opts = {}) => {
    if (!ceramic) throw new Error('Ceramic client not available');
    return new ComposeClient({ ceramic, ...opts });
  };

  fastify.decorate('ceramic', { client: ceramic, createComposeClient, authenticateDID });

  // Auto-authenticate server DID if seed provided (non-blocking)
  const seedHex = process.env.CERAMIC_SEED;
  if (seedHex && ceramic) {
    // Run authentication in background to avoid blocking startup
    setImmediate(async () => {
      try {
        await authenticateDID(seedHex.trim());
        fastify.log.info(`Ceramic DID authenticated: ${ceramic.did?.id}`);
      } catch (e) {
        fastify.log.warn({ err: e }, 'Failed to auto-authenticate Ceramic DID');
      }
    });
  } else if (!ceramic) {
    fastify.log.warn('Ceramic client not available. Ceramic features disabled.');
  } else {
    fastify.log.warn('CERAMIC_SEED not set. Ceramic write operations will be disabled until authenticated.');
  }

  fastify.log.info('Ceramic plugin registered (initialization may continue in background)');
}, {
  name: 'ceramic'
});
