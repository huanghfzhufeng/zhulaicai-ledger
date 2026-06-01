import { api, ApiError } from './api.js';

const form = document.getElementById('authForm');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const msgEl = document.getElementById('msg');

// If a valid session already exists, skip straight to the app.
api.auth
  .me()
  .then(() => location.replace('/'))
  .catch(() => {});

function showMsg(text, kind = 'err') {
  msgEl.textContent = text;
  msgEl.className = text ? `msg ${kind}` : 'msg';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username) return showMsg('请输入账号');
  if (!password) return showMsg('请输入密码');

  submitBtn.disabled = true;
  showMsg('');
  try {
    await api.auth.login(username, password);
    showMsg('登录成功，正在进入…', 'ok');
    location.replace('/');
  } catch (err) {
    showMsg(err instanceof ApiError ? err.message : '出错了，请重试');
    submitBtn.disabled = false;
  }
});
