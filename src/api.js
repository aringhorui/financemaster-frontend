const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const TOKEN_KEY = 'fm_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE_URL + path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }

  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // plain-text response (e.g. "Category deleted successfully")
  }

  if (!res.ok) {
    // Spring Security answers 401/403 with an empty body when the JWT is missing or expired
    if (res.status === 401 || (res.status === 403 && !text)) {
      setToken(null)
      window.dispatchEvent(new Event('fm:logout'))
      throw new ApiError('Session expired. Please log in again.', res.status)
    }
    // Proxies and tunnels answer some failures with an HTML page; show a short message instead of it
    const html = typeof data === 'string' && /^\s*</.test(data)
    const unreachable = [502, 503, 504, 520, 521, 522, 523, 524, 530].includes(res.status)
    let message =
      (data && data.error) ||
      (html && unreachable && `Couldn't reach the server (HTTP ${res.status}). Check that the backend and tunnel are running, then try again.`) ||
      (typeof data === 'string' && !html && data.slice(0, 300)) ||
      `Request failed (HTTP ${res.status})`
    if (data && data.details) message += ': ' + Object.values(data.details).join(', ')
    throw new ApiError(message, res.status)
  }
  return data
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    signupInitiate: (body) => request('/auth/signup/initiate', { method: 'POST', body }),
    signupVerify: (email, otp) => request('/auth/signup/verify', { method: 'POST', body: { email, otp } }),
    signupResend: (email) => request('/auth/signup/resend', { method: 'POST', body: { email } }),
    me: () => request('/auth/me'),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    forgotVerify: (email, otp) =>
      request('/auth/forgot-password/verify-otp', { method: 'POST', body: { email, otp } }),
    resetPassword: (email, newPassword) =>
      request('/auth/forgot-password/reset', { method: 'POST', body: { email, newPassword } }),
  },
  categories: {
    list: () => request('/expense/category/get'),
    add: (categoryName, categoryBudget) =>
      request('/expense/category/add', { method: 'POST', body: { categoryName, categoryBudget } }),
    edit: (categoryId, categoryBudget) =>
      request('/expense/category/edit', { method: 'PUT', body: { categoryId, categoryBudget } }),
    remove: (categoryId) => request('/expense/category/delete', { method: 'DELETE', body: { categoryId } }),
  },
  subcategories: {
    list: () => request('/expense/subcategory/get'),
    add: (body) => request('/expense/subcategory/add', { method: 'POST', body }),
    edit: (body) => request('/expense/subcategory/edit', { method: 'PUT', body }),
    remove: (subcategoryId) =>
      request('/expense/subcategory/delete', { method: 'DELETE', body: { subcategoryId } }),
  },
  paymentMethods: {
    list: () => request('/expense/payment-methods/get'),
    add: (names) => request('/expense/payment-methods/add', { method: 'POST', body: { paymentMethodName: names } }),
    edit: (paymentMethodId, newPaymentMethodName) =>
      request('/expense/payment-methods/edit', { method: 'PUT', body: { paymentMethodId, newPaymentMethodName } }),
    remove: (paymentMethodId) =>
      request('/expense/payment-methods/delete', { method: 'DELETE', body: { paymentMethodId } }),
  },
  bankAccounts: {
    list: () => request('/expense/bank-account/get'),
    add: (body) => request('/expense/bank-account/add', { method: 'POST', body }),
    edit: (body) => request('/expense/bank-account/edit', { method: 'PUT', body }),
    remove: (bankAccountId) => request('/expense/bank-account/delete', { method: 'DELETE', body: { bankAccountId } }),
  },
  analytics: {
    summary: (from, to) => request('/expense/analytics/summary', { params: { from, to } }),
    trend: (to, months) => request('/expense/analytics/trend', { params: { to, months } }),
    patterns: (from, to) => request('/expense/analytics/patterns', { params: { from, to } }),
    cards: () => request('/expense/analytics/cards'),
    insights: (from, to) => request('/expense/analytics/insights', { params: { from, to } }),
    health: (month) => request('/expense/analytics/health', { params: { month } }),
    habits: (from, to) => request('/expense/analytics/habits', { params: { from, to } }),
    savings: (to, months) => request('/expense/analytics/savings', { params: { to, months } }),
  },
  chat: {
    status: () => request('/chat/status'),
    send: (messages) => request('/chat', { method: 'POST', body: { messages } }),
  },
  import: {
    run: (body, dryRun) => request('/expense/import', { method: 'POST', body, params: { dryRun } }),
  },
  income: {
    list: (from, to) => request('/income/get', { params: { from, to } }),
    add: (body) => request('/income/add', { method: 'POST', body }),
    edit: (body) => request('/income/edit', { method: 'PUT', body }),
    remove: (incomeId) => request('/income/delete', { method: 'DELETE', body: { incomeId } }),
  },
  expenses: {
    list: (params) => request('/expense/get', { params }),
    create: (body) => request('/expense/create', { method: 'POST', body }),
    edit: (body) => request('/expense/edit', { method: 'PUT', body }),
    remove: (transactionId) => request('/expense/delete', { method: 'DELETE', body: { transactionId } }),
    removeMany: (transactionIds) => request('/expense/delete-bulk', { method: 'DELETE', body: { transactionIds } }),
    removeMatching: (filter, expectedCount) => request('/expense/delete-matching', { method: 'DELETE', body: { filter, expectedCount } }),
  },
}
