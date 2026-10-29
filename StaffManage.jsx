import { useState } from 'react'
import { api, writeError } from '../api.js'
import { normalizeDigits } from '../utils.js'

function digits4(value) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 4)
}

export default function StaffManage({ staff, onStaffChange, toast }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [pinId, setPinId] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  async function addStaff(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setFormErr('اسم الموظف مطلوب')
      return
    }
    if (!/^\d{4}$/.test(pin)) {
      setFormErr('الرمز السري يجب أن يكون 4 أرقام')
      return
    }
    setFormErr('')
    setBusy(true)
    try {
      const res = await api.addStaff({ name: trimmed, pin })
      onStaffChange?.(res.staff)
      toast?.('تمت إضافة الموظف')
      setName('')
      setPin('')
    } catch (err) {
      setFormErr(writeError(err, 'تعذر إضافة الموظف'))
    } finally {
      setBusy(false)
    }
  }

  async function saveName(id) {
    const trimmed = editName.trim()
    if (!trimmed) {
      toast?.('اسم الموظف مطلوب')
      return
    }
    setBusy(true)
    try {
      const res = await api.updateStaff(id, { name: trimmed })
      onStaffChange?.(res.staff)
      setEditId(null)
      toast?.('تم حفظ الاسم')
    } catch (err) {
      toast?.(writeError(err, 'تعذر حفظ الاسم'))
    } finally {
      setBusy(false)
    }
  }

  async function savePin(id) {
    if (!/^\d{4}$/.test(newPin)) {
      toast?.('الرمز السري يجب أن يكون 4 أرقام')
      return
    }
    setBusy(true)
    try {
      const res = await api.setStaffPin(id, newPin)
      onStaffChange?.(res.staff)
      setPinId(null)
      setNewPin('')
      toast?.('تم تغيير الرمز السري')
    } catch (err) {
      toast?.(writeError(err, 'تعذر تغيير الرمز السري'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    setBusy(true)
    try {
      const res = await api.deleteStaff(id)
      onStaffChange?.(res.staff)
      setConfirmId(null)
      toast?.('تم حذف الموظف')
    } catch (err) {
      toast?.(writeError(err, 'تعذر حذف الموظف'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="staff-manage">
      <h2 className="display">إدارة الموظفين</h2>
      <p className="lead">أضف أو عدّل أو احذف موظفي الصندوق من هنا. الرمز السري يُحفظ على الخادم فقط.</p>

      <form className="staff-add" onSubmit={addStaff}>
        <input
          placeholder="اسم الموظف الجديد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="اسم الموظف الجديد"
        />
        <input
          inputMode="numeric"
          maxLength={4}
          placeholder="الرمز السري"
          value={pin}
          onChange={(e) => setPin(digits4(e.target.value))}
          aria-label="الرمز السري"
        />
        <button className="btn" disabled={busy}>
          إضافة
        </button>
      </form>
      {formErr ? <div className="inline-err">{formErr}</div> : null}

      <div className="staff-admin-list">
        {staff.length === 0 ? (
          <div className="cart-empty">لا موظفون بعد</div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="staff-admin-row">
              {confirmId === s.id ? (
                <div className="confirm-strip">
                  <span>حذف «{s.name}» نهائياً؟</span>
                  <button className="btn danger" disabled={busy} onClick={() => remove(s.id)}>
                    تأكيد الحذف
                  </button>
                  <button className="btn ghost" onClick={() => setConfirmId(null)}>
                    إلغاء
                  </button>
                </div>
              ) : editId === s.id ? (
                <div className="staff-inline">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <button className="btn" disabled={busy} onClick={() => saveName(s.id)}>
                    حفظ
                  </button>
                  <button className="btn ghost" onClick={() => setEditId(null)}>
                    إلغاء
                  </button>
                </div>
              ) : pinId === s.id ? (
                <div className="staff-inline">
                  <span>{s.name}</span>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="رمز جديد"
                    value={newPin}
                    onChange={(e) => setNewPin(digits4(e.target.value))}
                  />
                  <button className="btn" disabled={busy} onClick={() => savePin(s.id)}>
                    حفظ الرمز
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setPinId(null)
                      setNewPin('')
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <>
                  <div className="staff-admin-name">
                    <strong>{s.name}</strong>
                    <span className="meta">{s.hasPin ? 'محمي برمز سري' : 'بدون رمز'}</span>
                  </div>
                  <div className="staff-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setEditId(s.id)
                        setEditName(s.name)
                        setPinId(null)
                        setConfirmId(null)
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setPinId(s.id)
                        setNewPin('')
                        setEditId(null)
                        setConfirmId(null)
                      }}
                    >
                      تغيير الرمز
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setConfirmId(s.id)
                        setEditId(null)
                        setPinId(null)
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
