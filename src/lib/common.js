'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var secure = require('./secure');
  var config = require('./config');
  var totp = require('./totp');
}
/**** wrapper (end) ****/

/* app */
var type = 'register';
var mode = 'pin'; //pin or token
var pin;
var accounts = {};

function update () {
  return app.system.root.get()
    .then(app.system.folder.list)
    .then(entries => entries.filter(e => /\.bin$/.test(app.system.file.name(e))).length)
    .then(function (length) {
      type = length ? 'login' : 'register';
      app.ui.send(type);
    }).catch(function (e) {
      console.error(e);
    });
}
update();

function parse (url, path) {
  let query = {};
  let a = url.split('?')[1].split('&');
  for (let i = 0; i < a.length; i++) {
    let b = a[i].split('=');
    query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '').trim();
  }
  query.name = decodeURIComponent(url.split('?')[0].substr(15)).replace(query.issuer + ':', '').trim();
  query.issuer = query.issuer || query.name.split('@')[1].split('.')[0] || query.name;
  query.path = path;

  return query;
}

function renew () {
  let db = secure.DB();
  return db.unlock(pin)
    .then(app.system.root.get)
    .then(app.system.folder.list)
    .then(entries => entries.filter(e => /\.bin$/.test(app.system.file.name(e))))
    //.then(entries => entries.sort((a, b) => app.system.file.name(a) > app.system.file.name(b)))
    .then(function (entries) {
      return app.Promise.all(entries.map(e => app.system.file.read(e).then(db.decrypt)
        .then(url => parse(url, app.system.file.name(e)))
        .then(function (obj) {
          if (!accounts[obj.name] || (accounts[obj.name] && obj.secret !== accounts[obj.name].secret)) {
            app.ui.send('token-account', {
              name: obj.name,
              issuer: obj.issuer,
              period: +(obj.period || 30)
            });
            accounts[obj.name] = obj;
          }
        }).catch(ee => console.error(e, ee))
      ));
    })
    .catch(e => console.error(e));
}

// communication with iframes
var selected = '';
app.ui.receive('cmd', function (obj) {
  if (obj.cmd === 'custom-repository') {
    app.system.root.set().then(update);
  }
  if (obj.cmd === 'pin-submit') {
    pin = obj.pin;
    mode = 'token';
    app.ui.send('token');
  }
  if (obj.cmd === 'token-item' && obj.type === 'new') {
    app.system.open('new-account/index.html', 'new-account');
  }
  if (obj.cmd === 'token-selected') {
    selected = obj.name;
    if (accounts[obj.name]) {
      totp.gen(totp.base32ToBuffer(accounts[obj.name].secret)).then(function (c) {
        app.ui.send('token-pin', c);
      });
    }
  }
  if (obj.cmd === 'token-accounts') {
    accounts = {};
    renew();
  }
  if (obj.cmd === 'token-copy') {
    app.clipboard.copy(obj.txt);
    app.notification('Token is copied to the clipboard');
  }
  if (obj.cmd === 'notification') {
    app.notification(obj.msg);
  }
  if (obj.cmd === 'edit-init') {
    app.ui.send('edit-init', accounts[selected]);
  }
  if (obj.cmd === 'edit-submit') {
    let tmp = Object.assign(accounts[obj['old-name']], {
      name: obj.name,
      issuer: obj.issuer
    });
    var name = tmp.name;
    delete tmp.name;
    delete tmp.path;

    let url = 'otpauth://totp/' + tmp.issuer + ':' + name + '?' + Object.keys(tmp).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(tmp[k])).join('&');

    (function (db) {
      db.unlock(pin).then(() => db.encrypt(url)).then(function (encoded) {
        return app.system.root.get()
          .then(() => app.system.file.create(obj.path, null, encoded));
      })
      .then(function () {
        delete accounts[obj['old-name']];
        accounts[obj.name] = obj;
        app.ui.send('token', obj.name);
      })
      .catch(e => console.error(e));
    })(secure.DB());
  }
});
app.ui.receive('window-type', () => app.ui.send(type));

/* new account */
app.account.receive('otpauth', function (url) {
  console.error(url);
  (function (db) {
    db.unlock(pin).then(() => db.encrypt(url)).then(function (encoded) {
      let name = parse(url).name + '.bin';
      return app.system.root.get()
        .then(d => app.system.file.create(d, name.replace(/(\<|\>|\:|\"|\/|\\|\||\?|\*)/g, '-'), encoded))
        .then(renew);
    }).catch(e => console.error(e));
  })(secure.DB());
  app.tab.close('new-account/index.html');
});
app.account.receive('notification', function (msg) {
  app.notification(msg);
});

/* menu */
app.ui.receive('menu', function (cmd) {
  if (cmd === 'open-faq') {
    app.tab.open('http://add0n.com/open-two-factor-authenticator.html');
  }
  if (cmd === 'open-bugs') {
    app.tab.open('https://github.com/inbasic/open-two-factor-authenticator');
  }
  if (cmd === 'edit-selected') {
    if (accounts[selected]) {
      app.ui.send('edit');
    }
    else {
      app.notification('Cannot edit ' + selected);
    }
  }
  if (cmd === 'export-selected') {
    if (accounts[selected]) {
      app.download(accounts[selected].path);
    }
    else {
      app.notification('Cannot export ' + selected);
    }
  }
  if (cmd === 'export-all') {
    app.system.root.get()
      .then(app.system.folder.list)
      .then(entries => entries.filter(e => /\.bin$/.test(app.system.file.name(e))))
      .then(entries => entries.forEach(e => app.download(app.system.file.name(e))))
      .catch(e => console.error(e));
  }
});
