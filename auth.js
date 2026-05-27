import { getSession, signIn, signOut } from './supabase.js';

const AUTH_KEY = 'auth';

export async function isAuthenticated() {
  const session = await getSession();
  const authenticated = Boolean(session);
  localStorage.setItem(AUTH_KEY, authenticated ? 'true' : 'false');
  return authenticated;
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    window.location.replace('login.html');
    return false;
  }

  document.documentElement.classList.add('authenticated');
  return true;
}

export async function login(username, password) {
  const { error } = await signIn(username, password);
  if (error) return { ok: false, message: 'Usuario ou senha invalidos.' };
  localStorage.setItem(AUTH_KEY, 'true');
  return { ok: true };
}

export async function logout() {
  await signOut();
  localStorage.removeItem(AUTH_KEY);
  window.location.replace('login.html');
}

export async function redirectIfAuthenticated() {
  if (await isAuthenticated()) {
    window.location.replace('index.html');
  }
}
