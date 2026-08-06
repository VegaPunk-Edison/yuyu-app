import { createClient } from '@supabase/supabase-js';

// "Angemeldet bleiben": steuert, ob die Supabase-Session in localStorage (übersteht Browser-
// Neustart) oder nur sessionStorage (weg sobald der Tab/Browser geschlossen wird) landet. Der
// Storage-Adapter entscheidet das bei JEDEM Zugriff neu anhand der REMEMBER_KEY-Flag, statt fix
// beim Erstellen des Clients - so kann setRememberMe() das Verhalten vor jedem Login umschalten.
const REMEMBER_KEY = 'yuyu-remember-me';
const rememberMe = () => localStorage.getItem(REMEMBER_KEY) !== 'false';

export const setRememberMe = (remember) => {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
};

const sessionStorageAdapter = {
  getItem: (key) => (rememberMe() ? localStorage : sessionStorage).getItem(key),
  setItem: (key, value) => (rememberMe() ? localStorage : sessionStorage).setItem(key, value),
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const sb = createClient(
  'https://hxzfzxkezicietbsviyl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4emZ6eGtlemljaWV0YnN2aXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDE3NzEsImV4cCI6MjA5Mjc3Nzc3MX0.9GWM8tWRQ8NokWVn1FyRkCymoAFuqGzR0b65Az1y-wU',
  { auth: { storage: sessionStorageAdapter, persistSession: true, autoRefreshToken: true } }
);
