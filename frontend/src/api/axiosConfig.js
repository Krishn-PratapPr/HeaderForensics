import axios from 'axios';

// API base URL defaults to http://localhost:5000 in local dev,
// or can be overridden via Vite environment variables.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15s timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

export default axiosInstance;
