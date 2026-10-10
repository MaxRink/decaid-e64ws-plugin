#!/usr/bin/env node
// Small, dependency-free E64 wire-protocol fixture for integration tests.
// It intentionally models only read replies used by the public plugin contract.
import http from 'node:http';
import crypto from 'node:crypto';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? true);
}
const port = Number(args.get('port') ?? 9997);
const token = String(args.get('token') ?? 'test-token');
const id = String(args.get('id') ?? `mock-${port}`);
const sockets = new Set();
let state = String(args.get('state') ?? 'idle');

function frame(text) {
  const body = Buffer.from(text);
  const head = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
  return Buffer.concat([head, body]);
}
function send(socket, value) { if (!socket.destroyed) socket.write(frame(JSON.stringify(value))); }
function reply(socket, request) {
  const refId = request.msgId ?? request.messageId ?? request.id;
  const type = String(request.type ?? '');
  const result = type.includes('Config') ? {grindSize: 64, mode: 'mock'}
    : type.includes('Nachine') || type.includes('Machine') ? {model: 'E64S', serial: `MOCK-${id}`}
    : type.includes('Log') ? {messages: [`mock ${id} ready`]}
    : {state, rpm: state === 'grinding' ? 800 : 0, grinder: id};
  send(socket, {type: `${type}Result`, refId, data: result});
}
function parseFrames(socket, chunk) {
  socket.input = Buffer.concat([socket.input ?? Buffer.alloc(0), chunk]);
  while (socket.input.length >= 2) {
    const first = socket.input[0], second = socket.input[1];
    let length = second & 127, offset = 2;
    if (length === 126) { if (socket.input.length < 4) return; length = socket.input.readUInt16BE(2); offset = 4; }
    const masked = (second & 128) !== 0;
    if (masked) offset += 4;
    if (socket.input.length < offset + length) return;
    let payload = socket.input.subarray(offset, offset + length);
    if (masked) { const key = socket.input.subarray(offset - 4, offset); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i += 1) payload[i] ^= key[i % 4]; }
    socket.input = socket.input.subarray(offset + length);
    if ((first & 0x0f) === 8) { socket.end(); return; }
    if ((first & 0x0f) !== 1) continue;
    try { reply(socket, JSON.parse(payload.toString('utf8'))); } catch { send(socket, {type: 'MalformedRequest'}); }
  }
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') { response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({ok: true, id, state})); return; }
  if (request.method === 'POST' && request.url === '/control') {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { try { const command = JSON.parse(body); if (command.state) state = String(command.state); if (command.action === 'close') for (const socket of sockets) socket.end(); if (command.action === 'malformed') for (const socket of sockets) socket.write(frame('{malformed')); response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({ok: true, state})); } catch { response.writeHead(400); response.end(); } }); return;
  }
  response.writeHead(404); response.end();
});
server.on('upgrade', (request, socket) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.searchParams.get('token') !== token || request.headers.upgrade?.toLowerCase() !== 'websocket') { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sockets.add(socket); socket.on('data', chunk => parseFrames(socket, chunk)); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => sockets.delete(socket));
});
server.listen(port, '127.0.0.1', () => console.log(`E64 mock ${id} listening on ws://127.0.0.1:${port}/?token=${token}`));
