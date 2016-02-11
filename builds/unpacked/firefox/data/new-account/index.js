/* global background, qrcode */
'use strict';

navigator.getUserMedia  = navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;

var msg = document.getElementById('msg');
var video = document.querySelector('video');
var canvas = document.querySelector('canvas');
var manual = document.querySelector('#manual input');

var stream;

function send (msg) {
  if (msg && msg.indexOf('otpauth://totp') === 0) {
    background.send('otpauth', msg);
    window.close();
  }
  else {
    background.send('notification', 'Cannot detect a secret key from this QR code.');
  }
}

var isScanning = false;
function capture () {
  function scan () {
    canvas.width = Math.min(video.videoWidth, 300);
    canvas.height = Math.min(video.videoHeight, 300);
    let x = (video.videoWidth - canvas.width) / 2;
    let y = (video.videoHeight - canvas.height) / 2;
    canvas.getContext('2d').drawImage(video, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    qrcode.decode(canvas.toDataURL(), function (err, msg) {
      if (msg) {
        return send(msg);
      }
    });
    window.clearTimeout(isScanning);
    isScanning = window.setTimeout(scan, 1000);
  }
  navigator.getUserMedia({video: true, audio: false}, function (localMediaStream) {
    stream = localMediaStream;
    video.addEventListener('play', scan, false);
    video.addEventListener('pause', function () {
      window.clearTimeout(isScanning);
      video.src = '';
    }, false);
    video.src = window.URL.createObjectURL(localMediaStream);
  }, (e) => background.send('notification', e.message));
}

// picture
document.querySelector('#picture input[type=file]').addEventListener('change', function () {
  var reader  = new FileReader();
  reader.onloadend = function () {
    qrcode.decode(reader.result, function (err, msg) {
      send(msg);
    });
  };
  reader.readAsDataURL(this.files[0]);
}, false);
// manual
manual.addEventListener('keyup', function () {
  manual.setCustomValidity(manual.value.indexOf('otpauth://totp') === 0 ? '' : 'Secret key starts with "otpauth://totp".');
}, false);
manual.addEventListener('keypress', function (e) {
  if (e.keyCode === 13 && e.target.validationMessage) {
    background.send('notification', e.target.validationMessage);
  }
}, false);
manual.parentNode.addEventListener('submit', function (e) {
  send(manual.value);
  e.preventDefault();
  e.stopPropagation();
  return true;
}, true);
// toolbar
document.addEventListener('click', function (e) {
  var target = e.target;
  var cmd = target.dataset.cmd;
  if (!cmd) {
    return;
  }
  document.body.dataset.type = cmd;

  if (stream && ('active' in stream ? stream.active : true) && cmd !== 'camera') {
    video.src = '';
    stream.getTracks().forEach(t => t.stop());
    window.clearTimeout(isScanning);
    stream = null;
  }

  if (cmd === 'camera') {
    capture();
    msg.textContent = 'Place device\'s camera over a QR code. Scanning QR codes are still experimental feature. Please use "Add an screenshot" or "Enter key manually" if QR code detection failed.';
  }
  if (cmd === 'picture') {
    msg.textContent = 'Use the button to select an screenshot of a QR code image.';
  }
  if (cmd === 'manual') {
    msg.textContent = 'Manually enter the QR key in the input box and hit the "Enter" key. QR key starts with "otpauth://totp"';
  }
}, false);
