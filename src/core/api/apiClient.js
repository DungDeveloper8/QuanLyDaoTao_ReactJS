import axios from 'axios';
import { API_URL } from '../../app/config.js';

const TOKEN_KEY = 'training_auth_token';
const USER_KEY = 'training_auth_user';

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const TRAINING_RESOURCES = [
  'users',
  'faculties',
  'majors',
  'cohorts',
  'classes',
  'semesters',
  'lecturers',
  'students',
  'subjects',
  'curricula',
  'courseSections',
  'registrations',
  'attendanceSessions',
  'attendanceRecords',
  'scores',
  'announcements',
];

function readToken() {
  return typeof window === 'undefined' ? '' : localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthSession({ token, user }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  if (typeof window === 'undefined' || !localStorage.getItem(TOKEN_KEY)) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function getServerMessage(error) {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  return '';
}

function normalizeApiError(error) {
  if (error?.code === 'ECONNABORTED') {
    error.message = 'API phản hồi quá thời gian. Hãy kiểm tra tiến trình máy chủ.';
    return error;
  }

  if (!error?.response) {
    error.message = 'Không kết nối được API. Hãy kiểm tra tiến trình máy chủ.';
    return error;
  }

  const serverMessage = getServerMessage(error);
  if (serverMessage) {
    error.message = serverMessage;
  } else {
    const status = error.response.status;
    if (status >= 500) error.message = `API đang gặp lỗi (${status}).`;
    else if (status === 404) error.message = 'Không tìm thấy dữ liệu hoặc API được yêu cầu.';
    else if (status === 403) error.message = 'Bạn không có quyền thực hiện thao tác này.';
    else if (status === 401) error.message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
    else error.message = `Yêu cầu API thất bại (${status}).`;
  }

  return error;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeApiError(error);
    if (normalized?.response?.status === 401 && typeof window !== 'undefined') {
      clearAuthSession();
      window.dispatchEvent(new Event('training-auth-expired'));
    }
    return Promise.reject(normalized);
  },
);

export function loginRequest(username, password) {
  return api.post('/auth/login', { username, password });
}

export function currentUserRequest() {
  return api.get('/auth/me');
}

export function getPublicData() {
  return api.get('/public-info').then((response) => response.data);
}

export function list(resource, params) {
  return api.get(`/${resource}`, { params });
}

export function getOne(resource, id) {
  return api.get(`/${resource}/${id}`);
}

export function createOne(resource, data) {
  return api.post(`/${resource}`, data);
}

export function updateOne(resource, id, data) {
  return api.put(`/${resource}/${id}`, data);
}

export function patchOne(resource, id, data) {
  return api.patch(`/${resource}/${id}`, data);
}

export function removeOne(resource, id) {
  return api.delete(`/${resource}/${id}`);
}

export async function getAllData() {
  const response = await api.get('/snapshot');
  const snapshot = response.data || {};

  return Object.fromEntries(
    TRAINING_RESOURCES.map((resource) => [
      resource,
      Array.isArray(snapshot[resource]) ? snapshot[resource] : [],
    ]),
  );
}

export default api;
