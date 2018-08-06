'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var secure = require('./secure');
  var config = require('./config');
  var totp = require('./totp');
}
/**** wrapper (end) ****/

/* welcome page */
app.startup(function () {
  let version = config.welcome.version;
  if (app.version() !== version) {
    app.timer.setTimeout(function () {
      app.tab.open(
        'http://add0n.com/two-factor-authenticator.html?v=' + app.version() +
        (version ? '&p=' + version + '&type=upgrade' : '&type=install')
      );
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
});

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
      if (type === 'login' && pin) {
        mode = 'token';
        app.ui.send('token');
      }
      app.ui.send(type);
    }).catch((e) => app.notification(e.message));
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
  try{
    query.issuer =  query.issuer || query.name.split('@')[1].split('.')[0] || query.name;
  }
  catch(err){
    query.issuer = query.issuer || decodeURIComponent(url.split('?')[0].substr(15)).split('%3A')[0].split(':')[0];
  }
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
      return app.Promise.all(entries.map(e => app.system.file.read(e)
        .then(db.decrypt)
        .then(url => parse(url, app.system.file.name(e)))
        .then(function (obj) {
          let name = obj.name + '/' + obj.issuer;
          if (!accounts[name] || (accounts[name] && obj.secret !== accounts[name].secret)) {
            app.ui.send('token-account', {
              name: obj.name,
              issuer: obj.issuer,
              period: +(obj.period || 30),
              selected: config.core.selected ? config.core.selected === name : true
            });
            accounts[name] = obj;
          }
        }).catch((ee) => console.error(`Cannot decrypt ${e.name}; ${ee.message}`))
      ));
    })
    .catch(e => app.notification(e.message));
}

// communication with iframes
var selected = config.core.selected;
app.ui.receive('cmd', function (obj) {
  if (obj.cmd === 'custom-repository') {
    app.system.root.set().then(update).catch(function () {});
  }
  else if (obj.cmd === 'pin-submit') {
    pin = obj.pin;
    mode = 'token';
    app.ui.send('token');
  }
  else if (obj.cmd === 'token-exit') {
    pin = '';
    mode = 'pin';
    app.ui.send('login');
  }
  else if (obj.cmd === 'token-item' && obj.type === 'new') {
    app.system.open('new-account/index.html', 'new-account');
  }
  else if (obj.cmd === 'token-selected') {
    selected = obj.name + '/' + obj.issuer;
    if (accounts[selected]) {
      totp.gen(totp.base32ToBuffer(accounts[selected].secret)).then(function (c) {
        app.ui.send('token-pin', c);
      });
    }
    config.core.selected = selected;
  }
  else if (obj.cmd === 'token-accounts') {
    accounts = {};
    renew();
  }
  else if (obj.cmd === 'token-copy') {
    app.clipboard.copy(obj.txt);
    app.notification('Token is copied to the clipboard');
  }
  else if (obj.cmd === 'notification') {
    app.notification(obj.msg);
  }
  else if (obj.cmd === 'edit-init') {
    app.ui.send('edit-init', accounts[selected]);
  }
  else if (obj.cmd === 'edit-submit') {
    let oldname = obj['old-name'] + '/' + obj['old-issuer'];
    let tmp = Object.assign(accounts[oldname], {
      name: obj.name,
      issuer: obj.issuer
    });
    var newname = tmp.name;
    delete tmp.name;
    delete tmp.path;

    let url = 'otpauth://totp/' + tmp.issuer + ':' + newname + '?' + Object.keys(tmp).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(tmp[k])).join('&');
    (function (db) {
      db.unlock(pin).then(() => db.encrypt(url)).then(function (encoded) {
        return app.system.root.get()
          .then(() => app.system.file.create(obj.path, null, encoded));
      })
      .then(function () {
        delete accounts[oldname];
        accounts[newname + '/' + tmp.issuer] = obj;
        app.ui.send('token', obj.name);
      })
      .catch(e => app.notification(e.message));
    })(secure.DB());
  }
});
app.ui.receive('window-type', () => update().then(() => app.ui.send(type)));

/* new account */
app.account.receive('otpauth', function (url) {
  (function (db) {
    db.unlock(pin).then(() => db.encrypt(url)).then(function (encoded) {
      let name = parse(url).name + '.bin';
      return app.system.root.get()
        .then(d => app.system.file.create(d, name.replace(/(<|\>|\:|\"|\/|\\|\||\?|\*)/g, '-'), encoded))
        .then(renew)
        .then(() => app.notification(`Saved as "${name}"`));
    }).catch(e => app.notification(e.message));
  })(secure.DB());
  app.tab.close('new-account/index.html');
});
app.account.receive('notification', function (msg) {
  app.notification(msg);
});

/* menu */
app.ui.receive('menu', function (cmd) {
  if (cmd === 'open-faq') {
    app.tab.open('http://add0n.com/two-factor-authenticator.html');
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
      .catch(e => app.notification(e.message));
  }
});

/**/
let idle;
app.on('app:idle', function () {
  if (!idle) {
    // console.error('app:idle');
    idle = app.timer.setTimeout(function () {
      idle = null;
      pin = null;
    }, Object.keys(accounts).length ? config.core.timeout * 60 * 1000 : 0);
  }
});
app.on('app:active', function () {
  // console.error('app:active');
  idle = app.timer.clearTimeout(idle);
});
