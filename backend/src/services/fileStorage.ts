import crypto from 'crypto';

export interface StoreOptions {
  encrypt?: boolean;
  filename?: string;
  mimeType?: string;
}

export interface StoredFileResult {
  cid: string;
  hash: string;
  size: number;
  encrypted: boolean;
}

export class FileStorageService {
  constructor(private ipfs: any) {}

  async store(buffer: Buffer, originalName: string, opts: StoreOptions = {}): Promise<StoredFileResult> {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    // Encryption placeholder (currently passthrough)
    const toStore = buffer; // future: if opts.encrypt => AES-GCM
    const cid = await this.ipfs.uploadFile(toStore, originalName || opts.filename || 'file');
    return { cid, hash, size: buffer.length, encrypted: !!opts.encrypt };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const data = await this.ipfs.getFile(cid);
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }
}
