'use strict';

var duration = 30;
/*

var selected = (function (arr) {
  return arr && arr.length ? decodeURIComponent(arr[1]) : '';
})(/selected\=([^\&]+)/.exec(document.location.search));
console.error(document.location.search, selected);
*/

var selected = {
  name: '',
  issuer: ''
};

document.querySelector('#search input').addEventListener('keyup', function (e) {
  var value = e.target.value.toLowerCase();
  [].forEach.call(document.querySelectorAll('#accounts>div'), function (div) {
    div.dataset.fade = value && div.textContent.toLowerCase().indexOf(value) === -1 ? true : false;
  });
});

if (parent.app) {
  parent.app.onKeyDown(function (e) {
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyF') {
      document.querySelector('#search input').focus();
    }
  });
}

var reset = (function () {
  let bar = document.getElementById('bar').querySelector('div');
  bar.addEventListener('transitionend', function () {
    reset();
  });

  return function () {
    bar.classList.remove('active');

    let epoch = (new Date()).getTime();
    let d = duration * 1000;
    let ratio = 1 - epoch / d + Math.floor(epoch / d);

    bar.style['transition-duration'] = '0s';
    bar.style.width = (ratio * 100) + '%';
    window.setTimeout(() => {
      bar.classList.add('active');
      bar.style['transition-duration'] = (ratio * duration) + 's';
    }, 10);
    if (selected.name) {
      parent.postMessage({
        'cmd': 'token-selected',
        'name': selected.name,
        'issuer': selected.issuer
      }, '*');
    }
  };
})();
reset();

function isScrolledIntoView (el) {
  let elemTop = el.getBoundingClientRect().top;
  let elemBottom = el.getBoundingClientRect().bottom;

  return (elemTop >= 0) && (elemBottom <= window.innerHeight);
}

function select (item) {
  if (item.dataset.type !== 'new') {
    [].forEach.call(document.querySelectorAll('#accounts [data-type]'), i => i.dataset.selected = false);
    item.dataset.selected = true;
    if (!isScrolledIntoView(item)) {
      item.scrollIntoView();
    }
    document.querySelector('#token tr:first-child td').textContent = item.dataset.name;
    selected.name = item.dataset.name;
    selected.issuer = item.dataset.issuer;
    reset();
  }
}

document.addEventListener('click', function (e) {
  var type = e.target.dataset.type;
  var cmd = e.target.dataset.cmd;
  if (type) {
    parent.postMessage({
      cmd: 'token-item',
      type: type
    }, '*');
    select(e.target);
  }
  if (cmd === 'copy') {
    parent.postMessage({
      cmd: 'token-copy',
      txt: document.querySelector('#token tr:last-child td:first-child').dataset.pin
    }, '*');
  }
  else if (cmd === 'exit') {
    parent.postMessage({
      cmd: 'token-exit'
    }, '*');
  }
}, false);

window.addEventListener('message', function (e) {
  var cmd = e.data.cmd;
  if (cmd === 'token-account') {
    var obj = e.data.data;
    var accounts = document.getElementById('accounts');
    var item = document.querySelector('[data-type=new]').cloneNode(true);
    item.dataset.type = obj.issuer.toLowerCase();
    item.dataset.name = obj.name;
    item.dataset.issuer = obj.issuer;
    item.querySelector('tr:first-child td').textContent = obj.issuer;
    item.querySelector('tr:last-child td').textContent = obj.name;
    item.title = obj.name;
    accounts.appendChild(item);
    if (obj.selected) {
      selected.name = obj.name;
      selected.issuer = obj.issuer;
      select(item);
    }

  }
  if (cmd === 'token-pin') {
    let td = document.querySelector('#token tr:last-child td');
    td.dataset.pin = e.data.pin;
    td.querySelector('span:first-child').textContent = e.data.pin.substr(0, 3);
    td.querySelector('span:last-child').textContent = e.data.pin.substr(3);
  }
}, false);
parent.postMessage({cmd: 'token-accounts'}, '*');
