import { useState } from 'react'
import PinPad from './PinPad.jsx'
import StaffManage from './StaffManage.jsx'
import { api, writeError } from '../api.js'
import { CLINIC } from '../utils.js'

function initial(name) {
  return name.replace(/^ال/, '').charAt(0)
}

export default function ShiftGate({ staff, onUnlock, onStaffChange, toast }) {
  const [pick, setPick] = useState(null)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recover, setRecover] = useState(false)

  async function handlePin(a, b) {
    if (!pick) return
    setBusy(true)
    setError('')
    try {
      if (pick.isManager) {
        await api.verifyManager(a)
        onUnlock({ id: 'manager', name: 'المدير', isManager: true })
        return
      }
      if (!pick.hasPin) {
        if (a !== b) {
          setShake(true)
          setTimeout(() => setShake(false), 420)
          setError('الرقمان السريان غير متطابقين')
          setBusy(false)
          return
        }
        await api.createPin(pick.id, a, b)
        onStaffChange?.()
        onUnlock({ id: pick.id, name: pick.name })
        return
      }
      await api.verifyPin(pick.id, a)
      onUnlock({ id: pick.id, name: pick.name })
    } catch (err) {
      setShake(true)
      setTimeout(() => setShake(false), 420)
      setError(writeError(err, 'الرقم السري غير صحيح'))
      if (err.status === 409) setRecover(true)
      if (err.waitMs) {
        setError(`محاولات كثيرة. انتظر ${Math.ceil(err.waitMs / 1000)} ثوان`)
        setTimeout(() => setBusy(false), Math.min(err.waitMs, 8000))
        return
      }
    } finally {
      setBusy(false)
    }
  }

  if (pick) {
    return (
      <div className="gate">
        <h1>{pick.name}</h1>
        {recover ? (
          <div>
            <p className="lead">
              لا يمكن إنشاء رقم سري من هذا الجهاز لأن الحساب محمي مسبقاً.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setRecover(false)}>
                إدخال رقم سري موجود
              </button>
              <button
                className="btn ghost"
                onClick={() => onUnlock({ id: pick.id, name: pick.name, noPin: true })}
              >
                المتابعة بدون رقم سري
              </button>
            </div>
          </div>
        ) : (
          <PinPad
            mode={!pick.isManager && !pick.hasPin ? 'create' : 'enter'}
            subtitle={
              pick.isManager
                ? 'رقم المدير السري لفتح وردية إدارية'
                : pick.hasPin
                  ? 'أدخل الرقم السري المكوّن من 4 أرقام'
                  : null
            }
            onComplete={handlePin}
            onCancel={() => {
              setPick(null)
              setError('')
              setRecover(false)
            }}
            error={error}
            shake={shake}
            disabled={busy}
            extra={
              pick.isManager ? (
                <p className="lead" style={{ marginTop: 16 }}>
                  سجل المبيعات يُفتح لاحقاً من الشاشة الرئيسية بنفس الرقم.
                </p>
              ) : null
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="gate">
      <p className="lead">{CLINIC.subtitle}</p>
      <h1>من يعمل على الصندوق؟</h1>
      <p className="lead">اختر اسمك لفتح الوردية. الرقم السري يُحفظ على الخادم فقط ولا يُخزَّن في التطبيق.</p>
      <div className="staff-grid">
        {staff.map((s, i) => (
          <button
            key={s.id}
            className="staff-card"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => {
              setError('')
              setRecover(false)
              setPick(s)
            }}
          >
            <div className="avatar">{initial(s.name)}</div>
            <strong>{s.name}</strong>
            <div className="lock">{s.hasPin ? 'محمي برقم سري' : 'إنشاء رقم سري'}</div>
          </button>
        ))}
        <button
          className="staff-card manager"
          style={{ animationDelay: `${staff.length * 60}ms` }}
          onClick={() => {
            setError('')
            setRecover(false)
            setPick({ id: 'manager', name: 'المدير', isManager: true, hasPin: true })
          }}
        >
          <div className="avatar">م</div>
          <strong>المدير</strong>
          <div className="lock">فتح وردية إدارية</div>
        </button>
      </div>
      <StaffManage staff={staff} onStaffChange={onStaffChange} toast={toast} />
    </div>
  )
}
