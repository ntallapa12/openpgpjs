/**
 * Secure Hash Algorithm with 256-bit digest (SHA-256) implementation.
 *
 * See FIPS 180-2 for details.
 *
 * This implementation is currently limited to message lengths (in bytes) that
 * are up to 32-bits in size.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */

'use strict';

import util from 'util';
import _util from '../../util.js';

const Buffer = _util.getNativeBuffer();

// sha-256 padding bytes not initialized yet
var _padding = null;
var _initialized = false;

// table of constants
var _k = null;

/**
 * Initializes the constant tables.
 */
var _init = function() {
  // create padding
  _padding = Buffer.alloc(65, 0x00);
  _padding[0] = 128;

  // create K table for SHA-256
  _k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // now initialized
  _initialized = true;
};

/**
 * Updates a SHA-256 state with the given byte buffer.
 *
 * @param s the SHA-256 state to update.
 * @param w the array to use to store words.
 * @param bytes the byte buffer to update with.
 */
var _update = function(s, w, bytes) {
  // consume 512 bit (64 byte) chunks
  var t1, t2, s0, s1, ch, maj, i, a, b, c, d, e, f, g, h;
  var len = bytes.length;
  var offset = 0;
  while (len >= 64) {
    // the w array will be populated with sixteen 32-bit big-endian words
    // and then extended into 64 32-bit words according to SHA-256
    for (i = 0; i < 16; ++i) {
      w[i] = bytes.readInt32BE(offset);
      offset += 4;
    }
    for (; i < 64; ++i) {
      // XOR word 2 words ago rot right 17, rot right 19, shft right 10
      t1 = w[i - 2];
      t1 =
        ((t1 >>> 17) | (t1 << 15)) ^
        ((t1 >>> 19) | (t1 << 13)) ^
        (t1 >>> 10);
      // XOR word 15 words ago rot right 7, rot right 18, shft right 3
      t2 = w[i - 15];
      t2 =
        ((t2 >>> 7) | (t2 << 25)) ^
        ((t2 >>> 18) | (t2 << 14)) ^
        (t2 >>> 3);
      // sum(t1, word 7 ago, t2, word 16 ago) modulo 2^32
      w[i] = (t1 + w[i - 7] + t2 + w[i - 16]) & 0xFFFFFFFF;
    }

    // initialize hash value for this chunk
    a = s.h0;
    b = s.h1;
    c = s.h2;
    d = s.h3;
    e = s.h4;
    f = s.h5;
    g = s.h6;
    h = s.h7;

    // round function
    for (i = 0; i < 64; ++i) {
      // Sum1(e)
      s1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      // Ch(e, f, g) (optimized the same way as SHA-1)
      ch = g ^ (e & (f ^ g));
      // Sum0(a)
      s0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      // Maj(a, b, c) (optimized the same way as SHA-1)
      maj = (a & b) | (c & (a ^ b));

      // main algorithm
      t1 = h + s1 + ch + _k[i] + w[i];
      t2 = s0 + maj;
      h = g;
      g = f;
      f = e;
      e = (d + t1) & 0xFFFFFFFF;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) & 0xFFFFFFFF;
    }

    // update hash state
    s.h0 = (s.h0 + a) & 0xFFFFFFFF;
    s.h1 = (s.h1 + b) & 0xFFFFFFFF;
    s.h2 = (s.h2 + c) & 0xFFFFFFFF;
    s.h3 = (s.h3 + d) & 0xFFFFFFFF;
    s.h4 = (s.h4 + e) & 0xFFFFFFFF;
    s.h5 = (s.h5 + f) & 0xFFFFFFFF;
    s.h6 = (s.h6 + g) & 0xFFFFFFFF;
    s.h7 = (s.h7 + h) & 0xFFFFFFFF;
    len -= 64;
  }
  return offset;
};

/**
 * Creates a SHA-256 message digest object.
 *
 * @return a message digest object.
 */
