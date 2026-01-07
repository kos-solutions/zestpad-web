// src/api/client.ts
import axios from 'axios';

// ⚠️ SCHIMBĂ AICI dacă vrei să te legi la Railway
const API_URL = 'https://zestpad-backend-production.up.railway.app'; 

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Dacă avem token, îl atașăm automat la cereri
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('zest_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});