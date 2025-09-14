const fp = require('fastify-plugin');
const { CeramicClient } = require('@ceramicnetwork/http-client');
const { DID } = require('dids');
const { Ed25519Provider } = require('key-did-provider-ed25519');
const KeyDidResolver = require('key-did-resolver');
// Use Buffer to decode hex seed (Buffer is a Uint8Array and works in Node.js)
const { ComposeClient } = require('@composedb/client');

module.exports = fp(async function (fastify, opts) {
  const ceramicApiUrl = process.env.CERAMIC_API_URL || 'https://ceramic-clay.3boxlabs.com';
  const ceramic = new CeramicClient(ceramicApiUrl);

  const authenticateDID = async (seedHex) => {
    if (!seedHex) throw new Error('DID seed hex required');
  const seed = Buffer.from(seedHex, 'hex');
    if (seed.length !== 32) throw new Error('CERAMIC_SEED must decode to 32 bytes (64 hex chars)');
    const provider = new Ed25519Provider(seed);
    const did = new DID({ provider, resolver: KeyDidResolver.getResolver() });
    await did.authenticate();
    ceramic.did = did;
    return did;
  };

  const createComposeClient = (opts = {}) => new ComposeClient({ ceramic, ...opts });

  fastify.decorate('ceramic', { client: ceramic, createComposeClient, authenticateDID });

  const seedHex = process.env.CERAMIC_SEED;
  if (seedHex) {
    try {
      await authenticateDID(seedHex.trim());
      fastify.log.info(`Ceramic DID authenticated: ${ceramic.did?.id}`);
    } catch (e) {
      fastify.log.warn({ err: e }, 'Failed to auto-authenticate Ceramic DID');
    }
  } else {
    fastify.log.warn('CERAMIC_SEED not set. Ceramic write operations will be disabled until authenticated.');
  }

  fastify.log.info('Ceramic client initialized (ComposeDB available via createComposeClient)');
});
