import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    ipfs: {
      client: any;
      uploadFile: (file: Buffer, filename: string) => Promise<string>;
      getFile: (hash: string) => Promise<Buffer>;
    };
  }
}

export default fp(async function (fastify, opts) {
  try {
    // Initialize Helia + unixfs (dynamically load ESM modules)
    const heliaLoader = await import('helia');
    const unixfsLoader = await import('@helia/unixfs');
    const helia = await heliaLoader.createHelia();
    const fs = unixfsLoader.unixfs(helia);

    const uploadFile = async (file: Buffer, filename: string): Promise<string> => {
      try {
        const { cid } = await fs.add(file, { path: filename });
        fastify.log.info(`File added to Helia/UNIXFS: ${cid.toString()}`);
        return cid.toString();
      } catch (error) {
        fastify.log.error('Helia upload failed:', error);
        throw error;
      }
    };

    const getFile = async (cidStr: string): Promise<Buffer> => {
      try {
        const chunks: Uint8Array[] = [];
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
