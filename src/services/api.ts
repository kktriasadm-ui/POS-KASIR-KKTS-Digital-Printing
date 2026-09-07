const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('kkts_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('kkts_token');
      localStorage.removeItem('kkts_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error(data.error || 'Terjadi kesalahan pada sistem.');
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    login: (body: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request('/auth/me'),
    changePassword: (body: any) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) })
  },

  // Dashboard
  dashboard: {
    get: () => request('/dashboard')
  },

  // POS
  pos: {
    getCatalog: () => request('/pos/catalog'),
    calculate: (body: any) => request('/pos/calculate', { method: 'POST', body: JSON.stringify(body) }),
    checkStock: (body: any) => request('/pos/check-stock', { method: 'POST', body: JSON.stringify(body) }),
    checkout: (body: any) => request('/pos/checkout', { method: 'POST', body: JSON.stringify(body) })
  },

  // Transactions
  transactions: {
    list: (params?: Record<string, any>) => {
      const q = new URLSearchParams(params).toString();
      return request(`/transactions${q ? '?' + q : ''}`);
    },
    get: (id: string) => request(`/transactions/${id}`),
    void: (id: string, reason: string) => request(`/transactions/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    reprintPayment: (id: string) => request(`/transactions/${id}/reprint-payment`, { method: 'POST' }),
    reprintProduction: (id: string) => request(`/transactions/${id}/reprint-production`, { method: 'POST' })
  },

  // Production
  production: {
    getJobs: (params?: Record<string, any>) => {
      const q = new URLSearchParams(params).toString();
      return request(`/production/jobs${q ? '?' + q : ''}`);
    },
    updateStatus: (id: string, newStatus: string, notes?: string) =>
      request(`/production/jobs/${id}/status`, { method: 'POST', body: JSON.stringify({ newStatus, notes }) }),
    updateNotes: (id: string, notes: string) =>
      request(`/production/jobs/${id}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),
    getReceipt: (id: string) => request(`/production/jobs/${id}/receipt`, { method: 'POST' })
  },

  // Products
  products: {
    list: () => request('/products'),
    create: (body: any) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    archive: (id: string) => request(`/products/${id}`, { method: 'DELETE' })
  },

  // Materials & Stock
  materials: {
    list: () => request('/materials'),
    create: (body: any) => request('/materials', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    archive: (id: string) => request(`/materials/${id}`, { method: 'DELETE' }),
    stockIn: (body: any) => request('/materials/stock-in', { method: 'POST', body: JSON.stringify(body) }),
    stockAdjust: (body: any) => request('/materials/stock-adjust', { method: 'POST', body: JSON.stringify(body) }),
    movements: (params?: Record<string, any>) => {
      const q = new URLSearchParams(params).toString();
      return request(`/materials/movements${q ? '?' + q : ''}`);
    }
  },

  // Customers
  customers: {
    list: (search?: string) => request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    create: (body: any) => request('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    archive: (id: string) => request(`/customers/${id}`, { method: 'DELETE' })
  },

  // Users
  users: {
    list: () => request('/users'),
    create: (body: any) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    resetPassword: (id: string, newPassword: string) =>
      request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    toggleStatus: (id: string) => request(`/users/${id}/toggle-status`, { method: 'POST' })
  },

  // Reports
  reports: {
    daily: (date?: string) => request(`/reports/daily${date ? `?date=${date}` : ''}`),
    monthly: (year?: number, month?: number) =>
      request(`/reports/monthly?year=${year || ''}&month=${month || ''}`),
    custom: (startDate: string, endDate: string) =>
      request(`/reports/custom?startDate=${startDate}&endDate=${endDate}`),
    profit: (startDate?: string, endDate?: string) =>
      request(`/reports/profit?startDate=${startDate || ''}&endDate=${endDate || ''}`),
    stock: () => request('/reports/stock')
  },

  // Printer
  printer: {
    test: () => request('/printer/test', { method: 'POST' }),
    getSettings: () => request('/printer/settings'),
    updateSettings: (body: any) => request('/printer/settings', { method: 'PUT', body: JSON.stringify(body) })
  },

  // Backup & Restore
  backup: {
    create: () => request('/backup/create', { method: 'POST' }),
    list: () => request('/backup/list'),
    restore: (filename: string) => request('/backup/restore', { method: 'POST', body: JSON.stringify({ filename }) }),
    downloadUrl: (filename: string) => `/api/backup/download/${filename}`
  },

  // Settings
  settings: {
    get: () => request('/settings'),
    update: (body: any) => request('/settings', { method: 'PUT', body: JSON.stringify(body) })
  },

  // Audit
  audit: {
    list: (limit?: number) => request(`/audit${limit ? `?limit=${limit}` : ''}`)
  }
};
