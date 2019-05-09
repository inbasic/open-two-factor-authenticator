'use strict';

if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var crypto = app.crypto;
  var totp = exports;
}
else {
  totp = {};
}

(function () {
  function bufferToHex(arr) {
    var i;
    var len;
    var hex = '';
    var c;

    for (i = 0, len = arr.length; i < len; i += 1) {
      c = arr[i].toString(16);
      if (c.length < 2) {
        c = '0' + c;
      }
      hex += c;
    }

    return hex;
  }

  function intToBytes(num) {
    var bytes = [];
    for (var i = 7 ; i >= 0 ; --i) {
      bytes[i] = num & (255);
      num = num >> 8;
    }
    return bytes;
  }

  function hexToBytes(hex) {
    var bytes = [];
    for (var c = 0, C = hex.length; c < C; c += 2) {
      bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
  }

  function sha1Hmac (key, bytes) {
    return crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: 'SHA-1'}}, false, ['sign', 'verify'])
    .then(function (cryptoKey) {
      return crypto.subtle.sign({name: 'HMAC'}, cryptoKey, new Uint8Array(bytes))
      .then(function (signature) {
        return bufferToHex(new Uint8Array(signature));
      });
    });
  }

  totp.gen = function (key, opt) {
    key = key || '';
    opt = opt || {};
    var time = opt.time || 30;
    var _t = Date.now();
    opt.counter = Math.floor((_t / 1000) / time);

    var counter = opt.counter || 0;

    // Create the byte array
    return sha1Hmac(key, intToBytes(counter)).then(function (digest) {
      // Get byte array
      var h = hexToBytes(digest);

      // Truncate
      var offset = h[19] & 0xf;
      var v = (h[offset] & 0x7f) << 24 |
        (h[offset + 1] & 0xff) << 16 |
        (h[offset + 2] & 0xff) << 8  |
        (h[offset + 3] & 0xff);

      v = (v % 1000000) + '';

      return new Array(7 - v.length).join('0') + v;
    });
  };

  totp.base32ToBuffer = function (encoded) {
    var byteTable = [
      0xff, 0xff, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
      0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
      0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
      0x17, 0x18, 0x19, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
      0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
      0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
      0x17, 0x18, 0x19, 0xff, 0xff, 0xff, 0xff, 0xff
    ];
    var shiftIndex = 0;
    var plainDigit = 0;
    var plainChar;
    var plainPos = 0;
    var len = Math.ceil(encoded.length * 5 / 8);
    var decoded;
    encoded = encoded.split('').map(function (ch) {
      return ch.charCodeAt(0);
    });
    if ('undefined' !== typeof Uint8Array) {
      encoded = new Uint8Array(encoded);
      decoded = new Uint8Array(len);
    }
    else {
      decoded = new Array(len);
    }

    /* byte by byte isn't as pretty as octet by octet but tests a bit
        faster. will have to revisit. */
    for (var i = 0; i < encoded.length; i++) {
      if (encoded[i] === 0x3d) { //'='
        break;
      }
      var encodedByte = encoded[i] - 0x30;
      if (encodedByte < byteTable.length) {
        plainDigit = byteTable[encodedByte];

        if (shiftIndex <= 3) {
          shiftIndex = (shiftIndex + 5) % 8;

          if (shiftIndex === 0) {
            plainChar |= plainDigit;
            decoded[plainPos] = plainChar;
            plainPos++;
            plainChar = 0;
          }
          else {
            plainChar |= 0xff & (plainDigit << (8 - shiftIndex));
          }
        }
        else {
          shiftIndex = (shiftIndex + 5) % 8;
          plainChar |= 0xff & (plainDigit >>> shiftIndex);
          decoded[plainPos] = plainChar;
          plainPos++;

          plainChar = 0xff & (plainDigit << (8 - shiftIndex));
        }
      }
      else {
        throw new Error('Invalid input - it is not base32 encoded string');
      }
    }

    if (decoded.slice) { // Array or TypedArray
      return decoded.slice(0, plainPos);
    }
    else { // Mobile Safari TypedArray
      return new Uint8Array(Array.prototype.slice.call(decoded, 0, plainPos));
    }
  };
})();
