import express from 'express'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { store } from './store.js'
import { createServer as createViteServer } from 'vite'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '..')
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const server = http.createServer(app)
const sseClients = new Set()

app.use(express.json({ limit: '1mb' }))

const throttle = new Map()
const THROTTLE_WINDOW = 60_000
const THROTTLE_MAX = 8
const LOCKOUT_MS = 30_000

function throttleKey(kind, id, ip) {
  return `${kind}:${id}:${ip}`
}

function checkThrottle(key) {
  const now = Date.now()
  const rec = throttle.get(key) || { fails: 0, until: 0 }
  if (rec.until && now < rec.until) {
    return { ok: false, waitMs: rec.until - now, fails: rec.fails }
  }
  if (rec.until && now >= rec.until) {
    rec.fails = 0
    rec.until = 0
  }
  return { ok: true, rec }
}

function recordFail(key, rec) {
  rec.fails += 1
  if (rec.fails >= THROTTLE_MAX) {
    rec.until = Date.now() + LOCKOUT_MS * Math.min(rec.fails - THROTTLE_MAX + 1, 8)
  }
  throttle.set(key, rec)
  return rec
}

function recordSuccess(key) {
  throttle.delete(key)
}

function broadcast(event, payload) {
  const msg = `data: ${JSON.stringify({ event, payload })}\n\n`
  for (const res of sseClients) {
    try {
      res.write(msg)
    } catch {
      sseClients.delete(res)
    }
  }
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'local'
}

function isFourDigit(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin)
}

function publicStaff(db) {
  return db.staff.map((s) => ({ id: s.id, name: s.name, hasPin: s.hasPin }))
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write('retry: 2000\n\n')
  sseClients.add(res)
  req.on('close', () => {
    sseClients.delete(res)
  })
})

app.get('/api/bootstrap', (_req, res) => {
  const db = store.getDb()
  res.json({
    products: db.products,
    staff: publicStaff(db)
  })
})

app.get('/api/products', (_req, res) => {
  res.json(store.getDb().products)
})

function parsePrice(value) {
  const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' }
  const s = String(value ?? '').replace(/[٠-٩۰-۹]/g, (ch) => map[ch] || ch).replace(/,/g, '.').replace(/[^\d.]/g, '')
  const n = Number(s)
  return n
}

app.post('/api/products', (req, res) => {
  const { name, price, imageUrl } = req.body || {}
  const trimmed = typeof name === 'string' ? name.trim() : ''
  const num = parsePrice(price)
  if (!trimmed) return res.status(400).json({ error: 'الاسم مطلوب' })
  if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: 'السعر يجب أن يكون رقماً موجباً' })
  const product = {
    id: `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    price: Math.round(num * 100) / 100,
    imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '',
    soldCount: 0,
    isCustom: true
  }
  store.mutate((db) => {
    db.products.push(product)
  }).then(() => {
    broadcast('products', store.getDb().products)
    res.json(product)
  }).catch(() => {
    res.status(504).json({ error: 'انتهت مهلة الخادم ولم يرد. لم تُضف الصنف' })
  })
})

app.put('/api/products/:id', (req, res) => {
  const { name, price, imageUrl } = req.body || {}
  store.mutate((db) => {
    const p = db.products.find((x) => x.id === req.params.id)
    if (!p) return { error: 'الصنف غير موجود', status: 404 }
    if (typeof name === 'string') {
      const trimmed = name.trim()
      if (!trimmed) return { error: 'الاسم مطلوب', status: 400 }
      p.name = trimmed
    }
    if (price !== undefined) {
      const num = parsePrice(price)
      if (!Number.isFinite(num) || num <= 0) return { error: 'السعر يجب أن يكون رقماً موجباً', status: 400 }
      p.price = Math.round(num * 100) / 100
    }
    if (typeof imageUrl === 'string') p.imageUrl = imageUrl.trim()
    return { product: p }
  }).then((result) => {
    if (result?.error) return res.status(result.status).json({ error: result.error })
    broadcast('products', store.getDb().products)
    res.json(result.product)
  }).catch(() => {
    res.status(504).json({ error: 'انتهت مهلة الخادم ولم يرد. لم يُحفظ التعديل' })
  })
})

app.delete('/api/products/:id', (req, res) => {
  store.mutate((db) => {
    const idx = db.products.findIndex((x) => x.id === req.params.id)
    if (idx === -1) return { error: true }
    db.products.splice(idx, 1)
    return { ok: true }
  }).then((result) => {
    if (result?.error) return res.status(404).json({ error: 'الصنف غير متاح' })
    broadcast('products', store.getDb().products)
    res.json({ ok: true })
  }).catch(() => {
    res.status(504).json({ error: 'انتهت مهلة الخادم ولم يرد. لم يُحذف الصنف' })
  })
})

app.post('/api/products/:id/reset-sold', (req, res) => {
  const decrement = Number(req.body?.decrement)
  store.mutate((db) => {
    const p = db.products.find((x) => x.id === req.params.id)
    if (!p) return { error: true, status: 404 }
    const delta = Number.isFinite(decrement) && decrement > 0 ? decrement : p.soldCount
    p.soldCount = Math.max(0, p.soldCount - delta)
    return { product: { id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, soldCount: p.soldCount, isCustom: p.isCustom } }
  }).then((result) => {
    if (result?.error) return res.status(404).json({ error: 'الصنف غير متاح' })
    broadcast('products', store.getDb().products)
    res.json(result.product)
  }).catch(() => {
    res.status(504).json({ error: 'انتهت مهلة الخادم ولم يرد' })
  })
})

app.get('/api/staff', (_req, res) => {
  res.json(publicStaff(store.getDb()))
})

app.post('/api/staff', async (req, res) => {
  const { name, pin } = req.body || {}
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return res.status(400).json({ error: 'اسم الموظف مطلوب' })
  if (!isFourDigit(pin)) return res.status(400).json({ error: 'الرمز السري يجب أن يكون 4 أرقام' })
  const dbNow = store.getDb()
  if (dbNow.staff.some((s) => s.name === trimmed)) {
    return res.status(409).json({ error: 'يوجد موظف بهذا الاسم' })
  }
  const id = `staff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const hash = await bcrypt.hash(pin, 10)
  await store.mutate((db) => {
    db.staff.push({ id, name: trimmed, hasPin: true })
  })
  await store.mutatePins((pins) => {
    pins.cashiers[id] = hash
  })
  const staff = publicStaff(store.getDb())
  broadcast('staff', staff)
  res.json({ ok: true, staff })
})

