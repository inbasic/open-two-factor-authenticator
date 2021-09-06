'use strict';

var password = document.getElementById('password');
var confirm = document.getElementById('password-confirm');

function validate () {
  if (document.body.dataset.type === 'register' && password.value !== confirm.value) {
    confirm.setCustomValidity('passwords do not match');
  }
  else {
    confirm.setCustomValidity('');
  }
}

password.addEventListener('keyup', validate, false);
confirm.addEventListener('keyup', validate, false);

document.querySelector('form').addEventListener('submit', function (e) {
  parent.postMessage({
    cmd: 'pin-submit',
    pin: password.value
  }, '*');

  e.preventDefault();
  e.stopPropagation();
  return true;
}, true);

document.getElementById('repository').addEventListener('click', function () {
  parent.postMessage({
    cmd: 'custom-repository'
  }, '*');
}, false);

window.addEventListener('hashchange', function () {
  document.body.dataset.type = location.hash.substr(1).split('?')[0];
}, false);
document.body.dataset.type = location.hash.substr(1).split('?')[0];

window.setTimeout(function () {
  password.focus();
}, 100);

document.body.dataset.platform = parent.document.location.href.indexOf('type=extension') !== -1 ? 'extension' : 'app';
