import axios from 'axios';

const isBeta = process.env.BETA === 'true';
const API_PREFIX = isBeta ? '/api/v2' : '/api/v1';

const apiUrl = process.env.API_URL || 'http://localhost:8000';
export const API_BASE_URL = `${apiUrl}${API_PREFIX}`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});
