/* globals chrome */
'use strict';

var background = { // jshint ignore:line
  send: (id, data) => chrome.runtime.sendMessage({
    method: id + '@ui',
    data
  }),
  receive: (id, callback) => chrome.runtime.onMessage.addListener(function (request, sender) {
    if (request.method === id + '@ui' && (!sender.url || sender.url.indexOf('background') !== -1)) {
      callback(request.data);
    }
  })
};

var app = (function (keydown) { // jshint ignore:line
  document.querySelector('iframe').addEventListener('load', function () {
    chrome.app.window.current().contentWindow.frames[0].addEventListener('keydown', function (e) {
      if (keydown) {
        keydown(e);
      }
    }, false);
  });
  return {
    onKeyDown: c => keydown = c
  };
})();

var manifest = {
  app: document.location.href.indexOf('type=extension') === -1
};

if (!manifest.app) {
  document.body.style.width = '400px';
  document.body.style.height = '500px';
}
