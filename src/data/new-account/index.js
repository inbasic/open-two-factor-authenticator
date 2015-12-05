/* global background, qrcode */
'use strict';

navigator.getUserMedia  = navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;

var msg = document.getElementById('msg');
var video = document.querySelector('#camera video');
var canvas = document.querySelector('#camera canvas');
var manual = document.querySelector('#manual input');

var stream;

function send (msg) {
  console.error(msg);
  if (msg && msg.indexOf('otpauth://totp') === 0) {
    background.send('otpauth', msg);
    window.close();
  }
  else {
    background.send('notification', 'Cannot detect a secret key from this QR code.');
  }
}

function capture () {
  var isScanning = false;

  function scan () {
    console.error('scanning');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    qrcode.decode(canvas.toDataURL(), function (err, msg) {
      if (msg) {
        return send(msg);
      }
    });
    isScanning = window.setTimeout(scan, 500);
  }

  navigator.getUserMedia({video: true, audio: false}, function (localMediaStream) {
    stream = localMediaStream;
    video.addEventListener('play', scan, false);
    video.addEventListener('pause', function () {
      window.clearTimeout(isScanning);
      video.src = '';
    }, false);
    video.src = window.URL.createObjectURL(localMediaStream);
  }, function () {});
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
manual.parentNode.addEventListener('submit', function (e) {
  send(manual.value);

  e.preventDefault();
  e.stopPropagation();
  return true;
}, true);
// toolbar
document.addEventListener('click', function (e) {
  var cmd = e.target.dataset.cmd;
  if (cmd) {
    document.body.dataset.type = cmd;
  }
  if (cmd === 'camera') {
    capture();
    msg.textContent = 'Place device\'s camera over a QR code. Scanning QR codes are still experimental feature. Please use "Add an screenshot" or "Enter key manually" if QR code detection failed.';
  }
  else {
    if (stream) {
      stream.stop();
    }
  }
  if (cmd === 'picture') {
    msg.textContent = 'Use the button to select an screenshot of a QR code image.';
  }
  if (cmd === 'manual') {
    msg.textContent = 'Manually enter the QR key in the input box and hit the "Enter" key';
  }
}, false);