function create() {
  // do initialization as necessary
  if (!_initialized) {
    _init();
  }

  // message digest object
  var md = {
    algorithm: 'sha256',
    blockLength: 64,
    digestLength: 32,
    // length of message so far (does not including padding)
    messageLength: 0
  };

  // SHA-256 state contains eight 32-bit integers
  md._state = null;

  // input buffer
  md._input = Buffer.alloc(0);

  // used for word storage
  md._w = new Array(64);

  // Copies the current hash
  md.copy = function() {
    var copy = create();
    copy.messageLength = md.messageLength;
    copy._input = Buffer.from(md._input);
    copy._state = util._extend({}, md._state);
    copy._w = md._w;
    return copy;
  };

  /**
   * Starts the digest.
   *
   * @return this digest object.
   */
  md.start = function() {
    md.messageLength = 0;
    md._input = Buffer.alloc(0);
    md._state = {
      h0: 0x6A09E667,
      h1: 0xBB67AE85,
      h2: 0x3C6EF372,
      h3: 0xA54FF53A,
      h4: 0x510E527F,
      h5: 0x9B05688C,
      h6: 0x1F83D9AB,
      h7: 0x5BE0CD19
    };
    return md;
  };
  // start digest automatically for first time
  md.start();

  /**
   * Updates the digest with the given message input. The given input can
   * treated as raw input (no encoding will be applied) or an encoding of
   * 'utf8' maybe given to encode the input using UTF-8.
   *
   * @param msg the message input to update with.
   * @param encoding the encoding to use (default: 'raw', other: 'utf8').
   *
   * @return this digest object.
   */
  md.update = function(msg, encoding) {
    encoding = encoding === 'utf8' ? 'utf8' : 'binary';

    // update message length
    md.messageLength += msg.length;

    // add bytes to input buffer
    md._input = Buffer.concat([md._input, Buffer.from(msg, encoding)]);

    // process bytes
    var offset = _update(md._state, md._w, md._input);

    md._input = md._input.slice(offset);

    return md;
  };

  /**
   * Produces the digest.
   *
   * @return a byte buffer containing the digest value.
   */
  md.digest = function() {
    /* Note: Here we copy the remaining bytes in the input buffer and
      add the appropriate SHA-256 padding. Then we do the final update
      on a copy of the state so that if the user wants to get
      intermediate digests they can do so. */

    /* Determine the number of bytes that must be added to the message
      to ensure its length is congruent to 448 mod 512. In other words,
      a 64-bit integer that gives the length of the message will be
      appended to the message and whatever the length of the message is
      plus 64 bits must be a multiple of 512. So the length of the
      message must be congruent to 448 mod 512 because 512 - 64 = 448.

      In order to fill up the message length it must be filled with
      padding that begins with 1 bit followed by all 0 bits. Padding
      must *always* be present, so if the message length is already
      congruent to 448 mod 512, then 512 padding bits must be added. */

    // 512 bits == 64 bytes, 448 bits == 56 bytes, 64 bits = 8 bytes
    // _padding starts with 1 byte with first bit is set in it which
    // is byte value 128, then there may be up to 63 other pad bytes
    var len = md.messageLength;
    var padBytes = Buffer.concat([
      md._input,
      _padding.slice(0, 64 - ((len + 8) % 64)),
      Buffer.alloc(8)
    ]);

    /* Now append length of the message. The length is appended in bits
      as a 64-bit number in big-endian order. Since we store the length
      in bytes, we must multiply it by 8 (or left shift by 3). So here
      store the high 3 bits in the low end of the first 32-bits of the
      64-bit number and the lower 5 bits in the high end of the second
      32-bits. */
    var padLen = padBytes.length;
    padBytes.writeInt32BE((len >>> 29) & 0xFF, padLen - 8);
    padBytes.writeInt32BE((len << 3) & 0xFFFFFFFF, padLen - 4);
    var s2 = util._extend({}, md._state);
    _update(s2, md._w, padBytes);
    var rval = Buffer.alloc(32);
    rval.writeInt32BE(s2.h0, 0);
    rval.writeInt32BE(s2.h1, 4);
    rval.writeInt32BE(s2.h2, 8);
    rval.writeInt32BE(s2.h3, 12);
    rval.writeInt32BE(s2.h4, 16);
    rval.writeInt32BE(s2.h5, 20);
    rval.writeInt32BE(s2.h6, 24);
    rval.writeInt32BE(s2.h7, 28);

    return _util.buffer2Uint8Array(rval);
  };

  return md;
}

export default { create };
