import { useMemo, useRef, useState } from 'react'
import { api, writeError } from '../api.js'
import { formatMoney, isPositivePrice, matchesSearch, parsePrice } from '../utils.js'
import ProductImage from './ProductImage.jsx'

export default function CatalogSheet({ products, onClose, toast }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [priceErr, setPriceErr] = useState('')
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({ name: '', price: '', imageUrl: '' })
  const [editErr, setEditErr] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [resetId, setResetId] = useState(null)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef(null)

  const list = useMemo(
    () => products.filter((p) => matchesSearch(p.name, q)),
    [products, q]
  )

  async function add(e) {
    e.preventDefault()
    const trimmed = name.trim()
    setNameErr(trimmed ? '' : 'الاسم مطلوب')
    setPriceErr(isPositivePrice(price) ? '' : 'السعر يجب أن يكون رقماً موجباً')
    if (!trimmed || !isPositivePrice(price)) return
    setBusy(true)
    try {
      await api.addProduct({ name: trimmed, price: parsePrice(price), imageUrl: imageUrl.trim() })
      toast('تمت إضافة الصنف')
      setName('')
      setPrice('')
      setImageUrl('')
      nameRef.current?.focus()
    } catch (err) {
      toast(writeError(err, 'تعذر إضافة الصنف. الحالة السابقة كما هي'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id) {
    const trimmed = edit.name.trim()
    if (!trimmed) {
      setEditErr('الاسم مطلوب')
      return
    }
    if (!isPositivePrice(edit.price)) {
      setEditErr('السعر يجب أن يكون رقماً موجباً')
      return
    }
    setEditErr('')
    setBusy(true)
    try {
      await api.updateProduct(id, {
        name: trimmed,
        price: parsePrice(edit.price),
        imageUrl: edit.imageUrl
      })
      setEditId(null)
      toast('تم حفظ التعديل')
    } catch (err) {
      toast(writeError(err, 'تعذر حفظ التعديل. الحالة السابقة كما هي'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    setBusy(true)
    try {
      await api.deleteProduct(id)
      setConfirmId(null)
      toast('تم حذف الصنف')
    } catch (err) {
      toast(writeError(err, 'تعذر حذف الصنف. الحالة السابقة كما هي'))
    } finally {
      setBusy(false)
    }
  }

  async function resetSold(p) {
    if (!p.soldCount) return
    setBusy(true)
    try {
      await api.resetSold(p.id, p.soldCount)
      setResetId(null)
      toast('تم تصفير عداد المباع')
    } catch (err) {
      toast(writeError(err, 'تعذر تصفير العداد'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="إدارة الأصناف">
        <header className="row">
          <h2 className="display" style={{ margin: 0, flex: 1 }}>
            إدارة الأصناف
          </h2>
          <span className="meta">{products.length} صنف</span>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            x
          </button>
        </header>
        <div className="body">
          <p className="lead" style={{ marginTop: 0 }}>
            تعديل الكتالوج متاح لأي شخص يحمل الجهاز، دون رقم سري. هذا اختيار متعمد لسرعة العمل على الصندوق.
          </p>
          <form className="form" onSubmit={add}>
            <label>اسم الصنف</label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} />
            {nameErr ? <div className="inline-err">{nameErr}</div> : null}
            <label>السعر بالجنيه</label>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {priceErr ? <div className="inline-err">{priceErr}</div> : null}
            <label>رابط الصورة (اختياري)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr" />
            {imageUrl ? (
              <div className="thumb">
                <ProductImage src={imageUrl} alt="" />
              </div>
            ) : null}
            <button className="btn" disabled={busy}>
              إضافة صنف
            </button>
          </form>

          <input
            className="search"
            style={{ marginTop: 18 }}
            placeholder="بحث في الأصناف..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {list.length === 0 ? (
            <div className="cart-empty">{products.length === 0 ? 'لا أصناف في الكتالوج' : 'لا نتائج لهذا البحث'}</div>
          ) : null}

          <div className="mgr-list">
            {list.map((p) => (
              <div key={p.id} className="mgr-row">
                {confirmId === p.id ? (
                  <div className="confirm-strip">
                    <span>حذف «{p.name}» نهائياً؟</span>
                    <button className="btn danger" disabled={busy} onClick={() => remove(p.id)}>
                      تأكيد الحذف
                    </button>
                    <button className="btn ghost" onClick={() => setConfirmId(null)}>
                      إلغاء
                    </button>
                  </div>
                ) : editId === p.id ? (
                  <>
                    <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    <input
                      inputMode="decimal"
                      value={edit.price}
                      onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                    />
                    <input
                      dir="ltr"
                      value={edit.imageUrl}
                      onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })}
                    />
                    {editErr ? <div className="inline-err">{editErr}</div> : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" disabled={busy} onClick={() => saveEdit(p.id)}>
                        حفظ
                      </button>
                      <button className="btn ghost" onClick={() => setEditId(null)}>
                        إلغاء
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div className="thumb">
                        <ProductImage src={p.imageUrl} alt="" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>{p.name}</strong>
                        <div className="meta">
                          {formatMoney(p.price)} · مباع {p.soldCount}
                          {p.isCustom ? ' · مضاف' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setEditId(p.id)
                          setEditErr('')
                          setEdit({ name: p.name, price: String(p.price), imageUrl: p.imageUrl || '' })
                        }}
                      >
                        تعديل
                      </button>
                      <button className="btn ghost" onClick={() => setConfirmId(p.id)}>
                        حذف
                      </button>
                      {resetId === p.id ? (
                        <div className="confirm-strip" style={{ flex: 1 }}>
                          <span>تصفير المباع؟</span>
                          <button className="btn warn" disabled={busy} onClick={() => resetSold(p)}>
                            تأكيد
                          </button>
                          <button className="btn ghost" onClick={() => setResetId(null)}>
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn ghost"
                          disabled={!p.soldCount}
                          onClick={() => setResetId(p.id)}
                        >
                          تصفير المباع
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
