const fp = require('fastify-plugin');
// helia is published as ESM; dynamically import at runtime to avoid CJS/exports issues
module.exports = fp(async function (fastify, opts) {
  try {
    const heliaMod = await import('helia');
    const unixfsMod = await import('@helia/unixfs');
    const { createHelia } = heliaMod;
    const { unixfs } = unixfsMod;
    const helia = await createHelia();
    const fs = unixfs(helia);

    const uploadFile = async (file, filename) => {
      try {
        const { cid } = await fs.add(file, { path: filename });
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
        for await (const chunk of fs.cat(cidStr)) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks.map(c => Buffer.from(c)));
      } catch (error) {
        fastify.log.error('Helia retrieval failed:', error);
        throw error;
      }
    };

    fastify.decorate('ipfs', {
      client: helia,
      uploadFile,
      getFile,
    });

    fastify.log.info('IPFS client initialized');
  } catch (error) {
    fastify.log.error('IPFS initialization failed:', error);
    // Provide a fallback for when IPFS is not available
    fastify.decorate('ipfs', {
      client: null,
      uploadFile: async () => { throw new Error('IPFS not available'); },
      getFile: async () => { throw new Error('IPFS not available'); },
    });
  }
});
