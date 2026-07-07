export interface StoredZipEntry {
  name: string;
  data: Buffer;
  modifiedAt?: Date;
}

interface CentralDirectoryEntry {
  header: Buffer;
  fileName: Buffer;
}

const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const CRC32_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC32_TABLE[index] = value >>> 0;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;

  return { dosTime, dosDate };
}

function createLocalHeader(entry: StoredZipEntry, fileName: Buffer, checksum: number, timestamp: Date) {
  const { dosTime, dosDate } = getDosDateTime(timestamp);
  const header = Buffer.alloc(30);

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 6);
  header.writeUInt16LE(ZIP_STORE_METHOD, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);

  return header;
}

function createCentralDirectoryHeader(
  entry: StoredZipEntry,
  fileName: Buffer,
  checksum: number,
  timestamp: Date,
  localHeaderOffset: number,
) {
  const { dosTime, dosDate } = getDosDateTime(timestamp);
  const header = Buffer.alloc(46);

  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 8);
  header.writeUInt16LE(ZIP_STORE_METHOD, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);

  return header;
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = Buffer.alloc(22);

  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);

  return header;
}

export function createStoredZip(entries: StoredZipEntry[]) {
  if (entries.length > 65535) {
    throw new Error('ZIP 文件数量超过限制');
  }

  const fileParts: Buffer[] = [];
  const centralDirectory: CentralDirectoryEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, 'utf8');
    const timestamp = entry.modifiedAt ?? new Date();
    const checksum = crc32(entry.data);
    const localHeader = createLocalHeader(entry, fileName, checksum, timestamp);
    const centralHeader = createCentralDirectoryHeader(entry, fileName, checksum, timestamp, offset);

    fileParts.push(localHeader, fileName, entry.data);
    centralDirectory.push({ header: centralHeader, fileName });
    offset += localHeader.length + fileName.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralParts = centralDirectory.flatMap((entry) => [entry.header, entry.fileName]);
  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = createEndOfCentralDirectory(entries.length, centralDirectorySize, centralDirectoryOffset);

  return Buffer.concat([...fileParts, ...centralParts, endHeader]);
}
