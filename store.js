import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(dir, 'data')
const dbPath = path.join(dataDir, 'db.json')
const pinsPath = path.join(dataDir, 'pins.json')

const SEED_STAFF = [
  { id: 'staff-ahmed', name: 'أحمد علي' },
  { id: 'staff-fatima', name: 'فاطمة حسن' },
  { id: 'staff-mohamed', name: 'محمد إبراهيم' },
  { id: 'staff-sara', name: 'سارة محمود' }
]

const SEED_PRODUCTS = [
  { name: 'كشف طبي', price: 150 },
  { name: 'كشف متابعة', price: 100 },
  { name: 'تنظيف أسنان', price: 250 },
  { name: 'حشو عادي', price: 300 },
  { name: 'حشو تجميلي', price: 500 },
  { name: 'علاج عصب', price: 800 },
  { name: 'خلع سن', price: 200 },
  { name: 'خلع جراحي', price: 450 },
  { name: 'تركيب تاج', price: 1500 },
  { name: 'تقويم أسنان — قسط', price: 2000 },
  { name: 'تبييض أسنان', price: 1200 },
  { name: 'أشعة بانوراما', price: 180 },
  { name: 'أشعة صغيرة', price: 80 },
  { name: 'حماية أسنان أطفال', price: 220 },
  { name: 'زراعة سن', price: 5000 },
  { name: 'تركيب طقم أسنان', price: 3500 },
  { name: 'علاج لثة', price: 400 },
  { name: 'خلع ضرس عقل', price: 600 }
]

function emptyDb() {
  return {
    products: SEED_PRODUCTS.map((p, i) => ({
      id: `prod-${String(i + 1).padStart(3, '0')}`,
      name: p.name,
      price: p.price,
      imageUrl: '',
      soldCount: 0,
      isCustom: false
    })),
    invoices: [],
    staff: SEED_STAFF.map((s) => ({ ...s, hasPin: false })),
    nextInvoiceNumber: 1
  }
}

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(emptyDb(), null, 2))
  if (!fs.existsSync(pinsPath)) {
    const managerHash = bcrypt.hashSync('1234', 10)
    fs.writeFileSync(
      pinsPath,
      JSON.stringify({ managerHash, cashiers: {} }, null, 2)
    )
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

let writeChain = Promise.resolve()

function mutate(fn) {
  writeChain = writeChain.then(() => {
    const db = readJson(dbPath)
    const result = fn(db)
    writeJson(dbPath, db)
    return result
  })
  return writeChain
}

function mutatePins(fn) {
  writeChain = writeChain.then(() => {
    const pins = readJson(pinsPath)
    const result = fn(pins)
    writeJson(pinsPath, pins)
    return result
  })
  return writeChain
}

ensureFiles()

export const store = {
  getDb() {
    return readJson(dbPath)
  },
  getPins() {
    return readJson(pinsPath)
  },
  mutate,
  mutatePins
}
