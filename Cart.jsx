import { useState } from 'react'
import { formatMoney, isPositivePrice, parsePrice } from '../utils.js'

const QUICK = [50, 100, 150]

export default function Cart({
  items,
  onInc,
  onDec,
  onRemove,
  payment,
  onPayment,
  onCheckout,
  onQuickAdd,
  busy
}) {
  const total = items.reduce((s, it) => s + it.unitPrice * it.qty, 0)
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [err, setErr] = useState('')

  function addCustom(amount) {
    const value = amount ?? parsePrice(price)
    if (!Number.isFinite(value) || value <= 0) {
      setErr('أدخل سعراً موجباً')
      return
    }
    onQuickAdd({
      name: desc.trim() || 'صنف غير مسجل',
      unitPrice: Math.round(value * 100) / 100
    })
    setDesc('')
    setPrice('')
    setErr('')
  }

  function submit(e) {
    e.preventDefault()
    if (!isPositivePrice(price)) {
      setErr('أدخل سعراً موجباً')
      return
    }
    addCustom()
  }

  return (
    <aside className="cart">
      <h2>السلة</h2>
      {items.length === 0 ? (
        <div className="cart-empty">
          السلة فارغة
          <div>اضغط على صنف لإضافته</div>
        </div>
      ) : (
        <div className="lines">
          {items.map((it) => (
            <div key={it.productId} className="line">
              <div>
                <div className="nm">{it.name}</div>
                <div className="meta">{formatMoney(it.unitPrice)}</div>
              </div>
              <div className="step">
                <button type="button" onClick={() => onDec(it.productId)} aria-label="إنقاص">
                  -
                </button>
                <strong>{it.qty}</strong>
                <button type="button" onClick={() => onInc(it.productId)} aria-label="زيادة">
                  +
                </button>
                <button type="button" className="rm" onClick={() => onRemove(it.productId)} aria-label="حذف">
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="quick-add" onSubmit={submit}>
        <div className="quick-title">إضافة سريعة غير مسجلة</div>
        <div className="quick-pills">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => addCustom(n)}>
              +{n}ج
            </button>
          ))}
        </div>
        <input
          placeholder="وصف (اختياري)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="quick-row">
          <input
            inputMode="decimal"
            placeholder="السعر"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              setErr('')
            }}
          />
          <button type="submit" className="quick-plus" aria-label="إضافة">
            +
          </button>
        </div>
        {err ? <div className="inline-err">{err}</div> : null}
      </form>

      <div className="summary">
        <div className="total-row">
          <span>الإجمالي</span>
          <span>{formatMoney(total)}</span>
        </div>
        <div className="pay">
          <button type="button" className={payment === 'cash' ? 'on' : ''} onClick={() => onPayment('cash')}>
            نقدي
          </button>
          <button type="button" className={payment === 'visa' ? 'on' : ''} onClick={() => onPayment('visa')}>
            فيزا
          </button>
        </div>
        <button className="checkout" disabled={!items.length || busy} onClick={onCheckout}>
          {busy ? 'جاري الإصدار...' : 'إصدار الفاتورة'}
        </button>
      </div>
    </aside>
  )
}
