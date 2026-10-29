import { useRef, useState } from 'react'
import { CLINIC, formatDateTime, formatMoney } from '../utils.js'
import Logo from './Logo.jsx'

const PAY = { cash: 'نقدي', visa: 'فيزا' }

export default function InvoiceView({ invoice, onBack }) {
  const paperRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const [msg, setMsg] = useState('')

  function printSheet() {
    window.print()
  }

  async function downloadPdf() {
    setBusy(true)
    setMsg('')
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const el = paperRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
      const w = canvas.width * ratio
      const h = canvas.height * ratio
      pdf.addImage(img, 'PNG', (pageW - w) / 2, 8, w, h)
      pdf.save(`فاتورة-${invoice.number}.pdf`)
      setMsg('تم تنزيل ملف PDF مطابقاً للورقة المعروضة')
    } catch {
      setMsg('تعذر إنشاء ملف PDF')
    } finally {
      setBusy(false)
    }
  }

  if (!invoice) return null

  return (
    <div className="paper-page">
      <div className="paper" ref={paperRef} dir="rtl">
        <div className="paper-brand">
          <Logo size={52} variant="paper" />
          <div>
            <h1>{CLINIC.name}</h1>
            <div className="sub">فاتورة رقم {invoice.number}</div>
          </div>
        </div>
        <div className="sub">{formatDateTime(invoice.createdAt)}</div>
        <div className="sub">الكاشير: {invoice.cashierName}</div>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td>{it.qty}</td>
                <td>{formatMoney(it.unitPrice)}</td>
                <td>{formatMoney(it.unitPrice * it.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>
          الإجمالي: {formatMoney(invoice.total)}
        </p>
        <p>طريقة الدفع: {PAY[invoice.paymentMethod] || invoice.paymentMethod}</p>
      </div>
      <div className="inv-actions">
        <button className="btn ghost" onClick={onBack}>
          العودة للصندوق
        </button>
        <button className="btn ghost" onClick={printSheet}>
          طباعة
        </button>
        <button className="btn" disabled={busy} onClick={downloadPdf}>
          {busy ? 'جاري التصدير...' : 'تحميل PDF'}
        </button>
      </div>
      {msg ? <p className="lead" style={{ textAlign: 'center' }}>{msg}</p> : null}
    </div>
  )
}
