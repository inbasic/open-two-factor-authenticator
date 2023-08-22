/* globals secure, Sortable, jsOTP */
'use strict';

const prefs = {};
let totp;
let secret;

const es = {
  token: document.getElementById('token'),
  manager: document.getElementById('manager'),
  progress: document.getElementById('progress'),
  confirm: document.getElementById('confirm')
};

const confirm = () => new Promise((resolve, reject) => {
  es.confirm.classList.remove('hidden');
  const observe = e => {
    const command = e.target.dataset.command;
    if (command === 'true') {
      resolve();
    }
    else if (command === 'false') {
      reject(Error('user canceled'));
    }
    if (command) {
      es.confirm.classList.add('hidden');
      es.confirm.removeEventListener('click', observe);
    }
  };
  es.confirm.addEventListener('click', observe);
});

const decrypt = () => chrome.storage.sync.get(null, async ps => {
  Object.assign(prefs, ps);

  const keys = Object.keys(prefs).filter(k => k.startsWith('entry-')).sort((a, b) => {
    return prefs[a].index - prefs[b].index;
  });
  const t = document.getElementById('entry');
  let ignored = 0;
  for (const key of keys) {
    try {
      const secret = await secure.decrypt(prefs[key].secret);

      const clone = document.importNode(t.content, true);
      const label = clone.querySelector('label');
      const id = key.replace('entry-', '');
      label.appendChild(document.createTextNode(id));
      label.title = id;
      label.dataset.id = key;
      const {icon, period, digits} = prefs[key];
      if (icon) {
        label.classList.add(icon);
      }
      Object.assign(label, {
        period,
        digits,
        secret
      });
      es.manager.appendChild(clone);
    }
    catch (e) {
      ignored += 1;
      console.log(e);
    }
  }
  sortable();
  if (ignored !== 0) {
    chrome.notifications.create({
      type: 'basic',
      title: chrome.runtime.getManifest().name,
      message: `Some credentials are ignored due to password mismatch (${ignored})`,
      iconUrl: '/data/icons/48.png'
    });
  }
  if (keys.length - ignored === 0) {
    document.body.classList.add('empty');
  }
});

document.getElementById('welcome').addEventListener('submit', e => {
  e.preventDefault();

  const password = document.getElementById('password').value;
  secure.unlock(password).then(() => {
    document.body.classList.add('second');
    decrypt();
  });
});

// sortable
const sortable = () => {
  const script = document.createElement('script');
  script.src = 'Sortable.js';
  script.onload = () => {
    const sortable = new Sortable(document.getElementById('manager'), {
      draggable: '.entry',
      animation: 350,
      onEnd: () => {
        sortable.toArray().forEach((key, index) => prefs[key].index = index);
        chrome.storage.sync.set(prefs);
      }
    });
  };
  document.body.appendChild(script);
};
// totp
const update = () => {
  const [p1, p2] = [...es.token.querySelectorAll('span')];
  try {
    const token = totp.getOtp(secret);
    p1.textContent = token.substr(0, totp.length / 2);
    p2.textContent = token.substr(totp.length / 2);
    p1.title = p2.title = '';
  }
  catch (e) {
    console.error(e);
    p1.textContent = 'ERR';
    p2.textContent = '';
    p1.title = p2.title = e.message;
  }
};
// progress
es.progress.addEventListener('animationiteration', update);
// selection
es.manager.addEventListener('change', e => {
  const prepare = () => {
    const entry = e.target.closest('.entry');
    // eslint-disable-next-line new-cap
    totp = new jsOTP.totp(entry.period, entry.digits);
    es.progress.style['--period'] = entry.period;
    const epoch = Date.now();
    const d = entry.period * 1000;
    const ratio = epoch / d - Math.floor(epoch / d);
    es.progress.classList.remove('animate');
    es.progress.style['animation-delay'] = '-' + ratio * entry.period + 's';
    secret = entry.secret;
    entry.classList.add('selected');
    window.setTimeout(() => es.progress.classList.add('animate'), 10);
    window.setTimeout(update, 100);
  };
  if (e.isTrusted) {
    const old = es.manager.querySelector('.selected');
    if (old) {
      old.classList.remove('selected');
      prepare();
    }
    else {
      const script = document.createElement('script');
      script.src = 'library/jsOTP.js';
      script.onload = () => {
        prepare();
        es.token.classList.remove('hidden');
        es.progress.classList.remove('hidden');
      };
      document.body.appendChild(script);
    }
  }
});
// removal
es.manager.addEventListener('click', ({target}) => {
  const command = target.dataset.command;
  if (command === 'remove') {
    const entry = target.closest('.entry');
    const key = entry.dataset.id;
    confirm().then(() => {
      delete prefs[key];
      entry.remove();
      chrome.storage.sync.remove(key);
    }).catch(() => {});
  }
});

// plus
document.getElementById('plus').addEventListener('click', () => {
  chrome.storage.local.get({
    width: 700,
    height: 500,
    left: screen.availLeft + Math.round((screen.availWidth - 700) / 2),
    top: screen.availTop + Math.round((screen.availHeight - 500) / 2)
  }, prefs => {
    chrome.windows.create({
      url: '/data/plus/index.html',
      width: prefs.width,
      height: prefs.height,
      left: prefs.left,
      top: prefs.top,
      type: 'popup'
    }, () => window.close());
  });
});
// refresh
document.getElementById('refresh').addEventListener('click', () => {
  location.reload();
});
