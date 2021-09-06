/* globals jsQR, secure */
'use strict';

document.getElementById('qr').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.acceptCharset = 'utf-8';
  input.onchange = () => {
    console.log(input.files);
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    const reader = new FileReader();
    const img = new Image();
    // Read in the image file as a data URL.
    reader.onload = e => {
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        context.drawImage(img, 0, 0);
        const code = jsQR(context.getImageData(0, 0, img.width, img.height).data, img.width, img.height);
        if (code) {
          const [pre, post] = code.data.split('?');
          document.getElementById('name').value = decodeURIComponent(pre.replace('otpauth://totp/', ''));
          const args = new URLSearchParams(post);
          es.secret.value = args.get('secret');
          es.enSecret.value = '';
          document.getElementById('digits').value = args.get('digits') || 6;
          document.getElementById('period').value = args.get('period') || 30;
          const data = code.data.toLowerCase();
          const option = [...document.querySelectorAll('#icon option')]
            .filter(o => {
              const keywords = o.getAttribute('keywords');
              if (data.indexOf(o.value) !== -1) {
                return true;
              }
              else if (keywords) {
                for (const w of keywords.split('|')) {
                  if (data.indexOf(w) !== -1) {
                    return true;
                  }
                }
              }
            }).pop();
          if (option) {
            option.selected = true;
          }
        }
        else {
          alert('Cannot decode this QR code. Enter all fields manually.');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  };
  input.initialValue = input.value;
  document.body.appendChild(input);
  input.click();
});

const es = {
  secret: document.getElementById('secret'),
  enSecret: document.getElementById('en_secret'),
  password: document.getElementById('password')
};

document.addEventListener('submit', async e => {
  e.preventDefault();
  if (es.enSecret.value === '' && es.secret.value === '') {
    return alert('Secret or Encrypted secret is required');
  }
  await secure.unlock(es.password.value);
  let secret;
  if (es.secret.value) {
    secret = await secure.encrypt(es.secret.value);
  }
  else {
    const code = await secure.decrypt(es.enSecret.value);
    const args = new URLSearchParams(code.split('?').pop());
    secret = await secure.encrypt(args.get('secret'));
  }
  chrome.storage.sync.set({
    ['entry-' + document.getElementById('name').value]: {
      secret,
      period: Number(document.getElementById('period').value || 30),
      digits: Number(document.getElementById('digits').value || 6),
      icon: document.getElementById('icon').value
    }
  }, () => {
    alert('a new secured credential is added to the database');
    window.close();
  });
});

// validation
es.secret.addEventListener('input', e => {
  if (es.enSecret.value !== '' && e.target.value) {
    e.target.setCustomValidity('Only one of (secret & password) or (encrypted secret) should have value');
  }
  else if (es.enSecret.value === '' && e.target.value === '') {
    e.target.setCustomValidity('Secret or Encrypted secret is required');
  }
  else {
    e.target.setCustomValidity('');
  }
});
es.enSecret.addEventListener('input', e => {
  if (es.secret.value !== '' && e.target.value) {
    e.target.setCustomValidity('Only one of secret or encrypted secret should have value');
  }
  else {
    e.target.setCustomValidity('');
  }
});
