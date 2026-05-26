const AUTH_KEY = 'auth';
const USER = 'admin';
const PASSWORD = 'deoliveira123';

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace('login.html');
    return false;
  }

  document.documentElement.classList.add('authenticated');
  return true;
}

export function login(username, password) {
  const isValid = username === USER && password === PASSWORD;
  if (isValid) {
    localStorage.setItem(AUTH_KEY, 'true');
  }

  return isValid;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.replace('login.html');
}

export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.replace('index.html');
  }
}