app.put('/api/staff/:id', (req, res) => {
  const { name } = req.body || {}
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return res.status(400).json({ error: 'اسم الموظف مطلوب' })
  store.mutate((db) => {
    const s = db.staff.find((x) => x.id === req.params.id)
    if (!s) return { error: true, status: 404 }
    if (db.staff.some((x) => x.id !== s.id && x.name === trimmed)) {
      return { error: true, status: 409, message: 'يوجد موظف بهذا الاسم' }
    }
    s.name = trimmed
    return { ok: true }
  }).then((result) => {
    if (result?.error) {
      return res.status(result.status).json({ error: result.message || 'الموظف غير موجود' })
    }
    const staff = publicStaff(store.getDb())
    broadcast('staff', staff)
    res.json({ ok: true, staff })
  })
})

app.delete('/api/staff/:id', (req, res) => {
  store.mutate((db) => {
    const idx = db.staff.findIndex((x) => x.id === req.params.id)
    if (idx === -1) return { error: true }
    db.staff.splice(idx, 1)
    return { ok: true }
  }).then((result) => {
    if (result?.error) return res.status(404).json({ error: 'الموظف غير موجود' })
    store.mutatePins((pins) => {
      delete pins.cashiers[req.params.id]
    }).then(() => {
      const staff = publicStaff(store.getDb())
      broadcast('staff', staff)
      res.json({ ok: true, staff })
    })
  })
})

app.post('/api/staff/:id/set-pin', async (req, res) => {
  const { pin } = req.body || {}
  if (!isFourDigit(pin)) return res.status(400).json({ error: 'الرمز السري يجب أن يكون 4 أرقام' })
  const db = store.getDb()
  const staff = db.staff.find((s) => s.id === req.params.id)
  if (!staff) return res.status(404).json({ error: 'الموظف غير موجود' })
  const hash = await bcrypt.hash(pin, 10)
  await store.mutatePins((pins) => {
    pins.cashiers[req.params.id] = hash
  })
  await store.mutate((d) => {
    const s = d.staff.find((x) => x.id === req.params.id)
    if (s) s.hasPin = true
  })
  const list = publicStaff(store.getDb())
  broadcast('staff', list)
  res.json({ ok: true, staff: list })
})

