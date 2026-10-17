const accessForm = document.querySelector('#accessForm');
const accessGate = document.querySelector('#accessGate');
const accessPassword = document.querySelector('#accessPassword');
const accessError = document.querySelector('#accessError');
const accessKey = 'qz_pages_access_until';
const passwordHash = '7917b1d8a749c9e1e5f84dafa6321fb2a67f04f384b2f8377ccab52d97cb1576';

const unlock = () => {
  document.body.classList.remove('access-locked');
  accessGate.remove();
};

const sha256 = async value => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const accessUntil = Number(localStorage.getItem(accessKey) || 0);
if (accessUntil > Date.now()) unlock();

accessForm?.addEventListener('submit', async event => {
  event.preventDefault();
  accessError.textContent = '';
  if (await sha256(accessPassword.value) !== passwordHash) {
    accessError.textContent = '密码不正确，请重新输入。';
    accessPassword.select();
    return;
  }
  localStorage.setItem(accessKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  unlock();
});
