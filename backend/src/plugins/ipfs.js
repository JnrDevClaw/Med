import fp from 'fastify-plugin';

// Register a fast, non-blocking plugin that decorates a stub ipfs object
// and initializes Helia asynchronously in the background. This prevents
// Fastify's plugin timeout when Helia takes a while to start.
export default fp(async function (fastify, opts) {
  let heliaInstance = null;
  let unixfs = null;

  // Initial stub - quick to register
  fastify.decorate('ipfs', {
    client: null,
    uploadFile: async () => { throw new Error('IPFS not yet initialized'); },
    getFile: async () => { throw new Error('IPFS not yet initialized'); },
    isReady: () => false,
  });

  // Background initialization (do not await) so plugin returns quickly
  (async () => {
    try {
      const heliaLoader = await import('helia');
      const unixfsLoader = await import('@helia/unixfs');

      heliaInstance = await heliaLoader.createHelia();
      unixfs = unixfsLoader.unixfs(heliaInstance);

      const uploadFile = async (file, filename) => {
        try {
          const { cid } = await unixfs.add(file, { path: filename });
          fastify.log.info(`File added to Helia/UNIXFS: ${cid.toString()}`);
          return cid.toString();
        } catch (error) {
          fastify.log.error('Helia upload failed:', error);
          throw error;
        }
      };

      const getFile = async (cidStr) => {
        try {
          const chunks = [];
          for await (const chunk of unixfs.cat(cidStr)) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks.map(c => Buffer.from(c)));
        } catch (error) {
          fastify.log.error('Helia retrieval failed:', error);
          throw error;
        }
      };

      // Replace stub with real implementation
      fastify.ipfs.client = heliaInstance;
      fastify.ipfs.uploadFile = uploadFile;
      fastify.ipfs.getFile = getFile;
      fastify.ipfs.isReady = () => true;

      fastify.log.info('IPFS client initialized (background)');
    } catch (error) {
      fastify.log.error('IPFS initialization failed:', error);
      fastify.ipfs.client = null;
      fastify.ipfs.uploadFile = async () => { throw new Error('IPFS not available'); };
      fastify.ipfs.getFile = async () => { throw new Error('IPFS not available'); };
    }
  })();

  // Cleanup when Fastify closes
  fastify.addHook('onClose', async () => {
    try {
      if (heliaInstance && typeof heliaInstance.stop === 'function') {
        await heliaInstance.stop();
        fastify.log.info('Helia stopped on shutdown');
      }
    } catch (err) {
      fastify.log.warn('Error stopping Helia on shutdown:', err);
    }
  });
});
