'use strict';

var isFirefox = typeof require !== 'undefined', config;
if (isFirefox) {
  var app = require('./firefox/firefox');
  config = exports;
}
else {
  config = {};
}

config.popup = {
  get width () {
    return +app.storage.read('width') || 400;
  },
  set width (val) {
    val = +val;
    if (val < 200) {
      val = 200;
    }
    app.storage.write('width', val);
  },
  get height () {
    return +app.storage.read('height') || 500;
  },
  set height (val) {
    val = +val;
    if (val < 200) {
      val = 200;
    }
    app.storage.write('height', val);
  }
};

config.ui = {
  badge: true,
  backgroundColor: '#3366CC',
};

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3,
  get show () {
    return app.storage.read('show') === 'false' ? false : true; // default is true
  },
  set show (val) {
    app.storage.write('show', val);
  }
};

config.core = {
  get timeout () {
    return +app.storage.read('timeout') || 5; // in minutes,
 },
  set timeout (val) {
    val = +val;
    app.storage.write('timeout', val);
  },
  get selected () {
    return app.storage.read('selected-account');
  },
  set selected (val) {
    app.storage.write('selected-account', val);
  }
};
