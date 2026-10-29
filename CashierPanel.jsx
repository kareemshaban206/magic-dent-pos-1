import { useState } from 'react'
import { api, writeError } from '../api.js'
import { normalizeDigits } from '../utils.js'

export default function CashierPanel({ cashier, onClose, onSwitch, onLock, toast }) {
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [endAsk, setEndAsk] = useState(false)

  async function changePin(e) {
    e.preventDefault()
    if (cashier.id === 'manager') {
      toast('غيّر رقم المدير من سجل المبيعات')
      return
    }
    setBusy(true)
    try {
      if (!/^\d{4}$/.test(pin) || pin !== confirm) {
        toast('الرقم الجديد يجب أن يكون 4 أرقام ومتطابقاً')
        setBusy(false)
        return
      }
      await api.changeCashierPin(cashier.id, current, pin, confirm)
      toast('تم تغيير الرقم السري')
      setCurrent('')
      setPin('')
      setConfirm('')
    } catch (err) {
      toast(writeError(err, 'تعذر تغيير الرقم السري'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="row">
          <h2 className="display" style={{ margin: 0, flex: 1 }}>
            حساب الكاشير
          </h2>
          <button className="icon-btn" onClick={onClose}>
            x
          </button>
        </header>
        <div className="body">
          <p>
            الاسم الحالي: <strong>{cashier.name}</strong>
          </p>
          {cashier.id !== 'manager' ? (
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
              <label>تأكيد الرقم الجديد</label>
              <input
                inputMode="numeric"
                maxLength={4}
                value={confirm}
                onChange={(e) => setConfirm(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
              />
              <button className="btn" disabled={busy}>
                تغيير الرقم السري
              </button>
            </form>
          ) : (
            <p className="lead">حساب المدير. غيّر الرقم السري من داخل سجل المبيعات.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button className="btn ghost" onClick={onSwitch}>
              تبديل الكاشير
            </button>
            {endAsk ? (
              <div className="confirm-strip">
                <span>إنهاء الوردية وقفل الجهاز الآن؟</span>
                <button className="btn danger" onClick={onLock}>
                  تأكيد القفل
                </button>
                <button className="btn ghost" onClick={() => setEndAsk(false)}>
                  إلغاء
                </button>
              </div>
            ) : (
              <button className="btn danger" onClick={() => setEndAsk(true)}>
                إنهاء الوردية والقفل الآن
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
