"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, useParams } from "next/navigation" 
import { supabase } from "@/services/supabase"
import PaymentAllocation from "../../components/payment/paymentAllocation" 

export default function AddLoansPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = useParams() 

  const queryEntryId = searchParams.get("id") || id

  // Form Field States
  const [entry, setEntry] = useState<any>(null)
  const [entryName, setEntryName] = useState("")
  const [transactionType, setTransactionType] = useState("installment_expense")
  const [borrowerId, setBorrowerId] = useState("")
  const [lenderId, setLenderId] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")

  // Active database record tracker
  const [activeEntryId, setActiveEntryId] = useState<string | string[] | null>(queryEntryId)

  // Installment Specific Fields
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paymentFrequency, setPaymentFrequency] = useState("Monthly")
  const [paymentDayMonthly, setPaymentDayMonthly] = useState("1")
  const [paymentDayWeekly, setPaymentDayWeekly] = useState("Sunday")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState("12")

  // Database payment tracking state
  const [amountPaid, setAmountPaid] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  // --- ALL 5 REQUIRED PAYMENT ATTRIBUTES FOR THE MODAL ---
  const [paymentAmountInput, setPaymentAmountInput] = useState("")
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split('T')[0])
  const [payeeIdInput, setPayeeIdInput] = useState("")
  const [paymentProofUrl, setPaymentProofUrl] = useState("") // CHANGED FROM FILE TO STRING URL
  const [paymentNotesInput, setPaymentNotesInput] = useState("")
  // --------------------------------------------------------

  // System State
  const [submitting, setSubmitting] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [loadingInitialData, setLoadingInitialData] = useState(false)

  // Calculate live dynamic totals
  const totalObligation = parseFloat(amountBorrowed) || 0
  const calculationPercentage = totalObligation > 0 ? Math.min(Math.round((amountPaid / totalObligation) * 100), 100) : 0
  const installmentsTotalTerms = parseInt(paymentTerms) || 12
  const amountPerTerm = totalObligation > 0 ? (totalObligation / installmentsTotalTerms) : 0

  const monthlyDays = Array.from({ length: 28 }, (_, i) => (i + 1).toString())
  const weeklyDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  useEffect(() => {
    async function loadLoanAndPayments() {
      if (!activeEntryId) return

      try {
        setLoadingInitialData(true)

        // 1. Fetch parent loan data
        const { data: loanData, error: loanError } = await supabase
          .from("entries")
          .select(`
            *,
            borrower:borrower_id(name),
            lender:lender_id(name)
          `)
          .eq("id", activeEntryId)
          .single()

        if (loanError) throw loanError

        if (loanData) {
          setEntry(loanData)
          setEntryName(loanData.entry_name || "")
          setTransactionType(loanData.transaction_type || "installment_expense")
          setBorrowerId(loanData.borrower_id || "")
          setLenderId(loanData.lender_id || "")
          setAmountBorrowed(loanData.amount_borrowed?.toString() || "")
          setPaymentStatus(loanData.status || "unpaid")
          
          // Pre-populate standard target payee selection using the recorded lender
          if (loanData.lender_id) {
            setPayeeIdInput(loanData.lender_id)
          }
        }

        // 2. Fetch all real transaction items inside 'payments' table using standard columns
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("payment_amount") 
          .eq("entry_id", activeEntryId) 

        if (paymentsError) throw paymentsError

        if (paymentsData) {
          const totalSettled = paymentsData.reduce((sum, item) => sum + (parseFloat(item.payment_amount) || 0), 0)
          setAmountPaid(totalSettled)
        }

      } catch (err: any) {
        console.error("Error synchronizing saved ledger state:", err.message)
      } finally {
        setLoadingInitialData(false)
      }
    }

    loadLoanAndPayments()
  }, [activeEntryId])

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (transactionType === "installment_expense" && startDate > todayStr) {
      setPaymentStatus("not_started")
    } else if (transactionType === "installment_expense" && paymentStatus === "not_started" && startDate <= todayStr) {
      setPaymentStatus("unpaid")
    }
  }, [startDate, transactionType])

  // Open modal wrapper to auto-set fields cleanly
  const handleOpenPaymentModal = () => {
    if (amountPerTerm > 0) {
      setPaymentAmountInput(amountPerTerm.toFixed(2))
    }
    setPaymentDateInput(new Date().toISOString().split('T')[0])
    if (entry?.lender_id || lenderId) {
      setPayeeIdInput(entry?.lender_id || lenderId)
    }
    setPaymentProofUrl("") // Clean string state reset
    setPaymentNotesInput("")
    setShowPaymentModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entryName.trim() || !borrowerId.trim() || !lenderId.trim() || !amountBorrowed) {
      alert("Please populate all form parameters before executing query.")
      return
    }

    try {
      setSubmitting(true)
      const parsedAmount = parseFloat(amountBorrowed)
      const generatedRefId = `LN-${Date.now()}`

      const basePayload: any = {
        ref_id: generatedRefId,
        entry_name: entryName.trim(),
        description: entryName.trim(),
        transaction_type: transactionType,
        borrower_id: borrowerId.trim(),
        lender_id: lenderId.trim(),
        amount_borrowed: parsedAmount,
        amount_remaining: parsedAmount,
        status: paymentStatus.toLowerCase(),
        date_borrowed: new Date().toISOString().split('T')[0]
      }

      const { data: insertedEntries, error: entryError } = await supabase
        .from("entries")
        .insert([basePayload])
        .select()

      if (entryError) {
        alert(`Failed to save loan: ${entryError.message}`)
        return
      }

      const createdEntry = insertedEntries?.[0]
      if (createdEntry) {
        setActiveEntryId(createdEntry.id)
      }

      if (transactionType === "installment_expense" && createdEntry) {
        const recurrenceDayValue = paymentFrequency === "Monthly" ? paymentDayMonthly : paymentDayWeekly

        const { error: rpcError } = await supabase.rpc("generate_installment_schedule", {
          p_entry_id: createdEntry.id,
          p_start_date: startDate,
          p_frequency: paymentFrequency.toLowerCase(),
          p_recurrence_day: recurrenceDayValue,
          p_terms: installmentsTotalTerms,
          p_total_amount: parsedAmount,
          p_notes: `Initial schedule for ${entryName.trim()}`
        })

        if (rpcError) {
          alert(`Loan base saved, but schedule generation failed: ${rpcError.message}`)
          return
        }
      }

      alert("Loan record initialized successfully!")
    } catch (err: any) {
      console.error(err)
      alert("Failed to submit new loan ledger item record.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedInput = parseFloat(paymentAmountInput)

    if (!activeEntryId) return
    if (!parsedInput || parsedInput <= 0) return
    if (!payeeIdInput) return alert("Please select or specify a valid Payee.")

    try {
      setProcessingPayment(true)
      const nextTotalPaid = amountPaid + parsedInput

      const { error: paymentError } = await supabase
        .from("payments")
        .insert([
          {
            entry_id: activeEntryId,            
            payment_amount: parsedInput,        
            payment_date: paymentDateInput,
            payee_id: payeeIdInput,
            proof_url: paymentProofUrl.trim() || null, 
            notes: paymentNotesInput || `Term payment for ${entryName || "Loan Asset"}`
          }
        ])

      if (paymentError) throw paymentError

      setAmountPaid(nextTotalPaid)
      
      const remainingBalance = Math.max(totalObligation - nextTotalPaid, 0)
      setPaymentStatus(remainingBalance <= 0 ? "paid" : "partially_paid")
      
      setShowPaymentModal(false)

      // ALERT REMOVED HERE AS REQUESTED
    } catch (error: any) {
      alert(`Could not save transaction context: ${error.message}`)
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loadingInitialData) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Syncing data profiles...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-4" style={{ maxWidth: "600px" }}>

      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary">
          &larr; Back to Loans List
        </Link>
      </div>

      <div className="card p-4 shadow-sm mb-4">
        <h3 className="fw-bold mb-1">{activeEntryId ? "Loan Details" : "Add New Loan Entry"}</h3>
        <p className="text-muted small mb-4">
          {activeEntryId ? "Overview profile of the saved shared liability balancing record." : "Log a shared liability item or transaction balancing record."}
        </p>

        {activeEntryId ? (
          /* LIST VIEW MODE */
          <div className="list-group list-group-flush border-top border-bottom mb-2">
            <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
              <span className="small fw-bold text-dark">Description</span>
              <span className="text-secondary">{entryName}</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
              <span className="small fw-bold text-dark">Transaction Type</span>
              <span className="text-secondary text-capitalize">{transactionType.replace("_", " ")}</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
              <span className="small fw-bold text-dark">Borrower Name</span>
              <span className="text-secondary">{entry?.borrower?.name || borrowerId}</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
              <span className="small fw-bold text-dark">Lender Name</span>
              <span className="text-secondary">{entry?.lender?.name || lenderId}</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
              <span className="small fw-bold text-dark">Amount Borrowed</span>
              <span className="fw-bold text-dark">₱{totalObligation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ) : (
          /* FORM CREATION MODE */
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-dark">Entry Name / Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Lunch bill split, Groceries"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold text-dark">Transaction Type</label>
              <select
                className="form-select text-capitalize"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                required
              >
                <option value="straight_expense">Straight Expense</option>
                <option value="installment_expense">Installment Expense</option>
                <option value="group_expense">Group Expense</option>
              </select>
            </div>

            {transactionType === "installment_expense" && (
              <div className="p-3 bg-light rounded border mb-3">
                <h6 className="fw-bold text-secondary mb-3 small text-uppercase tracking-wider">Installment Details</h6>
                <div className="row g-2">
                  <div className="col-sm-6 mb-2">
                    <label className="form-label small text-muted mb-1">Start Date</label>
                    <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="col-sm-6 mb-2">
                    <label className="form-label small text-muted mb-1">Payment Terms</label>
                    <input type="number" className="form-control form-control-sm" min="1" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-sm-6">
                    <label className="form-label small text-muted mb-1">Payment Frequency</label>
                    <select className="form-select form-select-sm" value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)}>
                      <option value="Monthly">Monthly</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="col-sm-6">
                    {paymentFrequency === "Monthly" ? (
                      <>
                        <label className="form-label small text-muted mb-1">Day of Month</label>
                        <select className="form-select form-select-sm" value={paymentDayMonthly} onChange={(e) => setPaymentDayMonthly(e.target.value)}>
                          {monthlyDays.map((day) => <option key={`m-${day}`} value={day}>{day}th day</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="form-label small text-muted mb-1">Day of Week</label>
                        <select className="form-select form-select-sm" value={paymentDayWeekly} onChange={(e) => setPaymentDayWeekly(e.target.value)}>
                          {weeklyDays.map((day) => <option key={`w-${day}`} value={day}>{day}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label small fw-bold text-dark">Borrower Name</label>
              <input type="text" className="form-control" placeholder="Enter borrower's full name" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold text-dark">Lender Name</label>
              <input type="text" className="form-control" placeholder="Enter lender's full name" value={lenderId} onChange={(e) => setLenderId(e.target.value)} required />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-dark">Amount Borrowed</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted">₱</span>
                <input type="number" step="0.01" min="0.01" className="form-control" placeholder="0.00" value={amountBorrowed} onChange={(e) => setAmountBorrowed(e.target.value)} required />
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <Link href="/loans" className="btn btn-light border">Cancel</Link>
              <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
                {submitting ? "Saving Entry..." : "Save Loan"}
              </button>
            </div>
          </form>
        )}

        {entry?.notes && (
          <div className="mt-2 p-3 bg-light rounded text-secondary small">
            <strong>Internal Notes:</strong> {entry.notes}
          </div>
        )}
      </div>

      {entry && (
        <PaymentAllocation
          loanId={entry.id}
          transactionType={entry.transaction_type}
          borrowerId={entry.borrower_id ?? entry.borrower?.contact_id}
        />
      )}

      {entry && entry.transaction_type !== "group_expense" && (
        <div className="card p-4 text-center text-muted border-dashed bg-white mb-4">
          This is an individual expense ({entry.transaction_type.replace("_", " ")}). Group allocation tools are hidden.
        </div>
      )}

      {transactionType === "installment_expense" && (
        <div className="card p-4 shadow-sm bg-white border border-info mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h5 className="fw-bold text-dark m-0">Installment Details</h5>
            <span className={`badge text-uppercase small px-2 py-1 ${
              paymentStatus === 'fully_paid' || paymentStatus === 'paid' ? 'bg-success' :
              paymentStatus === 'not_started' ? 'bg-secondary text-white' :
              paymentStatus === 'skipped' ? 'bg-warning text-dark' :
              paymentStatus === 'delinquent' ? 'bg-danger text-white' : 'bg-danger-subtle text-danger'
            }`}>{paymentStatus.replace('_', ' ')}</span>
          </div>
          <p className="text-muted small mb-3">Timeline monitoring track and interactive term controls.</p>

          <div className="row g-2 mb-3 bg-light p-2 rounded small text-secondary">
            <div className="col-6"><strong>Term Value Rate:</strong> ₱{amountPerTerm.toFixed(2)}</div>
            <div className="col-6"><strong>Target Horizon:</strong> {paymentTerms} Payments</div>
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between small fw-bold mb-1 text-secondary">
              <span>Collection Matrix Progress</span>
              <span>{calculationPercentage}% Complete</span>
            </div>
            <div className="progress" style={{ height: "10px" }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                role="progressbar"
                style={{ width: `${calculationPercentage}%` }}
                aria-valuenow={calculationPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="d-flex justify-content-between text-muted small mt-1" style={{ fontSize: '11px' }}>
              <span>Settled: ₱{amountPaid.toFixed(2)}</span>
              <span>Target: ₱{totalObligation.toFixed(2)}</span>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm flex-grow-1"
              onClick={handleOpenPaymentModal}
              disabled={!activeEntryId || totalObligation === 0 || paymentStatus === 'fully_paid' || paymentStatus === 'paid'}
            >
              ➕ Add Payment
            </button>
            <button
              type="button"
              className="btn btn-outline-warning btn-sm flex-grow-1"
              onClick={() => setPaymentStatus("skipped")}
              disabled={!activeEntryId || paymentStatus === 'fully_paid' || paymentStatus === 'paid'}
            >
              ⏭️ Skip Term
            </button>
          </div>
        </div>
      )}

      {/* --- EXPANDED MODAL BRINGING IN ALL USER SPECIFIED INPUTS --- */}
      {showPaymentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "460px" }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header py-3 bg-dark text-white">
                <h5 className="modal-title m-0 fw-bold fs-6">Capture Receipt & Payment Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
              </div>
              <form onSubmit={handleProcessPayment}>
                <div className="modal-body py-3 row g-3">
                  
                  {/* 1. Date Value Input */}
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payment Date *</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      required
                      value={paymentDateInput}
                      onChange={(e) => setPaymentDateInput(e.target.value)}
                    />
                  </div>

                  {/* 2. Amount Input */}
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Amount Tendered *</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">₱</span>
                      <input
                        type="number"
                        className="form-control"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={paymentAmountInput}
                        onChange={(e) => setPaymentAmountInput(e.target.value)}
                        max={totalObligation - amountPaid}
                        disabled={processingPayment}
                      />
                    </div>
                  </div>

                  {/* 3. Dropdown Selection context for the Payee */}
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payee (Receiving Party) *</label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={payeeIdInput}
                      onChange={(e) => setPayeeIdInput(e.target.value)}
                    >
                      <option value="">-- Choose Target Payee Contact --</option>
                      {entry?.lender && <option value={entry.lender_id || payeeIdInput}>{entry.lender.name} (Lender)</option>}
                      {entry?.borrower && <option value={entry.borrower_id}>{entry.borrower.name} (Borrower)</option>}
                      {!entry && lenderId && <option value={lenderId}>{lenderId}</option>}
                    </select>
                  </div>

                  {/* 4. MODIFIED TO TEXT/URL INPUT STRING FIELD */}
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Proof of Payment (Image / Receipt URL)</label>
                    <input 
                      type="url" 
                      className="form-control form-control-sm" 
                      placeholder="https://example.com/receipt.png"
                      value={paymentProofUrl}
                      onChange={(e) => setPaymentProofUrl(e.target.value)}
                      disabled={processingPayment}
                    />
                    <div className="form-text text-muted" style={{ fontSize: "10px" }}>
                      Paste a receipt link or image URL address reference string here.
                    </div>
                  </div>

                  {/* 5. Custom execution descriptive strings or notes (ADC notes log string) */}
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Notes (ADC - Reference Tracker Log)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="e.g., GCash ref tracking sequence, banking authorization string logs..."
                      value={paymentNotesInput}
                      onChange={(e) => setPaymentNotesInput(e.target.value)}
                    />
                  </div>

                </div>
                <div className="modal-footer p-2 bg-light">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setShowPaymentModal(false)} disabled={processingPayment}>Close</button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={processingPayment}>
                    {processingPayment ? "Processing..." : "Add Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}