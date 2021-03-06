'use strict';

import packet from '../packet';
import HeaderPacketStream from './header.js';
import util from 'util';
import _util from '../util.js';

const Buffer = _util.getNativeBuffer();
const BLOCK_SIZE = 1024;

export default function ChunkedStream(opts) {
  opts = opts || {};
  this.blockSize = opts.blockSize || BLOCK_SIZE;
  if (this.blockSize < 512) {
    // first block must be 512 minimum
    this.blockSize = 512;
  }
  HeaderPacketStream.call(this, opts);
  this.header = opts.header;
  this.queue = Buffer.alloc(0);
  this.started = false;
}

util.inherits(ChunkedStream, HeaderPacketStream);

ChunkedStream.prototype.getHeader = function() {
  return this.header;
};

ChunkedStream.prototype._transform = function(data, encoding, callback) {
  HeaderPacketStream.prototype._transform.call(this, data, encoding);
  this.queue = Buffer.concat([this.queue, data]);
  var len = this.queue.length;
  if (len >= this.blockSize) {
    this.started = true;
    var chunkPower = len.toString(2).length - 1;
    if (chunkPower > 30) { chunkPower = 30; }
    var chunkSize = Math.pow(2, chunkPower),
        chunk = this.queue.slice(0, chunkSize);
    this.queue = this.queue.slice(chunkSize);
    this.push(Buffer.concat([Buffer.from(packet.packet.writePartialLength(chunkPower), 'binary'), chunk]));
  }
  callback();
};

ChunkedStream.prototype._flush = function(callback) {
  var chunk = Buffer.from(this.queue);
  this.queue = Buffer.alloc(0);
  this.push(Buffer.concat([Buffer.from(packet.packet.writeSimpleLength(chunk.length), 'binary'), chunk]));
  this.ended = true;
  callback();
};
