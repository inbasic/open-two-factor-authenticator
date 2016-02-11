/* globals self */
'use strict';

window.background = {
  send: self.port.emit,
  receive: self.port.on
};

window.app = (function (keydown) {
  let iframe = document.querySelector('iframe');
  iframe.addEventListener('load', () => iframe.addEventListener('keydown', function (e) {
      if (keydown) {
        keydown(e);
      }
    }, false)
  );
  return {
    onKeyDown: (c) => keydown = c
  };
})();
