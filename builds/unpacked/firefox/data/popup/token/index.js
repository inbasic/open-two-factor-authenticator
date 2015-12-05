'use strict';

var duration = 30;
var selected = (function (arr) {
  return arr && arr.length ? decodeURIComponent(arr[1]) : '';
})(/selected\=([^\&]+)/.exec(document.location.search));

document.querySelector('#search input').addEventListener('keyup', function (e) {
  var value = e.target.value.toLowerCase();
  [].forEach.call(document.querySelectorAll('#accounts>div'), function (div) {
    div.dataset.fade = value && div.textContent.toLowerCase().indexOf(value) === -1 ? true : false;
  });
});

var reset = (function () {
  document.querySelector('#bar div:last-child').addEventListener('transitionend', function () {
    document.querySelector('#bar div:last-child').style['transition-duration'] = '0s';
    document.querySelector('#bar div:last-child').style['-webkit-transition-duration'] = '0s';
    document.querySelector('#bar div:last-child').style['margin-right'] = 0;
    document.querySelector('#bar div:first-child').style.width = '0';
    window.setTimeout(reset, 0);
  });
  return function () {
    var epoch = Math.round(new Date().getTime() / 1000.0) - 1;
    var current = epoch / duration;
    var reference = Math.floor(current);
    var ratio = 1 - current + reference;

    document.querySelector('#bar div:first-child').style.width = ((1 - ratio) * 100) + '%';
    document.querySelector('#bar div:last-child').style['margin-right'] = (ratio * 100) + '%';
    document.querySelector('#bar div:last-child').style['transition-duration'] = (ratio * duration) + 's';
    document.querySelector('#bar div:last-child').style['-webkit-transition-duration'] = (ratio * duration) + 's';

    if (selected) {
      parent.postMessage({
        'cmd': 'token-selected',
        'name': selected
      }, '*');
    }
  };
})();
window.setTimeout(reset, 100);

function select (item) {
  [].forEach.call(document.querySelectorAll('#accounts [data-type]'), i => i.dataset.selected = false);
  item.dataset.selected = true;
  document.querySelector('#token tr:first-child td').textContent = item.dataset.name;
  selected = item.dataset.name;
  reset();
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
      txt: document.querySelector('#token tr:last-child td:first-child').textContent
    }, '*');
  }
}, false);

var timeout;

window.addEventListener('message', function (e) {
  var cmd = e.data.cmd;
  if (cmd === 'token-account') {
    var obj = e.data.data;
    var accounts = document.getElementById('accounts');
    var item = document.querySelector('[data-type=new]').cloneNode(true);
    item.dataset.type = obj.issuer.toLowerCase();
    item.dataset.name = obj.name;
    item.querySelector('tr:first-child td').textContent = obj.issuer;
    item.querySelector('tr:last-child td').textContent = obj.name;
    item.title = obj.name;
    accounts.appendChild(item);
    if (!selected) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(select, 100, item);
    }
    if (selected === obj.name) {
      select(item);
    }
  }
  if (cmd === 'token-pin') {
    document.querySelector('#token tr:last-child td').textContent = e.data.pin;
  }
}, false);
parent.postMessage({cmd: 'token-accounts'}, '*');
