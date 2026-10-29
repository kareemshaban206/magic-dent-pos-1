import { useEffect, useMemo, useState } from 'react'
import PinPad from './PinPad.jsx'
import InvoiceView from './InvoiceView.jsx'
import { api, connectLive, writeError } from '../api.js'
import {
  dateInputValue,
  endOfDay,
  formatMoney,
  formatNumber,
  formatTime,
  normalizeDigits,
  rangeForPreset,
  startOfDay
} from '../utils.js'

const PRESETS = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: '7d', label: 'آخر 7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'كل الفترات' }
]

const PAY = { cash: 'نقدي', visa: 'فيزا' }

export default function SalesLog({ onClose, toast }) {
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [preset, setPreset] = useState('today')
  const [from, setFrom] = useState(rangeForPreset('today').from)
  const [to, setTo] = useState(rangeForPreset('today').to)
  const [cashierId, setCashierId] = useState(null)
  const [reprint, setReprint] = useState(null)
  const [askReset, setAskReset] = useState(false)
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loadState, setLoadState] = useState('idle')

  async function unlock(value) {
    setBusy(true)
    setError('')
    try {
      await api.verifyManager(value)
      setUnlocked(true)
      load()
    } catch (err) {
      setShake(true)
      setTimeout(() => setShake(false), 420)
      setError(writeError(err, 'الرقم السري غير صحيح'))
      const wait = err.delay || err.waitMs || 0
      if (wait) {
        setError(`محاولات كثيرة. انتظر ${Math.ceil(wait / 1000)} ثوان`)
        await new Promise((r) => setTimeout(r, wait))
      }
    } finally {
      setBusy(false)
    }
  }

  async function load() {
    setLoadState('loading')
    try {
      const list = await api.invoices()
      setInvoices(list)
      setLoadState('ready')
    } catch (err) {
      setLoadState('error')
      toast(writeError(err, 'تعذر تحميل سجل المبيعات'))
    }
  }

  useEffect(() => {
    if (unlocked) load()
    if (!unlocked) return undefined
    return connectLive((msg) => {
      if (msg.event === 'invoices') load()
    })
  }, [unlocked])

  function applyPreset(id) {
    setPreset(id)
    const r = rangeForPreset(id)
    setFrom(r.from)
    setTo(r.to)
    setCashierId(null)
  }

  function onFrom(v) {
    setPreset('custom')
    setFrom(v ? startOfDay(v).toISOString() : null)
  }
  function onTo(v) {
    setPreset('custom')
    setTo(v ? endOfDay(v).toISOString() : null)
  }

  const filtered = useMemo(() => {
    const f = from ? new Date(from).getTime() : -Infinity
    const t = to ? new Date(to).getTime() : Infinity
    return invoices.filter((inv) => {
      const ts = new Date(inv.createdAt).getTime()
      if (ts < f || ts > t) return false
      if (cashierId && inv.cashierId !== cashierId) return false
      return true
    })
  }, [invoices, from, to, cashierId])

  const kpis = useMemo(() => {
    let revenue = 0
    let cash = 0
    let visa = 0
    let units = 0
    for (const inv of filtered) {
      revenue += inv.total
      if (inv.paymentMethod === 'cash') cash += inv.total
      else visa += inv.total
      units += inv.items.reduce((s, it) => s + it.qty, 0)
    }
    const all = invoices.reduce((s, inv) => s + inv.total, 0)
    return { revenue, cash, visa, units, count: filtered.length, all }
  }, [filtered, invoices])

  const cashiers = useMemo(() => {
    const map = new Map()
    const f = from ? new Date(from).getTime() : -Infinity
    const t = to ? new Date(to).getTime() : Infinity
    for (const inv of invoices) {
      const ts = new Date(inv.createdAt).getTime()
      if (ts < f || ts > t) continue
      const rec = map.get(inv.cashierId) || {
        id: inv.cashierId,
        name: inv.cashierName,
        total: 0,
        cash: 0,
        visa: 0,
        invoices: 0,
        units: 0
      }
      rec.total += inv.total
      rec.invoices += 1
      rec.units += inv.items.reduce((s, it) => s + it.qty, 0)
      if (inv.paymentMethod === 'cash') rec.cash += inv.total
      else rec.visa += inv.total
      map.set(inv.cashierId, rec)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [invoices, from, to])

  const products = useMemo(() => {
    const map = new Map()
    for (const inv of filtered) {
      for (const it of inv.items) {
        const rec = map.get(it.name) || { name: it.name, units: 0, revenue: 0 }
        rec.units += it.qty
        rec.revenue += it.qty * it.unitPrice
        map.set(it.name, rec)
      }
    }
    const list = [...map.values()].sort((a, b) => b.units - a.units)
    const max = list[0]?.units || 1
    return { list, max, top: list.slice(0, 8) }
  }, [filtered])

  async function changePin(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (!/^\d{4}$/.test(pin) || pin !== confirm) {
        toast('الرقم الجديد يجب أن يكون 4 أرقام ومتطابقاً')
        setBusy(false)
        return
      }
      await api.changeManagerPin(current, pin, confirm)
      toast('تم تغيير رقم المدير. سيُطلب الرقم الجديد عند كل فتح تالٍ على كل الأجهزة')
      setCurrent('')
      setPin('')
      setConfirm('')
    } catch (err) {
      toast(writeError(err, 'تعذر تغيير رقم المدير'))
    } finally {
      setBusy(false)
    }
  }

  async function resetLog() {
    setBusy(true)
    try {
      const result = await api.resetInvoices({ from, to })
      await load()
      setAskReset(false)
      toast(`تم تصفير ${result.cleared} فاتورة. الحذف نهائي ولا يمس عدادات الأصناف.`)
      if (result.failed) toast(`تعذر حذف ${result.failed} فاتورة`)
    } catch (err) {
      toast(writeError(err, 'تعذر تصفير السجل. لم يُحذف شيء'))
    } finally {
      setBusy(false)
    }
  }

  if (reprint) {
    return <InvoiceView invoice={reprint} onBack={() => setReprint(null)} />
  }

  if (!unlocked) {
    return (
      <div className="gate">
        <button className="btn ghost" onClick={onClose}>
          العودة
        </button>
        <PinPad
          title="سجل المبيعات"
          subtitle="أدخل رقم المدير السري. الافتراضي عند أول تشغيل: 1234"
          onComplete={unlock}
          onCancel={onClose}
          error={error}
          shake={shake}
          disabled={busy}
        />
      </div>
    )
  }

  const fullReset = !from && !to

  return (
    <div className="screen" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <h1 className="display" style={{ margin: 0, flex: 1 }}>
          سجل المبيعات
        </h1>
        <button className="btn ghost" onClick={() => setUnlocked(false)}>
          قفل
        </button>
        <button className="btn ghost" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div className="kpi" style={{ marginBottom: 12 }}>
        <h3 className="display" style={{ marginTop: 0 }}>
          إعدادات المدير
        </h3>
        <form className="form" onSubmit={changePin}>
          <label>الرقم الحالي</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={current}
            onChange={(e) => setCurrent(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
          />
          <label>الرقم الجديد</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
          />
          <label>تأكيد</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
          />
          <button className="btn" disabled={busy}>
            تغيير رقم المدير
          </button>
        </form>
      </div>

      <div className="kpi" style={{ marginBottom: 12 }}>
        <h3 className="display" style={{ marginTop: 0 }}>
          الفترة
        </h3>
        <div className="pills">
          {PRESETS.map((p) => (
            <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => applyPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="form" style={{ marginTop: 10 }}>
          <label>من تاريخ</label>
          <input type="date" value={dateInputValue(from)} onChange={(e) => onFrom(e.target.value)} />
          <label>إلى تاريخ</label>
          <input type="date" value={dateInputValue(to)} onChange={(e) => onTo(e.target.value)} />
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="lbl">إجمالي الإيراد</div>
          <div className="val">{formatMoney(kpis.revenue)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">نقدي</div>
          <div className="val">{formatMoney(kpis.cash)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">فيزا</div>
          <div className="val">{formatMoney(kpis.visa)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">وحدات مباعة</div>
          <div className="val">{formatNumber(kpis.units)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">عدد الفواتير</div>
          <div className="val">{formatNumber(kpis.count)}</div>
        </div>
        <div className="kpi">
          <div className="lbl">مرجع السجل الكلي</div>
          <div className="val">{formatMoney(kpis.all)}</div>
        </div>
      </div>

      <h3 className="display">الكاشير</h3>
      {cashierId ? (
        <button className="btn ghost" style={{ marginBottom: 8 }} onClick={() => setCashierId(null)}>
          عرض كل الفريق
        </button>
      ) : null}
      <div className="cashier-boxes">
        {cashiers.map((c) => (
          <button
            key={c.id}
            className={`box ${cashierId === c.id ? 'on' : ''}`}
            onClick={() => setCashierId(c.id)}
          >
            <strong>{c.name}</strong>
            <div>{formatMoney(c.total)}</div>
            <div className="meta">
              نقدي {formatMoney(c.cash)} · فيزا {formatMoney(c.visa)}
            </div>
            <div className="meta">
              {c.invoices} فاتورة · {c.units} وحدة
            </div>
          </button>
        ))}
      </div>

      <h3 className="display">تحليل الأصناف</h3>
      {products.list.length === 0 ? (
        <div className="cart-empty">لا أصناف مباعة في هذه الفترة</div>
      ) : (
        <>
          <div className="chart">
            {products.top.map((p) => (
              <div className="col" key={p.name}>
                <i style={{ height: `${Math.max(8, (p.units / (products.max || 1)) * 100)}%` }} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
          <div className="bars" style={{ marginTop: 12 }}>
            {products.list.map((p) => (
              <div className="bar-row" key={p.name}>
                <span>{p.name}</span>
                <div className="bar">
                  <span style={{ width: `${kpis.revenue ? (p.revenue / kpis.revenue) * 100 : 0}%` }} />
                </div>
                <span>{p.units}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {loadState === 'loading' ? <p className="lead">جاري تحميل السجل...</p> : null}

      <h3 className="display">الفواتير</h3>
      {filtered.length === 0 ? (
        <div className="cart-empty">
          لا فواتير في هذه الفترة
          <div>وسّع نطاق التاريخ أو ألغِ تصفية الكاشير</div>
        </div>
      ) : (
        <div className="mgr-list">
          {filtered
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((inv) => (
              <div className="mgr-row" key={inv.id}>
                <div>
                  <strong>فاتورة {inv.number}</strong>
                  <div className="meta">
                    {formatTime(inv.createdAt)} · {inv.cashierName} · {PAY[inv.paymentMethod]} ·{' '}
                    {formatMoney(inv.total)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn ghost" onClick={() => setReprint(inv)}>
                    إعادة طباعة / PDF
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        {askReset ? (
          <div className="confirm-strip">
            <span>
              حذف {filtered.length} فاتورة نهائياً؟ لا يمس عدادات الأصناف.
            </span>
            <button className="btn danger" disabled={busy} onClick={resetLog}>
              تأكيد التصفير
            </button>
            <button className="btn ghost" onClick={() => setAskReset(false)}>
              إلغاء
            </button>
          </div>
        ) : (
          <button className="btn danger" disabled={!filtered.length} onClick={() => setAskReset(true)}>
            {fullReset ? 'تصفير السجل بالكامل' : `تصفير سجل الفترة المحددة (${filtered.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
