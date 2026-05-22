"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation" // Added search params to support reading existing IDs
import { supabase } from "@/services/supabase"

export default function AddLoansPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Read an optional 'id' query parameter if you navigate here to view an existing loan (e.g., /loans/add?id=123)
  const queryEntryId = searchParams.get("id")

  // Form Field States
  const [entryName, setEntryName] = useState("")
  const [transactionType, setTransactionType] = useState("installment_expense")
  const [borrowerId, setBorrowerId] = useState("")
  const [lenderId, setLenderId] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")
  
  // Active database record tracker
  const [activeEntryId, setActiveEntryId] = useState<string | number | null>(queryEntryId)
  
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
  const [paymentAmountInput, setPaymentAmountInput] = useState("")

  // System State
  const [submitting, setSubmitting] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [loadingInitialData, setLoadingInitialData] = useState(false)

  // Calculate live dynamic totals for progress bar elements
  const totalObligation = parseFloat(amountBorrowed) || 0
  const calculationPercentage = totalObligation > 0 ? Math.min(Math.round((amountPaid / totalObligation) * 100), 100) : 0
  const installmentsTotalTerms = parseInt(paymentTerms) || 12
  const amountPerTerm = totalObligation > 0 ? (totalObligation / installmentsTotalTerms) : 0

  const monthlyDays = Array.from({ length: 28 }, (_, i) => (i + 1).toString())
  const weeklyDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  // FETCH FIX 1: If the page loads with an existing entry ID, fetch its current status and full payment history
  useEffect(() => {
    async function loadLoanAndPayments() {
      if (!activeEntryId) return
      
      try {
        setLoadingInitialData(true)
        
        // 1. Fetch parent loan data
        const { data: loanData, error: loanError } = await supabase
          .from("entries")
          .select("*")
          .eq("id", activeEntryId)
          .single()

        if (loanError) throw loanError
        
        if (loanData) {
          setEntryName(loanData.entry_name || "")
          setTransactionType(loanData.transaction_type || "installment_expense")
          setBorrowerId(loanData.borrower_id || "")
          setLenderId(loanData.lender_id || "")
          setAmountBorrowed(loanData.amount_borrowed?.toString() || "")
          setPaymentStatus(loanData.status || "unpaid")
        }

        // 2. Fetch all real transaction items inside 'payments' table to accurately calculate accumulated totals
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("amount_paid")
          .eq("entry_id", activeEntryId)

        if (paymentsError) throw paymentsError

        if (paymentsData) {
          const totalSettled = paymentsData.reduce((sum, item) => sum + (parseFloat(item.amount_paid) || 0), 0)
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

  // Auto-evaluate "NOT STARTED" state when Start Date shifts into the future
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (transactionType === "installment_expense" && startDate > todayStr) {
      setPaymentStatus("not_started")
    } else if (transactionType === "installment_expense" && paymentStatus === "not_started" && startDate <= todayStr) {
      setPaymentStatus("unpaid")
    }
  }, [startDate, transactionType])

  // Handle Form Submission (Create Loan)
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
        console.error("Supabase Database Insert Error:", entryError.message)
        alert(`Failed to save loan: ${entryError.message}`)
        return
      }

      const createdEntry = insertedEntries?.[0]
      if (createdEntry) {
        setActiveEntryId(createdEntry.id) 
      }

      if (transactionType === "installment_expense" && createdEntry) {
        const recurrenceDayValue = paymentFrequency === "Monthly" 
          ? paymentDayMonthly 
          : paymentDayWeekly

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
          console.error("Failed to generate installment matrix schedule:", rpcError.message)
          alert(`Loan base saved, but schedule generation failed: ${rpcError.message}`)
          return
        }
      }

      alert("Loan record initialized successfully! You can now apply payments below.")
    } catch (err: any) {
      console.error("Database exception thrown during transaction creation:", err)
      alert("Failed to submit new loan ledger item record.")
    } finally {
      setSubmitting(false)
    }
  }

  // Real Production Connection to Supabase 'payments' Table
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedInput = parseFloat(paymentAmountInput)
    
    if (!activeEntryId) {
      alert("You must save the loan entry first before recording payments against it.")
      return
    }
    if (!parsedInput || parsedInput <= 0) return

    try {
      setProcessingPayment(true)
      const nextTotalPaid = amountPaid + parsedInput
      const remainingBalance = Math.max(totalObligation - nextTotalPaid, 0)
      const calculatedStatus = remainingBalance <= 0 ? "paid" : "unpaid"

      // 1. Insert transaction history line item into 'payments'
      const { error: paymentError } = await supabase
        .from("payments")
        .insert([
          {
            entry_id: activeEntryId,
            amount_paid: parsedInput,
            date_paid: new Date().toISOString().split('T')[0],
            notes: `Term payment for ${entryName || "Loan Asset"}`
          }
        ])

      if (paymentError) throw paymentError

      // 2. Sync and update the parent 'entries' record balance tracking
      const { error: entryUpdateError } = await supabase
        .from("entries")
        .update({
          amount_remaining: remainingBalance,
          status: calculatedStatus
        })
        .eq("id", activeEntryId)

      if (entryUpdateError) throw entryUpdateError

      // 3. Update local UI state
      setAmountPaid(nextTotalPaid)
      setPaymentStatus(calculatedStatus)
      setShowPaymentModal(false)
      setPaymentAmountInput("")
      
      alert("Payment recorded securely in database matrix.")
    } catch (error: any) {
      console.error("Payment pipeline logging broken:", error.message)
      alert(`Could not save transaction context: ${error.message}`)
    } finally {
      setProcessingPayment(false)
    }
  }

  const handleSkipTermMock = () => {
    setPaymentStatus("skipped")
  }

  if (loadingInitialData) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Syncing data profiles...</span>
        </div>
        <p className="text-muted small mt-2">Retrieving active history ledger entries...</p>
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
        <h3 className="fw-bold mb-1">{activeEntryId ? "View Loan Entry" : "Add New Loan Entry"}</h3>
        <p className="text-muted small mb-4">Log a shared liability item or transaction balancing record.</p>

        <form onSubmit={handleSubmit}>
          
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Entry Name / Description</label>
            <input 
              type="text"
              className="form-control"
              placeholder="e.g., Lunch bill split, Groceries, Cash advance"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              required
              disabled={submitting || activeEntryId !== null}
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Transaction Type</label>
            <select
              className="form-select text-capitalize"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              required
              disabled={submitting || activeEntryId !== null}
            >
              <option value="straight_expense">Straight Expense</option>
              <option value="installment_expense">Installment Expense</option>
              <option value="group_expense">Group Expense</option>
            </select>
          </div>

          {transactionType === "installment_expense" && !activeEntryId && (
            <div className="p-3 bg-light rounded border mb-3">
              <h6 className="fw-bold text-secondary mb-3 small text-uppercase tracking-wider">Installment Details</h6>
              
              <div className="row g-2">
                <div className="col-sm-6 mb-2">
                  <label className="form-label small text-muted mb-1">Start Date</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="col-sm-6 mb-2">
                  <label className="form-label small text-muted mb-1">Payment Terms (Count)</label>
                  <input 
                    type="number" 
                    className="form-control form-control-sm"
                    min="1"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-sm-6">
                  <label className="form-label small text-muted mb-1">Payment Frequency</label>
                  <select
                    className="form-select form-select-sm"
                    value={paymentFrequency}
                    onChange={(e) => setPaymentFrequency(e.target.value)}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>

                <div className="col-sm-6">
                  {paymentFrequency === "Monthly" ? (
                    <>
                      <label className="form-label small text-muted mb-1">Day of Month (1st - 28th)</label>
                      <select
                        className="form-select form-select-sm"
                        value={paymentDayMonthly}
                        onChange={(e) => setPaymentDayMonthly(e.target.value)}
                      >
                        {monthlyDays.map((day) => (
                          <option key={`month-day-${day}`} value={day}>
                            {day === "1" ? "1st" : day === "2" ? "2nd" : day === "3" ? "3rd" : `${day}th`} day
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="form-label small text-muted mb-1">Day of Week (Sun - Sat)</label>
                      <select
                        className="form-select form-select-sm"
                        value={paymentDayWeekly}
                        onChange={(e) => setPaymentDayWeekly(e.target.value)}
                      >
                        {weeklyDays.map((day) => (
                          <option key={`week-day-${day}`} value={day}>{day}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-1">
                <label className="form-label small text-muted mb-1">Payment Allocation Status</label>
                <select
                  className="form-select form-select-sm fw-medium text-uppercase text-dark"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="not_started">NOT STARTED</option>
                  <option value="unpaid">UNPAID</option>
                  <option value="paid">PAID</option>
                  <option value="skipped">SKIPPED</option>
                  <option value="delinquent">DELINQUENT</option>
                </select>
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Borrower Name</label>
            <input 
              type="text"
              className="form-control"
              placeholder="Enter borrower's full name"
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              required
              disabled={submitting || activeEntryId !== null}
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Lender Name</label>
            <input 
              type="text"
              className="form-control"
              placeholder="Enter lender's full name"
              value={lenderId}
              onChange={(e) => setLenderId(e.target.value)}
              required
              disabled={submitting || activeEntryId !== null}
            />
          </div>

          <div className="mb-4">
            <label className="form-label small fw-bold text-dark">Amount Borrowed</label>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted">₱</span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                placeholder="0.00"
                value={amountBorrowed}
                onChange={(e) => setAmountBorrowed(e.target.value)}
                required
                disabled={submitting || activeEntryId !== null}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Link href="/loans" className="btn btn-light border">
              {activeEntryId ? "Close" : "Cancel"}
            </Link>
            {!activeEntryId && (
              <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
                {submitting ? "Saving Entry..." : "Save Loan"}
              </button>
            )}
          </div>

        </form>
      </div>

      {/* Dynamic Installment Management Hub */}
      {transactionType === "installment_expense" && (
        <div className="card p-4 shadow-sm bg-white border border-info">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h5 className="fw-bold text-dark m-0">Installment Details</h5>
            <span className={`badge text-uppercase small px-2 py-1 ${
              paymentStatus === 'paid' ? 'bg-success' : 
              paymentStatus === 'not_started' ? 'bg-secondary text-white' : 
              paymentStatus === 'skipped' ? 'bg-warning text-dark' : 
              paymentStatus === 'delinquent' ? 'bg-danger text-white' : 'bg-danger-subtle text-danger'
            }`}>{paymentStatus.replace('_', ' ')}</span>
          </div>
          <p className="text-muted small mb-3">Timeline monitoring track and interactive term controls.</p>

          {!activeEntryId && (
            <div className="alert alert-warning py-2 small mb-3">
              ⚠️ Save the loan form above to activate payment processing tools.
            </div>
          )}

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
              onClick={() => setShowPaymentModal(true)}
              disabled={!activeEntryId || totalObligation === 0 || paymentStatus === 'paid'}
            >
              ➕ Add Payment
            </button>
            <button
              type="button"
              className="btn btn-outline-warning btn-sm flex-grow-1"
              onClick={handleSkipTermMock}
              disabled={!activeEntryId || paymentStatus === 'paid'}
            >
              ⏭️ Skip Term
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal Window */}
      {showPaymentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "380px" }}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header py-2 bg-dark text-white">
                <h6 className="modal-title m-0 fw-bold">Capture Payment Details</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
              </div>
              <form onSubmit={handleProcessPayment}>
                <div className="modal-body py-3">
                  <div className="mb-2">
                    <label className="form-label small fw-bold text-dark">Amount Tendered</label>
                    <div className="input-group">
                      <span className="input-group-text">₱</span>
                      <input 
                        type="number" 
                        className="form-control"
                        step="0.01" 
                        required 
                        placeholder={amountPerTerm > 0 ? amountPerTerm.toFixed(2) : "0.00"}
                        value={paymentAmountInput}
                        onChange={(e) => setPaymentAmountInput(e.target.value)}
                        max={totalObligation - amountPaid}
                        disabled={processingPayment}
                      />
                    </div>
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