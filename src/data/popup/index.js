/* global background */
'use strict';

(function (menu) {
  menu.addEventListener('click', function (e) {
    menu.dataset.active = true;
    var cmd = e.target.dataset.cmd;
    if (cmd) {
      background.send('menu', cmd);
      menu.dataset.active = false;
    }
  }, false);
  window.addEventListener('blur', function () {
    menu.dataset.active = false;
  }, false);
  window.addEventListener('click', function (e) {
    if (!menu.contains(e.target)) {
      menu.dataset.active = false;
    }
  }, false);
})(document.getElementById('menu'));

window.addEventListener('message', e => {
  background.send('cmd', e.data);
}, false);

background.receive('token', (id) => {
  document.body.dataset.type = 'token';
  window.frames[0].document.location = document.location.href.replace('index.html', 'token/index.html' + (id ? '?selected=' + id : ''));
});
background.receive('edit', () => {
  document.body.dataset.type = 'edit';
  window.frames[0].document.location = document.location.href.replace('index.html', 'edit/index.html');
});
background.receive('login', () => {
  document.body.dataset.type = 'login';
  window.frames[0].document.location = document.location.href.replace('index.html', 'pin/index.html#login');
});
background.receive('register', () => {
  document.body.dataset.type = 'register';
  window.frames[0].document.location = document.location.href.replace('index.html', 'pin/index.html#register');
});
background.receive('token-account', (obj) => window.frames[0].postMessage({
  cmd: 'token-account',
  data: obj
}, '*'));
background.receive('token-pin', (pin) => window.frames[0].postMessage({
  cmd: 'token-pin',
  pin: pin
}, '*'));
background.receive('edit-init', (obj) => window.frames[0].postMessage({
  cmd: 'edit-init',
  obj: obj
}, '*'));
background.send('window-type');
