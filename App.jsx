import { useEffect, useMemo, useState } from 'react'
import { api, connectLive, writeError } from './api.js'
import { LETTERS, formatMoney, matchesLetter, matchesSearch } from './utils.js'
import ShiftGate from './components/ShiftGate.jsx'
import Cart from './components/Cart.jsx'
import CatalogSheet from './components/CatalogSheet.jsx'
import InvoiceView from './components/InvoiceView.jsx'
import CashierPanel from './components/CashierPanel.jsx'
import SalesLog from './components/SalesLog.jsx'
import ProductImage from './components/ProductImage.jsx'
import Logo from './components/Logo.jsx'

const SHIFT_KEY = 'dental-pos-shift'
const THEME_KEY = 'dental-pos-theme'

function loadShift() {
  try {
    const raw = localStorage.getItem(SHIFT_KEY)
    if (!raw) return { cashier: null, unlocked: false }
    const parsed = JSON.parse(raw)
    return { cashier: parsed.cashier || null, unlocked: false }
  } catch {
    return { cashier: null, unlocked: false }
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  const initial = loadShift()
  const [theme, setTheme] = useState(loadTheme)
  const [staff, setStaff] = useState([])
  const [products, setProducts] = useState([])
  const [cashier, setCashier] = useState(initial.cashier)
  const [unlocked, setUnlocked] = useState(false)
  const [search, setSearch] = useState('')
  const [letter, setLetter] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('cash')
  const [invoice, setInvoice] = useState(null)
  const [sheet, setSheet] = useState(false)
  const [panel, setPanel] = useState(false)
  const [log, setLog] = useState(false)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('shop')
  const [nav, setNav] = useState('pos')
  const [wide, setWide] = useState(() => window.innerWidth >= 1100)
  const [boot, setBoot] = useState('loading')
  const [bootErr, setBootErr] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    document.documentElement.style.background = theme === 'light' ? '#e8edf5' : '#0f172a'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'light' ? '#e8edf5' : '#0f172a')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let alive = true
    api.bootstrap()
      .then((data) => {
        if (!alive) return
        setProducts(data.products || [])
        setStaff(data.staff || [])
        setBoot('ready')
      })
      .catch((err) => {
        if (!alive) return
        setBoot('error')
        setBootErr(writeError(err, 'تعذر تحميل الكتالوج من الخادم'))
      })
    const stop = connectLive((msg) => {
      if (msg.event === 'products') setProducts(msg.payload || [])
      if (msg.event === 'staff') setStaff(msg.payload || [])
    })
    return () => {
      alive = false
      stop()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      SHIFT_KEY,
      JSON.stringify({ cashier, unlocked: false })
    )
  }, [cashier])

  function showToast(text) {
    setToast(text)
    setTimeout(() => setToast(''), 3200)
  }

  function unlock(person) {
    setCashier(person)
    setUnlocked(true)
    setNav('pos')
    setLog(false)
    setPanel(false)
  }

  function lockNow() {
    setUnlocked(false)
    setCart([])
    setInvoice(null)
    setPanel(false)
    setSheet(false)
    setLog(false)
    setSearch('')
    setLetter('')
  }

  const visible = useMemo(() => {
    return products.filter((p) => matchesLetter(p.name, letter) && matchesSearch(p.name, search))
  }, [products, letter, search])

  function onSearch(v) {
    setSearch(v)
    setLetter('')
  }

  function onLetter(ch) {
    if (letter === ch) {
      setLetter('')
      setSearch('')
      return
    }
    setLetter(ch)
    setSearch(ch)
  }

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((x) => x.productId === p.id)
      if (found) return prev.map((x) => (x.productId === p.id ? { ...x, qty: x.qty + 1 } : x))
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.price, qty: 1 }]
    })
  }

  function inc(id) {
    setCart((prev) => prev.map((x) => (x.productId === id ? { ...x, qty: x.qty + 1 } : x)))
  }
  function dec(id) {
    setCart((prev) =>
      prev
        .map((x) => (x.productId === id ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    )
  }
  function removeLine(id) {
    setCart((prev) => prev.filter((x) => x.productId !== id))
  }

  function addQuick({ name, unitPrice }) {
    setCart((prev) => {
      const found = prev.find((x) => x.custom && x.name === name && x.unitPrice === unitPrice)
      if (found) return prev.map((x) => (x.productId === found.productId ? { ...x, qty: x.qty + 1 } : x))
      return [
        ...prev,
        {
          productId: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          unitPrice,
          qty: 1,
          custom: true
        }
      ]
    })
  }

  async function checkout() {
    if (!cashier || !cart.length) return
    setBusy(true)
    try {
      const items = cart.map((it) => ({
        productId: it.productId,
        name: it.name,
        unitPrice: it.unitPrice,
        qty: it.qty
      }))
      const inv = await api.createInvoice({
        cashierId: cashier.id,
        cashierName: cashier.name,
        items,
        paymentMethod: payment
      })
      if (!inv?.id) {
        showToast('تعذر حفظ الفاتورة. لم تُسجَّل عملية البيع')
        return
      }
      setInvoice(inv)
      setCart([])
      setNav('invoice')
    } catch (err) {
      showToast(writeError(err, 'تعذر حفظ الفاتورة. لم تُسجَّل عملية البيع'))
    } finally {
      setBusy(false)
    }
  }

  const gated = !cashier || !unlocked

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Logo size={40} />
          <div className="brand-text">
            <strong>Magic Dent POS</strong>
            <span>نقطة البيع · EGP</span>
          </div>
        </div>
        {!gated ? (
          <button className="chip" onClick={() => setPanel(true)}>
            {cashier.name}
          </button>
        ) : null}
        <button className="hdr-btn" onClick={() => setSheet(true)} title="إدارة الأصناف متاحة لأي حامل للجهاز">
          إدارة الأصناف
        </button>
        <button
          className="icon-btn"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label="تبديل المظهر"
        >
          {theme === 'dark' ? 'نهاري' : 'ليلي'}
        </button>
        <button
          className="hdr-btn"
          onClick={() => {
            if (gated) {
              showToast('افتح الوردية أولاً. سجل المبيعات يُفتح برقم المدير فقط.')
              return
            }
            setLog(true)
            setNav('log')
          }}
        >
          سجل المبيعات
          <span className="lock-dot" />
        </button>
      </header>

      {boot === 'loading' ? (
        <div className="screen">
          <div className="gate"><p className="lead">جاري التحميل...</p></div>
        </div>
      ) : boot === 'error' ? (
        <div className="screen">
          <div className="gate">
            <p className="lead">{bootErr}</p>
            <button
              className="btn"
              onClick={() => {
                setBoot('loading')
                api.bootstrap()
                  .then((data) => {
                    setProducts(data.products || [])
                    setStaff(data.staff || [])
                    setBoot('ready')
                  })
                  .catch((err) => {
                    setBoot('error')
                    setBootErr(writeError(err, 'تعذر تحميل الكتالوج من الخادم'))
                  })
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      ) : gated ? (
        <div className="screen">
          <ShiftGate
            staff={staff}
            onUnlock={unlock}
            onStaffChange={(next) => {
              if (Array.isArray(next)) setStaff(next)
              else api.staff().then(setStaff).catch((err) => showToast(writeError(err)))
            }}
            toast={showToast}
          />
        </div>
      ) : log || nav === 'log' ? (
        <SalesLog
          onClose={() => {
            setLog(false)
            setNav('pos')
          }}
          toast={showToast}
        />
      ) : invoice || nav === 'invoice' ? (
        <div className="screen">
          <InvoiceView
            invoice={invoice}
            onBack={() => {
              setInvoice(null)
              setNav('pos')
            }}
          />
        </div>
      ) : (
        <div className={`layout ${wide ? 'wide' : ''}`} style={{ flex: 1, minHeight: 0, display: wide ? 'grid' : 'flex', gridTemplateColumns: wide ? '220px 1fr' : undefined, flexDirection: 'column' }}>
          {wide ? (
            <nav className="sidenav">
              <button className={nav === 'pos' ? 'on' : ''} onClick={() => setNav('pos')}>
                الصندوق
              </button>
              <button className={nav === 'log' ? 'on' : ''} onClick={() => { setLog(true); setNav('log') }}>
                سجل المبيعات
              </button>
              <button onClick={() => setSheet(true)}>الأصناف</button>
            </nav>
          ) : null}
          <div className={`pos tab-${tab}`} style={{ flex: 1, minHeight: 0 }}>
            <div className="pos-main">
              <div className="notice">
                إدارة الأصناف من الرأس غير محمية برقم سري — أي شخص يحمل الجهاز يستطيع التعديل. هذا مقابل سرعة العمل على الصندوق.
              </div>
              <div className="tools">
                <input
                  className="search"
                  placeholder="بحث عن صنف..."
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                />
                <div className="alpha">
                  <button className={!letter ? 'on' : ''} onClick={() => { setLetter(''); setSearch('') }}>
                    الكل
                  </button>
                  {LETTERS.map((ch) => (
                    <button key={ch} className={letter === ch ? 'on' : ''} onClick={() => onLetter(ch)}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid">
                {visible.length === 0 ? (
                  <div className="cart-empty" style={{ gridColumn: '1 / -1' }}>
                    {products.length === 0
                      ? 'لا أصناف في الكتالوج'
                      : letter
                        ? 'لا أصناف لهذا الحرف'
                        : search
                          ? 'لا نتائج لهذا البحث'
                          : 'لا أصناف'}
                  </div>
                ) : null}
                {visible.map((p, i) => (
                  <button
                    key={p.id}
                    className="pcard"
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    onClick={() => addToCart(p)}
                  >
                    <ProductImage className="img" src={p.imageUrl} alt={p.name} />
                    <div className="body">
                      <h3>{p.name}</h3>
                      <div className="price">{formatMoney(p.price)}</div>
                      <div className="meta">مباع {p.soldCount}</div>
                      {p.isCustom ? <span className="badge">مضاف</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Cart
              items={cart}
              onInc={inc}
              onDec={dec}
              onRemove={removeLine}
              payment={payment}
              onPayment={setPayment}
              onCheckout={checkout}
              onQuickAdd={addQuick}
              busy={busy}
            />
          </div>
          <div className="tabs">
            <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>
              الأصناف
            </button>
            <button className={tab === 'cart' ? 'on' : ''} onClick={() => setTab('cart')}>
              السلة ({cart.reduce((s, x) => s + x.qty, 0)})
            </button>
          </div>
        </div>
      )}

      {sheet ? <CatalogSheet products={products} onClose={() => setSheet(false)} toast={showToast} /> : null}
      {panel && cashier ? (
        <CashierPanel
          cashier={cashier}
          onClose={() => setPanel(false)}
          onSwitch={lockNow}
          onLock={lockNow}
          toast={showToast}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