app.post('/api/staff/:id/pin', async (req, res) => {
  const { pin, confirm } = req.body || {}
  const db = store.getDb()
  const staff = db.staff.find((s) => s.id === req.params.id)
  if (!staff) return res.status(404).json({ error: 'الكاشير غير موجود' })
  if (staff.hasPin) return res.status(409).json({ error: 'يوجد رقم سري بالفعل' })
  if (!isFourDigit(pin) || pin !== confirm) {
    return res.status(400).json({ error: 'الرقم السري غير متطابق أو غير صالح' })
  }
  const hash = await bcrypt.hash(pin, 10)
  await store.mutatePins((pins) => {
    pins.cashiers[req.params.id] = hash
  })
  await store.mutate((d) => {
    const s = d.staff.find((x) => x.id === req.params.id)
    if (s) s.hasPin = true
  })
  broadcast('staff', publicStaff(store.getDb()))
  res.json({ ok: true, staff: publicStaff(store.getDb()) })
})

app.post('/api/staff/:id/verify', async (req, res) => {
  const { pin } = req.body || {}
  const ip = clientIp(req)
  const key = throttleKey('cashier', req.params.id, ip)
  const t = checkThrottle(key)
  if (!t.ok) {
    return res.status(429).json({
      error: 'محاولات كثيرة. انتظر قليلاً',
      waitMs: t.waitMs
    })
  }
  if (!isFourDigit(pin)) return res.status(400).json({ error: 'أدخل 4 أرقام' })
  const db = store.getDb()
  const staff = db.staff.find((s) => s.id === req.params.id)
  if (!staff) return res.status(404).json({ error: 'الكاشير غير موجود' })
  const pins = store.getPins()
  const hash = pins.cashiers[req.params.id]
  if (!hash) return res.status(400).json({ error: 'لا يوجد رقم سري. أنشئ واحداً أولاً' })
  const match = await bcrypt.compare(pin, hash)
  if (!match) {
    const rec = recordFail(key, t.rec)
    const waitMs = rec.until ? rec.until - Date.now() : 0
    return res.status(401).json({
      error: 'الرقم السري غير صحيح',
      waitMs: waitMs > 0 ? waitMs : 0,
      fails: rec.fails
    })
  }
  recordSuccess(key)
  res.json({ ok: true, staff: { id: staff.id, name: staff.name } })
})

app.post('/api/staff/:id/change-pin', async (req, res) => {
  const { current, pin, confirm } = req.body || {}
  const ip = clientIp(req)
  const key = throttleKey('cashier-change', req.params.id, ip)
  const t = checkThrottle(key)
  if (!t.ok) return res.status(429).json({ error: 'محاولات كثيرة. انتظر قليلاً', waitMs: t.waitMs })
  if (!isFourDigit(current) || !isFourDigit(pin) || pin !== confirm) {
    return res.status(400).json({ error: 'بيانات الرقم السري غير صالحة' })
  }
  const pins = store.getPins()
  const hash = pins.cashiers[req.params.id]
  if (!hash) return res.status(400).json({ error: 'لا يوجد رقم سري' })
  const match = await bcrypt.compare(current, hash)
  if (!match) {
    const rec = recordFail(key, t.rec)
    return res.status(401).json({ error: 'الرقم السري الحالي غير صحيح', fails: rec.fails })
  }
  const next = await bcrypt.hash(pin, 10)
  await store.mutatePins((p) => {
    p.cashiers[req.params.id] = next
  })
  recordSuccess(key)
  res.json({ ok: true })
})

app.post('/api/manager/verify', async (req, res) => {
  const { pin } = req.body || {}
  const ip = clientIp(req)
  const key = throttleKey('manager', 'main', ip)
  const t = checkThrottle(key)
  if (!t.ok) return res.status(429).json({ error: 'محاولات كثيرة. انتظر قليلاً', waitMs: t.waitMs })
  if (!isFourDigit(pin)) return res.status(400).json({ error: 'أدخل 4 أرقام' })
  const pins = store.getPins()
  const match = await bcrypt.compare(pin, pins.managerHash)
  if (!match) {
    const rec = recordFail(key, t.rec)
    const waitMs = rec.until ? rec.until - Date.now() : 0
    const delay = Math.min(400 * rec.fails, 4000)
    return res.status(401).json({
      error: 'الرقم السري غير صحيح',
      waitMs,
      delay,
      fails: rec.fails
    })
  }
  recordSuccess(key)
  res.json({ ok: true })
})

