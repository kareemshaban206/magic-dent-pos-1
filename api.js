const json = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(messageForStatus(res.status, data.error))
    err.status = res.status
    err.waitMs = data.waitMs || 0
    err.delay = data.delay || 0
    err.fails = data.fails || 0
    err.kind = kindForStatus(res.status)
    throw err
  }
  return data
}

function kindForStatus(status) {
  if (status === 404) return 'unavailable'
  if (status === 401 || status === 403) return 'permission'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 429) return 'throttled'
  return 'error'
}

function messageForStatus(status, fallback) {
  if (fallback) return fallback
  if (status === 404) return 'العنصر غير متاح'
  if (status === 401 || status === 403) return 'غير مسموح بهذا الإجراء'
  if (status === 408 || status === 504) return 'انتهت مهلة الخادم ولم يرد'
  if (status === 429) return 'محاولات كثيرة. انتظر قليلاً'
  if (status >= 500) return 'الخادم تعذر عليه حفظ البيانات'
  return 'تعذر إتمام العملية'
}

async function request(url, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    return await json(res)
  } catch (err) {
    if (err.status) throw err
    if (err.name === 'AbortError') {
      const e = new Error('انتهت مهلة الخادم ولم يرد')
      e.kind = 'timeout'
      e.status = 408
      throw e
    }
    const e = new Error('الخادم لم يرد')
    e.kind = 'unavailable'
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const post = (url, body) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  products: () => request('/api/products'),
  addProduct: (body) => post('/api/products', body),
  updateProduct: (id, body) =>
    request(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  resetSold: (id, decrement) => post(`/api/products/${id}/reset-sold`, { decrement }),
  staff: () => request('/api/staff'),
  addStaff: (body) => post('/api/staff', body),
  updateStaff: (id, body) =>
    request(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
  deleteStaff: (id) => request(`/api/staff/${id}`, { method: 'DELETE' }),
  setStaffPin: (id, pin) => post(`/api/staff/${id}/set-pin`, { pin }),
  createPin: (id, pin, confirm) => post(`/api/staff/${id}/pin`, { pin, confirm }),
  verifyPin: (id, pin) => post(`/api/staff/${id}/verify`, { pin }),
  changeCashierPin: (id, current, pin, confirm) =>
    post(`/api/staff/${id}/change-pin`, { current, pin, confirm }),
  verifyManager: (pin) => post('/api/manager/verify', { pin }),
  changeManagerPin: (current, pin, confirm) =>
    post('/api/manager/change-pin', { current, pin, confirm }),
  invoices: () => request('/api/invoices'),
  createInvoice: (body) => post('/api/invoices', body),
  resetInvoices: (body) => post('/api/invoices/reset', body)
}

export function connectLive(onEvent) {
  const es = new EventSource('/api/live')
  es.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data))
    } catch {
      /* ignore */
    }
  }
  return () => es.close()
}

export function writeError(err, fallback) {
  if (err?.kind === 'unavailable') return 'العنصر غير متاح'
  if (err?.kind === 'timeout') return 'انتهت مهلة الخادم ولم يرد'
  if (err?.kind === 'permission') return err.message || 'غير مسموح بهذا الإجراء'
  return err?.message || fallback || 'تعذر إتمام العملية'
}
