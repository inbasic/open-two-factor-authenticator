'use strict';

window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

var app = new EventEmitter();
app.globals = {
  browser: navigator.userAgent.indexOf('OPR') === -1 ? 'chrome' : 'opera',
  app: chrome.fileSystem && chrome.fileSystem.restoreEntry
};

app.once('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = '../common.js';
});

app.Promise = Promise;
app.FileReader = FileReader;
app.Blob = Blob;
app.atob = (a) => window.atob(a);
app.btoa = (a) => window.btoa(a);

app.storage = (function () {
  var objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: function (id) {
      return (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id];
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    }
  };
})();

// UI
app.ui = (function () {
  return {
    send: function (id, data) {
      id += '@ui';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@ui';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// new account
app.account = (function () {
  return {
    send: function (id, data) {
      id += '@account';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@account';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (!chrome.tabs) {
      chrome.browser.openTab({url});
    }
    else {
      if (inCurrent) {
        chrome.tabs.update(null, {url});
      }
      else {
        chrome.tabs.create({url, active: typeof inBackground === 'undefined' ? true : !inBackground});
      }
    }
  },
  close: function () {},
  list: function () {
    var d = app.Promise.defer();
    chrome.tabs.query({
      currentWindow: false
    }, function (tabs) {
      d.resolve(tabs);
    });
    return d.promise;
  }
};

app.notification = function (text) {
  chrome.notifications.create(null, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('./') + 'data/icons/48.png',
    title: 'Open Two-Factor Authenticator',
    message: text
  }, function () {});
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

// webapp
if (app.globals.app) {
  chrome.app.runtime.onLaunched.addListener(function () {
    chrome.app.window.create('data/popup/index.html', {
      id: 'ui',
      bounds: {
        width: 400,
        height: 500
      }
    });
  });
}

// system
app.system = (function () {
  return {
    open: function (url, id) {
      if (app.globals.app) {
        chrome.app.window.create('data/' + url, {
          id,
          bounds: {
            width: 500,
            height: 600
          }
        });
      }
      else {
        chrome.tabs.create({url: 'data/' + url, active: true});
      }
    },
    root: {
      set: function () {
        let d = Promise.defer();
        let wins = chrome.app.window.getAll();
        if (wins && wins.length) {
          let win = wins[0].contentWindow;
          win.chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (folder) {
            if (folder) {
              chrome.storage.local.set({
                root: chrome.fileSystem.retainEntry(folder)
              });
              d.resolve();
            }
            else {
              d.reject();
            }
          });
        }
        return d.promise;
      },
      get: function () {
        let d = Promise.defer();
        if (app.globals.app) {
          chrome.storage.local.get('root', function (storage) {
            if (storage.root) {
              try {
                chrome.fileSystem.restoreEntry(storage.root, function (dirEntry) {
                  if (dirEntry) {
                    d.resolve(dirEntry);
                  }
                  else {
                    d.reject(new Error('Cannot locate the destination folder'));
                  }
                });
              }
              catch (e) {
                d.reject(e);
              }
            }
            else {
              window.requestFileSystem(window.PERMANENT, 1024 * 1024, function (fs) {
                fs.root.getDirectory('iotfautenticator', {create: true}, function (dirEntry) {
                  d.resolve(dirEntry);
                }, e => d.reject(e));
              }, e => d.reject(e));
            }
          });
        }
        else {
          chrome.storage.local.get('file-names', function (storage) {
            if (storage['file-names']) {
              d.resolve(storage['file-names']);
            }
            else {
              d.resolve([]);
            }
          });
        }
        return d.promise;
      }
    },
    folder: {
      list: function (dirEntry) {
        let d = Promise.defer();
        if (app.globals.app) {
          dirEntry.createReader().readEntries (function (results) {
            d.resolve(results);
          }, e => d.reject(e));
        }
        else {
          chrome.storage.local.get(null, function (storage) {
            d.resolve(dirEntry.map(n => storage[n]));
          });
        }
        return d.promise;
      }
    },
    file: {
      name: function (fileEntry) {
        return fileEntry.fullPath;
      },
      create: function (dirEntry, name, content) {
        let d = Promise.defer();
        function write (fileEntry) {
          var truncated = false;
          fileEntry.createWriter(function (fileWriter) {
            fileWriter.onwriteend = function () {
              if (truncated) {
                d.resolve();
              }
              else {
                truncated = true;
                this.truncate(this.position);
              }
            };
            fileWriter.onerror = e => d.reject(e);
            let blob = new Blob([content], {type: 'application/octet-binary'});
            fileWriter.write(blob);
          }, e => d.reject(e));
        }
        if (app.globals.app) {
          if (name) {
            dirEntry.getFile(name, {create: true}, (f) => write(f), e => d.reject(e));
          }
          else {
            app.system.root.get().then(function (d) {
              d.getFile(dirEntry, {create: true}, (f) => write(f), e => d.reject(e));
            }, e => d.reject(e));
          }
        }
        else {
          if (name) {
            let fileName = 'file-name-' + name;
            let obj = {};
            obj[fileName] = {content, fullPath: name};
            chrome.storage.local.set(obj, function () {
              chrome.storage.local.set({
                'file-names': dirEntry.concat(fileName).filter((e, i, l) => l.indexOf(e) === i)
              }, () => d.resolve());
            });
          }
          else {
            let fileName = 'file-name-' + dirEntry;
            let obj = {};
            obj[fileName] = {content, fullPath: dirEntry};
            chrome.storage.local.set(obj, function () {
              chrome.storage.local.get('file-names', function (storage) {
                chrome.storage.local.set({
                  'file-names': (storage['file-names'] || []).concat(fileName).filter((e, i, l) => l.indexOf(e) === i)
                }, () => d.resolve());
              });
            });
          }
        }
        return d.promise;
      },
      read: function (fileEntry) {
        let d = Promise.defer();
        if (app.globals.app) {
          fileEntry.file(function (file) {
            let reader = new FileReader();
            reader.onloadend = () => d.resolve(reader.result);
            reader.readAsText(file);
          }, e => d.reject(e));
        }
        else {
          d.resolve(fileEntry.content);
        }
        return d.promise;
      }
    }
  };
})();

app.clipboard = {
  copy: function (txt) {
    document.oncopy = function (event) {
      event.clipboardData.setData('Text', txt);
      event.preventDefault();
    };
    let textarea = document.getElementById('clipboard');
    textarea.value = txt;
    textarea.focus();
    textarea.select();
    document.execCommand('copy', false, null);
    document.oncopy = undefined;
  }
};

app.startup = (function () {
  let loadReason, callback;
  function check () {
    if (loadReason === 'startup' || loadReason === 'install') {
      if (callback) {
        callback();
      }
    }
  }
  chrome.runtime.onInstalled.addListener(function (details) {
    loadReason = details.reason;
    check();
  });
  chrome.runtime.onStartup.addListener(function () {
    loadReason = 'startup';
    check();
  });
  return function (c) {
    callback = c;
    check();
  };
})();