app.post('/api/manager/change-pin', async (req, res) => {
  const { current, pin, confirm } = req.body || {}
  const ip = clientIp(req)
  const key = throttleKey('manager-change', 'main', ip)
  const t = checkThrottle(key)
  if (!t.ok) return res.status(429).json({ error: 'محاولات كثيرة. انتظر قليلاً', waitMs: t.waitMs })
  if (!isFourDigit(current) || !isFourDigit(pin) || pin !== confirm) {
    return res.status(400).json({ error: 'بيانات الرقم السري غير صالحة' })
  }
  const pins = store.getPins()
  const match = await bcrypt.compare(current, pins.managerHash)
  if (!match) {
    const rec = recordFail(key, t.rec)
    return res.status(401).json({ error: 'الرقم السري الحالي غير صحيح', fails: rec.fails })
  }
  const next = await bcrypt.hash(pin, 10)
  await store.mutatePins((p) => {
    p.managerHash = next
  })
  recordSuccess(key)
  res.json({ ok: true })
})

app.get('/api/invoices', (req, res) => {
  const db = store.getDb()
  const { from, to, cashierId } = req.query
  let list = db.invoices
  if (from) {
    const f = new Date(from).getTime()
    list = list.filter((inv) => new Date(inv.createdAt).getTime() >= f)
  }
  if (to) {
    const t = new Date(to).getTime()
    list = list.filter((inv) => new Date(inv.createdAt).getTime() <= t)
  }
  if (cashierId) list = list.filter((inv) => inv.cashierId === cashierId)
  res.json(list)
})

app.post('/api/invoices', (req, res) => {
  const { cashierId, cashierName, items, paymentMethod } = req.body || {}
  if (!cashierId || !cashierName) return res.status(400).json({ error: 'بيانات الكاشير مطلوبة' })
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'السلة فارغة' })
  if (paymentMethod !== 'cash' && paymentMethod !== 'visa') {
    return res.status(400).json({ error: 'طريقة الدفع غير صالحة' })
  }
  const lines = []
  for (const it of items) {
    const qty = Number(it.qty)
    const unitPrice = Number(it.unitPrice)
    const name = typeof it.name === 'string' ? it.name.trim() : ''
    if (!name || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ error: 'صنف غير صالح في السلة' })
    }
    lines.push({
      productId: typeof it.productId === 'string' ? it.productId : '',
      name,
      unitPrice: Math.round(unitPrice * 100) / 100,
      qty: Math.floor(qty)
    })
  }
  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100
  store.mutate((db) => {
    const invoice = {
      id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      number: db.nextInvoiceNumber,
      createdAt: new Date().toISOString(),
      cashierId,
      cashierName,
      items: lines,
      total,
      paymentMethod,
      deviceScope: 'clinic'
    }
    db.nextInvoiceNumber += 1
    db.invoices.push(invoice)
    for (const line of lines) {
      if (!line.productId) continue
      const p = db.products.find((x) => x.id === line.productId)
      if (p) p.soldCount += line.qty
    }
    return invoice
  }).then((invoice) => {
    if (!invoice) return res.status(500).json({ error: 'تعذر حفظ الفاتورة' })
    const db = store.getDb()
    broadcast('products', db.products)
    broadcast('invoices', { action: 'created', invoice })
    res.json(invoice)
  }).catch(() => {
    res.status(504).json({ error: 'انتهت مهلة الخادم ولم يرد. لم تُحفظ الفاتورة' })
  })
})

app.post('/api/invoices/reset', (req, res) => {
  const { from, to } = req.body || {}
  store.mutate((db) => {
    const before = db.invoices.length
    if (!from && !to) {
      db.invoices = []
      return { cleared: before, failed: 0 }
    }
    const f = from ? new Date(from).getTime() : -Infinity
    const t = to ? new Date(to).getTime() : Infinity
    const keep = []
    let cleared = 0
    for (const inv of db.invoices) {
      const ts = new Date(inv.createdAt).getTime()
      if (ts >= f && ts <= t) cleared += 1
      else keep.push(inv)
    }
    db.invoices = keep
    return { cleared, failed: 0 }
  }).then((result) => {
    broadcast('invoices', { action: 'reset', ...result })
    res.json(result)
  })
})

async function attachVite() {
  if (isProd) {
    app.use(express.static(path.join(root, 'dist')))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(root, 'dist', 'index.html'))
    })
    return
  }
  const vite = await createViteServer({
    configFile: path.join(root, 'client', 'vite.config.js'),
    server: { middlewareMode: true, hmr: { server }, allowedHosts: ['.monkeycode-ai.live'] }
  })
  app.use(vite.middlewares)
}

const PORT = Number(process.env.PORT || 5173)

attachVite().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`dental-pos listening on ${PORT}`)
  })
})
