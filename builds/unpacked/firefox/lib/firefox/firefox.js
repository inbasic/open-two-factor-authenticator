/* globals crypto, Blob */
'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    core          = require('sdk/view/core'),
    pageMod       = require('sdk/page-mod'),
    notifications = require('sdk/notifications'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    base64        = require('sdk/base64'),
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    fileIO        = require('sdk/io/file'),
    platform      = require('sdk/system').platform,
    {on, off, once, emit} = require('sdk/event/core'),
    {Cc, Ci, Cu, Cr}  = require('chrome'),
    config        = require('../config');

Cu.import('resource://gre/modules/Promise.jsm');
Cu.importGlobalProperties(['crypto', 'Blob']);
var {Services} = Cu.import('resource://gre/modules/Services.jsm');
var desktop = ['winnt', 'linux', 'darwin'].indexOf(platform) !== -1;

// Promise
exports.Promise = Promise;
exports.crypto = crypto;
exports.btoa = base64.encode;
exports.atob = base64.decode;
exports.FileReader =  function () {
  return Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader);
};
exports.Blob = Blob;

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

exports.ui = (function () {
  var popup;
  var callbacks = [];
  var workers = [];

  return desktop ? {
    popup: function (p) {
      popup = p;
      core.getActiveView(popup).setAttribute('tooltip', 'aHTMLTooltip');
      p.on('hide', function () {
        p.destroy();
        popup = null;
      });
      callbacks.forEach(obj => popup.port.on(obj.id, obj.callback));
    },
    hide: function () {
      if (popup) {
        popup.hide();
      }
    },
    send: function (id, data) {
      if (popup) {
        popup.port.emit(id, data);
      }
    },
    receive: function (id, callback) {
      callbacks.push({id, callback});
      if (popup) {
        popup.port.on(id, callback);
      }
    }
  } :
  {
    popup: function (options) {
      options.include = self.data.url('popup/index.html');
      options.attachTo = ['top', 'existing'];
      let pm = pageMod.PageMod(options);
      pm.on('attach', function (worker) {
        array.add(workers, worker);
        worker.on('pageshow', function () { array.add(workers, this); });
        worker.on('pagehide', function () { array.remove(workers, this); });
        worker.on('detach', function () { array.remove(workers, this); });
        callbacks.forEach(obj => worker.port.on(obj.id, obj.callback));
      });
    },
    send: function (id, data) {
      workers.forEach(w => w.port.emit(id, data));
    },
    receive: function (id, callback) {
      callbacks.push({id, callback});
      workers.forEach(worker => worker.port.on(id, callback));
    },
    hide: function () {
      workers.forEach(worker => worker.tab.close());
    }
  };
})();

