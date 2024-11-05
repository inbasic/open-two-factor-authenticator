'use strict';

var secure = {};
{
  let key;
  const vector = crypto.getRandomValues(new Uint8Array(16));

  const convertStringToArrayBufferView = str => {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  };
  const convertArrayBufferViewtoString = buffer => {
    let str = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      str += String.fromCharCode(buffer[i]);
    }
    return str;
  };
  const passwordToKey = password => {
    return crypto.subtle.digest({
      name: 'SHA-256'
    }, convertStringToArrayBufferView(password)).then(result => {
      return crypto.subtle.importKey('raw', result, {
        name: 'AES-CBC'
      }, false, ['encrypt', 'decrypt']).then(k => key = k);
    });
  };

  secure.unlock = password => key ? Promise.resolve() : passwordToKey(password);
  secure.encrypt = data => {
    if (!key) {
      return Promise.reject(new Error('You need to unlock the database first'));
    }
    return crypto.subtle.encrypt({
      name: 'AES-CBC',
      iv: vector
    }, key, convertStringToArrayBufferView(data)).then(result => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(new Blob([vector, result], {
        type: 'application/octet-binary'
      }));
    }));
  };
  secure.decrypt = data => {
    if (!key) {
      return Promise.reject(new Error('You need to unlock the database first'));
    }
    return crypto.subtle.decrypt({
      name: 'AES-CBC',
      iv: vector
    }, key, convertStringToArrayBufferView(atob(data.split(',')[1])))
      .then(result => convertArrayBufferViewtoString((new Uint8Array(result)).subarray(16)));
  };
}
