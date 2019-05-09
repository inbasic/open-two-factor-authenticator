'use strict';

var id = document.getElementById('name-field');
var issuer = document.getElementById('issuer-field');

var old = {};

document.querySelector('form').addEventListener('submit', function (e) {
  parent.postMessage({
    'cmd': 'edit-submit',
    'name': id.value,
    'old-issuer': old.issuer,
    'issuer': issuer.value,
    'path': old.path,
    'old-name': old.name
  }, '*');
  e.preventDefault();
  e.stopPropagation();
  return true;
}, true);

parent.postMessage({
  cmd: 'edit-init'
}, '*');

window.addEventListener('message', function (e) {
  var obj = e.data.obj;
  if (obj && e.data.cmd === 'edit-init') {
    id.value = obj.name;
    issuer.value = obj.issuer;
    old.name = obj.name;
    old.path = obj.path;
    old.issuer = obj.issuer;
  }
});