//toolbar button
exports.button = (function () {
  var id;
  var options = {
    contentURL: data.url('./popup/index.html'),
    contentScriptFile: [data.url('./popup/firefox/firefox.js'), data.url('./popup/index.js')],
    contentScriptWhen: 'ready'
  };
  function getNativeWindow() {
    let window = Services.wm.getMostRecentWindow('navigator:browser');
    return window.NativeWindow;
  }

  if (desktop) {
    let button = require('sdk/ui/button/action').ActionButton({
      id: self.name,
      label: 'Open Two-Factor Authenticator',
      icon: {
        '16': './icons/16.png',
        '32': './icons/32.png'
      },
      onClick: function() {
        var popup = require('sdk/panel').Panel(options);
        exports.ui.popup(popup);
        popup.show({
          width: config.popup.width,
          height: config.popup.height,
          position: button
        });
      }
    });
  }
  else {
    exports.ui.popup(options);
    id = getNativeWindow().menu.add('Open Two-Factor Authenticator', null, function () {
      for each (var tab in tabs) {
        if (tab.url.indexOf(data.url('')) === 0) {
          tab.close();
        }
      }
      tabs.open(data.url('popup/index.html'));
    });
    unload.when(() => getNativeWindow().menu.remove(id));
  }
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

// new account
exports.account = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: data.url('new-account/index.html'),
    contentScriptFile: [data.url('./new-account/firefox/firefox.js'), data.url('./new-account/qrcode-decoder.js'), data.url('./new-account/index.js')],
    contentScriptWhen: 'ready',
    attachTo: ['top', 'existing'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
    exports.ui.hide();
  },
  close: function (url) {
    for each (var tab in tabs) {
      if (tab.url.indexOf(data.url(url)) === 0) {
        tab.close();
      }
    }
  },
  list: function () {
    var temp = [];
    for each (var tab in tabs) {
      temp.push(tab);
    }
    return Promise.resolve(temp);
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.notification = function (text) {
  notifications.notify({
    title: 'Open Two-Factor Authenticator',
    text: text,
    iconURL: data.url('icons/32.png')
  });
};

exports.download = function (path) {
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  let url = Services.io.newFileURI(file).spec;
  tabs.open(url);
};

exports.system = (function () {
  let nsIFilePicker = Ci.nsIFilePicker;
  let filePicker = Cc['@mozilla.org/filepicker;1']
    .createInstance(nsIFilePicker);

  return {
    open: function (url) {
      exports.ui.hide();
      exports.tab.open(url);
    },
    root: {
      set: function () {
        let d = Promise.defer();
        let window = require('sdk/window/utils').getMostRecentBrowserWindow();
        filePicker.init(window, 'Repository Location', nsIFilePicker[desktop ? 'modeGetFolder' : 'modeGetFile']);
        filePicker.appendFilters(nsIFilePicker.filterAll);
        let pickerStatus = filePicker.show();
        if (pickerStatus === nsIFilePicker.returnOK || pickerStatus === nsIFilePicker.returnReplace) {
          prefs.root = desktop ? filePicker.file.path : filePicker.file.parent.path;
          d.resolve();
        }
        else {
          d.reject();
        }
        return d.promise;
      },
      get: function () {
        let d = Promise.defer();
        if (prefs.root) {
          d.resolve(prefs.root);
        }
        else {
          let file = Cc['@mozilla.org/file/directory_service;1']
           .getService(Ci.nsIDirectoryService)
           .QueryInterface(Ci.nsIProperties)
           .get('ProfD', Ci.nsIFile);
          file.append('iotfautenticator');
          try {
            file.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
          }
          catch (ex if ex.result === Cr.NS_ERROR_FILE_ALREADY_EXISTS) {}
          catch (ex) {
            d.reject(ex);
          }
          d.resolve(file.path);
        }
        return d.promise;
      }
    },
    folder: {
      list: function (path) {
        let d = Promise.defer();
        d.resolve(fileIO.list(path).map(f => fileIO.join(path, f)));
        return d.promise;
      }
    },
    file: {
      name: (p) => p,
      create: function (dir, filename, content) {
        let d = Promise.defer();
        var TextWriter = fileIO.open(filename ? fileIO.join(dir, filename) : dir, 'w');
        if (!TextWriter.closed) {
          TextWriter.write(content);
          TextWriter.close();
          d.resolve();
        }
        else {
          d.reject(new Error('file is closed'));
        }
        return d.promise;
      },
      read: function (path) {
        let d = Promise.defer();
        if (fileIO.exists(path)) {
          var TextReader = fileIO.open(path, 'r');
          if (!TextReader.closed) {
            d.resolve(TextReader.read());
            TextReader.close();
          }
        }
        else {
          d.resolve('');
        }
        return d.promise;
      }
    },
  };
})();

exports.clipboard = (function () {
  if (desktop) {
    let clipboard = require('sdk/clipboard');
    return {
      copy: function (txt) {
        clipboard.set(txt);
      }
    };
  }
  else {
    let gClipboardHelper = Cc['@mozilla.org/widget/clipboardhelper;1'].getService(Ci.nsIClipboardHelper);
    return {
      copy: function (txt) {
        gClipboardHelper.copyString(txt);
      }
    };
  }
})();

unload.when(function () {
  for each (var tab in tabs) {
    if (tab.url.indexOf(data.url('')) === 0) {
      tab.close();
    }
  }
});
