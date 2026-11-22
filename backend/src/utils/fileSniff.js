const fs = require('fs');
// Checks the real file signature, not the client-supplied MIME type.
exports.sniff = (file) => {
  const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(8); fs.readSync(fd, b, 0, 8, 0); fs.closeSync(fd);
  if (b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'png';
  if (b.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (b.slice(0, 4).toString() === '%PDF') return 'pdf';
  return null;
};
