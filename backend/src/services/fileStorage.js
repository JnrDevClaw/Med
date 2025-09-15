const crypto = require('crypto');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FileStorageService {
  constructor(ipfs) {
    this.ipfs = ipfs;
  }

  async store(buffer, originalName, opts = {}) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    // Encryption placeholder (currently passthrough)
    const toStore = buffer; // future: if opts.encrypt => AES-GCM
    const cid = await this.ipfs.uploadFile(toStore, originalName || opts.filename || 'file');
    return { cid, hash, size: buffer.length, encrypted: !!opts.encrypt };
  }

  async retrieve(cid) {
    const data = await this.ipfs.getFile(cid);
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }
}

export default FileStorageService;
