"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/services/supabase"
import { getContacts } from "@/services/contacts"

export default function AddLoansPage() {
  const router = useRouter()

  // Form Field States
  const [entryName, setEntryName] = useState("")
  const [transactionType, setTransactionType] = useState("installment_expense");
  const [borrowerId, setBorrowerId] = useState("")
  const [lenderId, setLenderId] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")
  
  // Installment Specific Fields
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paymentFrequency, setPaymentFrequency] = useState("Monthly")
  const [paymentDayMonthly, setPaymentDayMonthly] = useState("1") // Default to 1st of the month
  const [paymentDayWeekly, setPaymentDayWeekly] = useState("Sunday") // Default to Sunday
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState("12")
  
  // Installment UI Tracking Simulation States
  const [amountPaid, setAmountPaid] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmountInput, setPaymentAmountInput] = useState("")

  // System State
  const [contacts, setContacts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Calculate live dynamic totals for progress bar elements
  const totalObligation = parseFloat(amountBorrowed) || 0
  const calculationPercentage = totalObligation > 0 ? Math.min(Math.round((amountPaid / totalObligation) * 100), 100) : 0
  const installmentsTotalTerms = parseInt(paymentTerms) || 12
  const amountPerTerm = totalObligation > 0 ? (totalObligation / installmentsTotalTerms) : 0

  // Generate an array of strings representing 1st to 28th days for select parameters
  const monthlyDays = Array.from({ length: 28 }, (_, i) => (i + 1).toString())
  
  // Weekly days sequence setup array
  const weeklyDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  // Fetch registered directory data using the service helper
  useEffect(() => {
    async function loadContacts() {
      try {
        const data = await getContacts()
        if (data) {
          setContacts(data)
        }
      } catch (err) {
        console.error("Error retrieving system contact profiles via service:", err)
      }
    }
    loadContacts()
  }, [])

  // Auto-evaluate "NOT STARTED" state when Start Date shifts into the future
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (transactionType === "installment_expense" && startDate > todayStr) {
      setPaymentStatus("not_started")
    } else if (transactionType === "installment_expense" && paymentStatus === "not_started" && startDate <= todayStr) {
      setPaymentStatus("unpaid")
    }
  }, [startDate, transactionType])

  // Handle Form Submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entryName.trim() || !borrowerId || !lenderId || !amountBorrowed) {
      alert("Please populate all form parameters before executing query.")
      return
    }

    try {
      setSubmitting(true)
      const parsedAmount = parseFloat(amountBorrowed)
      const generatedRefId = `LN-${Date.now()}`

      // 1. Build base payload strictly using columns that exist on 'entries'
      const basePayload: any = {
        ref_id: generatedRefId,
        entry_name: entryName.trim(),
        description: entryName.trim(),
        transaction_type: transactionType,
        borrower_id: borrowerId, 
        lender_id: lenderId,    
        amount_borrowed: parsedAmount,
        amount_remaining: Math.max(parsedAmount - amountPaid, 0), 
        status: paymentStatus.toLowerCase(), 
        date_borrowed: new Date().toISOString().split('T')[0]
      }

      // Insert base entry and select it back to get the database generated ID
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

      // 2. If it's an installment, trigger your Postgres function via RPC
      if (transactionType === "installment_expense" && createdEntry) {
        const recurrenceDayValue = paymentFrequency === "Monthly" 
          ? paymentDayMonthly 
          : paymentDayWeekly

        const { error: rpcError } = await supabase.rpc("generate_installment_schedule", {
          p_entry_id: createdEntry.id,
          p_start_date: startDate,
          p_frequency: paymentFrequency.toLowerCase(), // matches 'monthly' or 'weekly'
          p_recurrence_day: recurrenceDayValue,        // passing '1'-'28' or Day string
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

      router.push("/loans")
      router.refresh()
    } catch (err: any) {
      console.error("Database exception thrown during transaction creation:", err)
      alert("Failed to submit new loan ledger item record.")
    } finally {
      setSubmitting(false)
    }
  }

  // Handle dynamic sandbox changes for collecting mock payments
  const handleProcessPaymentMock = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedInput = parseFloat(paymentAmountInput)
    if (!parsedInput || parsedInput <= 0) return

    const totalCalculatedPaid = amountPaid + parsedInput
    setAmountPaid(totalCalculatedPaid)
    
    if (totalCalculatedPaid >= totalObligation) {
      setPaymentStatus("paid")
    }

    setShowPaymentModal(false)
    setPaymentAmountInput("")
  }

  const handleSkipTermMock = () => {
    setPaymentStatus("skipped")
  }

  return (
    <div className="container py-4" style={{ maxWidth: "600px" }}>
      
      {/* Back Button Navigation */}
      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary">
          &larr; Back to Loans List
        </Link>
      </div>
      
      {/* Form Input Block */}
      <div className="card p-4 shadow-sm mb-4">
        <h3 className="fw-bold mb-1">Add New Loan Entry</h3>
        <p className="text-muted small mb-4">Log a shared liability item or transaction balancing record.</p>

        <form onSubmit={handleSubmit}>
          
          {/* Entry Name */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Entry Name / Description</label>
            <input 
              type="text"
              className="form-control"
              placeholder="e.g., Lunch bill split, Groceries, Cash advance"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* Transaction Type Picker Option */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Transaction Type</label>
            <select
              className="form-select text-capitalize"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="straight_expense">Straight Expense</option>
              <option value="installment_expense">Installment Expense</option>
              <option value="group_expense">Group Expense</option>
            </select>
          </div>

          {/* Conditional Layout Section for Installment Parameters */}
          {transactionType === "installment_expense" && (
            <div className="p-3 bg-light rounded border mb-3">
              <h6 className="fw-bold text-secondary mb-3 small text-uppercase tracking-wider">Installment Details</h6>
              
              <div className="row g-2">
                {/* Start Date */}
                <div className="col-sm-6 mb-2">
                  <label className="form-label small text-muted mb-1">Start Date</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {/* Total Terms */}
                <div className="col-sm-6 mb-2">
                  <label className="form-label small text-muted mb-1">Payment Terms (Count)</label>
                  <input 
                    type="number" 
                    className="form-control form-control-sm"
                    min="1"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Payment Frequency Toggles */}
              <div className="row g-2 mb-2">
                <div className="col-sm-6">
                  <label className="form-label small text-muted mb-1">Payment Frequency</label>
                  <select
                    className="form-select form-select-sm"
                    value={paymentFrequency}
                    onChange={(e) => setPaymentFrequency(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>

                {/* Dynamic Inline Supported Values Target Selection row */}
                <div className="col-sm-6">
                  {paymentFrequency === "Monthly" ? (
                    <>
                      <label className="form-label small text-muted mb-1">Day of Month (1st - 28th)</label>
                      <select
                        className="form-select form-select-sm"
                        value={paymentDayMonthly}
                        onChange={(e) => setPaymentDayMonthly(e.target.value)}
                        disabled={submitting}
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
                        disabled={submitting}
                      >
                        {weeklyDays.map((day) => (
                          <option key={`week-day-${day}`} value={day}>{day}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Enhanced Payment Allocation Status to reflect custom business logic */}
              <div className="mb-1">
                <label className="form-label small text-muted mb-1">Payment Allocation Status</label>
                <select
                  className="form-select form-select-sm fw-medium text-uppercase text-dark"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  disabled={submitting}
                >
                  <option value="not_started">NOT STARTED (System date &lt; Start Date)</option>
                  <option value="unpaid">UNPAID (Borrower has not yet paid for term)</option>
                  <option value="paid">PAID (Borrower has settled term)</option>
                  <option value="skipped">SKIPPED (Term manually bypassed)</option>
                  <option value="delinquent">DELINQUENT (Term has lapsed without payment)</option>
                </select>
              </div>
            </div>
          )}

          {/* Borrower Dropdown */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Borrower</label>
            <select 
              className="form-select"
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="">-- Choose Borrower --</option>
              {contacts.map((person) => {
                const idKey = person.contact_id || person.id
                return (
                  <option key={`borrower-${idKey}`} value={idKey}>
                    {person.name}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Lender Dropdown */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Lender</label>
            <select 
              className="form-select"
              value={lenderId}
              onChange={(e) => setLenderId(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="">-- Choose Lender --</option>
              {contacts.map((person) => {
                const idKey = person.contact_id || person.id
                return (
                  <option key={`lender-${idKey}`} value={idKey}>
                    {person.name}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Amount Field */}
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
                disabled={submitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="d-flex justify-content-end gap-2">
            <Link href="/loans" className="btn btn-light border">
              Cancel
            </Link>
            <button 
              type="submit" 
              className="btn btn-primary px-4" 
              disabled={submitting}
            >
              {submitting ? "Saving Entry..." : "Save Loan"}
            </button>
          </div>

        </form>
      </div>

      {/* Payment Backdrop Modal */}
      {showPaymentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "380px" }}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header py-2 bg-dark text-white">
                <h6 className="modal-title m-0 fw-bold">Capture Payment Details</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
              </div>
              <form onSubmit={handleProcessPaymentMock}>
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
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer p-2 bg-light">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setShowPaymentModal(false)}>Close</button>
                  <button type="submit" className="btn btn-sm btn-primary">Add Payment</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}