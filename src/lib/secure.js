'use strict';

if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var crypto = app.crypto;
  var secure = exports;
}
else {
  secure = {};
}

secure.DB = function () {
  let key;
  let vector = crypto.getRandomValues(new Uint8Array(16));

  function convertStringToArrayBufferView (str) {
    var bytes = new Uint8Array(str.length);
    for (var iii = 0; iii < str.length; iii++) {
      bytes[iii] = str.charCodeAt(iii);
    }
    return bytes;
  }
  function convertArrayBufferViewtoString(buffer) {
    var str = '';
    for (var iii = 0; iii < buffer.byteLength; iii++) {
      str += String.fromCharCode(buffer[iii]);
    }
    return str;
  }
  function passwordToKey (password) {
    return crypto.subtle.digest({
      name: 'SHA-256'
    }, convertStringToArrayBufferView(password)).then(function (result) {
      return crypto.subtle.importKey('raw', result, {
        name: 'AES-CBC'
      }, false, ['encrypt', 'decrypt']).then(k => key = k);
    });
  }
  return {
    unlock: (password) => passwordToKey(password),
    encrypt: function (data) {
      if (!key) {
        return Promise.reject(new Error('You need to unlock the database first'));
      }
      return crypto.subtle.encrypt({
        name: 'AES-CBC',
        iv: vector
      }, key, convertStringToArrayBufferView(data))
        .then(function (result) {
          let d = app.Promise.defer();
          let reader = new app.FileReader();
          reader.onload = function () {
            d.resolve(reader.result);
          };
          reader.readAsDataURL(new app.Blob([vector, result], {type: 'application/octet-binary'}));
          return d.promise;
        });
    },
    decrypt: function (data) {
      if (!key) {
        return Promise.reject(new Error('You need to unlock the database first'));
      }
      return crypto.subtle.decrypt({
        name: 'AES-CBC',
        iv: vector
      }, key, convertStringToArrayBufferView(app.atob(data.split(',')[1])))
        .then(result => convertArrayBufferViewtoString((new Uint8Array(result)).subarray(16)));
    }
  };
};
