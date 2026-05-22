"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/services/supabase"

export default function LoansPage() {
  // Main Data States
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Drill-Down / Details States
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Interactive Payment Sandbox Management States
  const [amountPaid, setAmountPaid] = useState<number>(0)
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  // Inline Editable Note States
  const [editableNotes, setEditableNotes] = useState("")
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Form Field Capture States for Adding Specific Payment Details
  const [payDateInput, setPayDateInput] = useState("")
  const [paymentAmountInput, setPaymentAmountInput] = useState("")
  const [payeeInput, setPayeeInput] = useState("")
  const [proofInput, setProofInput] = useState("")
  const [paymentNotesInput, setPaymentNotesInput] = useState("")

  // Fetch all loan ledger items on initial mount
  useEffect(() => {
    fetchLoansList()
  }, [])

  async function fetchLoansList() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("entries")
        .select(`
          id,
          ref_id,
          entry_name,
          transaction_type,
          date_borrowed,
          amount_borrowed,
          amount_remaining,
          status,
          notes,
          borrower:borrower_id(name),
          lender:lender_id(name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (err: any) {
      console.error("Supabase entries fetch error:", err.message)
    } finally {
      setLoading(false)
    }
  }

  // UI Extraction Formatting Utilities
  const getContactName = (contactField: any) => {
    if (!contactField) return "Unknown"
    return Array.isArray(contactField) ? contactField[0]?.name : contactField?.name
  }

  // Handle Drilling Into Details Matrix
  const handleViewDetails = async (entryId: string) => {
    try {
      setDetailsLoading(true)
      setSelectedEntryId(entryId)

      const entryMatch = entries.find(e => e.id === entryId)
      if (!entryMatch) return
      setSelectedEntry(entryMatch)
      setEditableNotes(entryMatch.notes || "")

      const baseBorrowed = Number(entryMatch.amount_borrowed) || 0
      const baseRemaining = Number(entryMatch.amount_remaining) || 0
      setAmountPaid(Math.max(baseBorrowed - baseRemaining, 0))
      setPaymentStatus(entryMatch.status || "unpaid")

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("installments")
        .select("*")
        .eq("entry_id", entryId)
        .order("due_date", { ascending: true })

      if (!scheduleError && scheduleData) {
        setInstallments(scheduleData)
      } else {
        setInstallments([])
      }

      setPaymentHistory([
        {
          id: "p-001",
          payment_date: entryMatch.date_borrowed || "2026-01-15",
          amount: Math.max(baseBorrowed - baseRemaining, 0) > 0 ? (baseBorrowed - baseRemaining) * 0.4 : 0,
          payee: getContactName(entryMatch.borrower), // Default payee to single borrower if loaded initially
          proof: "OR-982341",
          notes: "Initial clearing term setup allocation"
        }
      ].filter(p => p.amount > 0))

    } catch (err: any) {
      console.error("Error reading entry schedule metrics:", err.message)
    } finally {
      setDetailsLoading(false)
    }
  }

  // Persist updated general ledger notes back to Supabase instance database
  const handleUpdateNotes = async () => {
    if (!selectedEntryId) return
    try {
      setIsSavingNotes(true)
      const { error } = await supabase
        .from("entries")
        .update({ notes: editableNotes })
        .eq("id", selectedEntryId)

      if (error) throw error
      
      setEntries(prev => prev.map(item => item.id === selectedEntryId ? { ...item, notes: editableNotes } : item))
      if (selectedEntry) {
        setSelectedEntry({ ...selectedEntry, notes: editableNotes })
      }
      alert("Notes updated successfully!")
    } catch (err: any) {
      console.error("Failed to commit updated internal database note adjustments:", err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Process dynamic additions to tracking layout list variables
  const handleProcessPaymentMock = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(paymentAmountInput)
    if (!parsedAmount || parsedAmount <= 0) return

    const totalCalculatedPaid = amountPaid + parsedAmount
    setAmountPaid(totalCalculatedPaid)
    
    const targetPayloadRow = {
      id: `p-${Date.now()}`,
      payment_date: payDateInput || new Date().toISOString().split('T')[0],
      amount: parsedAmount,
      payee: payeeInput || getContactName(selectedEntry?.borrower),
      proof: proofInput || "N/A",
      notes: paymentNotesInput || "No secondary transaction notes attached."
    }

    setPaymentHistory(prev => [...prev, targetPayloadRow])

    if (totalCalculatedPaid >= (Number(selectedEntry?.amount_borrowed) || 0)) {
      setPaymentStatus("paid")
    } else {
      setPaymentStatus("partially_paid")
    }

    setShowPaymentModal(false)
    setPayDateInput("")
    setPaymentAmountInput("")
    setPayeeInput("")
    setProofInput("")
    setPaymentNotesInput("")
  }

  const handleSkipTermMock = () => {
    setPaymentStatus("skipped")
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case "paid": return "bg-success-subtle text-success border-success-subtle"
      case "partially_paid": return "bg-warning-subtle text-warning-emphasis border-warning-subtle"
      case "not_started": return "bg-secondary-subtle text-secondary border-secondary-subtle"
      case "skipped": return "bg-info-subtle text-info-emphasis border-info-subtle"
      case "delinquent": return "bg-danger-subtle text-danger border-danger-subtle animate-pulse"
      default: return "bg-danger-subtle text-danger border-danger-subtle"
    }
  }

  const totalObligation = Number(selectedEntry?.amount_borrowed) || 0
  const calculationPercentage = totalObligation > 0 ? Math.min(Math.round((amountPaid / totalObligation) * 100), 100) : 0
  
  const paymentTermsCount = installments.length > 0 ? installments.length : 12
  const amountPerTerm = totalObligation > 0 ? (totalObligation / paymentTermsCount) : 0
  const derivedStartDate = installments.length > 0 ? installments[0].due_date : selectedEntry?.date_borrowed

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading Ledger...</span>
        </div>
      </div>
    )
  }

  // SCREEN B: DETAILED DRILL-DOWN CONTAINER INTERFACE
  if (selectedEntryId && selectedEntry) {
    return (
      <div className="container py-4" style={{ maxWidth: "760px" }}>
        
        {/* Back Navigation Bar */}
        <div className="mb-3">
          <button 
            onClick={() => { setSelectedEntryId(null); setSelectedEntry(null); }} 
            className="btn btn-link p-0 text-decoration-none text-secondary"
          >
            &larr; Back to Loans List
          </button>
        </div>

        {detailsLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-info small" />
          </div>
        ) : (
          <>
            {/* Overview Summary Base Card */}
            <div className="card p-4 shadow-sm border-0 mb-4 bg-white">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span className="badge bg-light text-dark border small text-uppercase mb-1">{selectedEntry.ref_id}</span>
                  <h3 className="fw-bold m-0 text-dark">{selectedEntry.entry_name}</h3>
                </div>
                <span className={`badge text-uppercase px-2 py-1 ${
                  paymentStatus === "paid" ? "bg-success" :
                  paymentStatus === "not_started" ? "bg-secondary" :
                  paymentStatus === "skipped" ? "bg-warning text-dark" : "bg-danger"
                }`}>
                  {paymentStatus.replace("_", " ")}
                </span>
              </div>
              <p className="text-muted small text-capitalize mb-4">
                Type: {selectedEntry.transaction_type.replace("_", " ")} &bull; Logged on {selectedEntry.date_borrowed || "N/A"}
              </p>

              <div className="row g-3 p-3 bg-light rounded text-dark small">
                <div className="col-sm-6">
                  <span className="text-muted d-block mb-0.5">Borrower</span>
                  <strong className="fs-6">{getContactName(selectedEntry.borrower)}</strong>
                </div>
                <div className="col-sm-6">
                  <span className="text-muted d-block mb-0.5">Lender</span>
                  <strong className="fs-6">{getContactName(selectedEntry.lender)}</strong>
                </div>
                <hr className="my-2 opacity-10" />
                <div className="col-sm-6">
                  <span className="text-muted d-block mb-0.5">Total Amount Borrowed</span>
                  <span className="fw-bold fs-5 text-dark">₱{totalObligation.toFixed(2)}</span>
                </div>
                <div className="col-sm-6">
                  <span className="text-muted d-block mb-0.5">Calculated Balance Remaining</span>
                  <span className="fw-bold fs-5 text-danger">₱{Math.max(totalObligation - amountPaid, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* DYNAMIC HUB METRICS TRACKER & INTERACTIVE SANDBOX BUTTONS */}
            {selectedEntry.transaction_type === "installment_expense" && (
              <div className="card p-4 shadow-sm bg-white border border-info mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="fw-bold text-dark m-0">Installment Monitoring Hub</h5>
                  <span className="badge bg-info text-dark small text-uppercase px-2">Active Schedule</span>
                </div>
                <p className="text-muted small mb-3">Timeline monitoring track and interactive term controls.</p>

                <div className="row g-3 bg-light p-3 rounded text-dark small mb-3 border-start border-info border-3">
                  <div className="col-sm-4 col-6">
                    <span className="text-muted d-block small mb-0.5">Start Date</span>
                    <span className="fw-semibold text-dark">{derivedStartDate || "Not Set"}</span>
                  </div>
                  <div className="col-sm-4 col-6">
                    <span className="text-muted d-block small mb-0.5">Payment Terms</span>
                    <span className="fw-semibold text-dark">{paymentTermsCount} Payments</span>
                  </div>
                  <div className="col-sm-4 col-12">
                    <span className="text-muted d-block small mb-0.5">Term Value Rate</span>
                    <span className="fw-semibold text-dark">₱{amountPerTerm.toFixed(2)} / term</span>
                  </div>
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
                    />
                  </div>
                  <div className="d-flex justify-content-between text-muted small mt-1" style={{ fontSize: '11px' }}>
                    <span>Settled: ₱{amountPaid.toFixed(2)}</span>
                    <span>Target: ₱{totalObligation.toFixed(2)}</span>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm flex-grow-1"
                    onClick={() => {
                      setPayDateInput(new Date().toISOString().split('T')[0]);
                      setPaymentAmountInput(amountPerTerm > 0 ? amountPerTerm.toFixed(2) : "");
                      // Dynamic Autofill Logic: Sets payee to the specific single borrower
                      setPayeeInput(getContactName(selectedEntry?.borrower));
                      setShowPaymentModal(true);
                    }}
                    disabled={paymentStatus === 'paid' || paymentStatus === 'not_started'}
                  >
                    ➕ Add Payment
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-sm flex-grow-1"
                    onClick={handleSkipTermMock}
                    disabled={paymentStatus === 'paid' || paymentStatus === 'not_started'}
                  >
                    ⏭️ Skip Term
                  </button>
                </div>
              </div>
            )}

            {/* DYNAMIC EDITABLE GENERAL NOTES CARD */}
            <div className="card p-4 shadow-sm bg-white border-0 mb-4">
              <h5 className="fw-bold text-dark mb-2">Loan File Notes</h5>
              <p className="text-muted small mb-2">Append updates or specific general compliance markers below.</p>
              <div className="mb-2">
                <textarea
                  className="form-control small text-dark"
                  rows={3}
                  placeholder="No general log file notes provided for this setup file asset profile."
                  value={editableNotes}
                  onChange={(e) => setEditableNotes(e.target.value)}
                />
              </div>
              <div className="text-end">
                <button
                  type="button"
                  className="btn btn-dark btn-sm px-3"
                  onClick={handleUpdateNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? "Saving Changes..." : "Save Loan Notes"}
                </button>
              </div>
            </div>

            {/* PAYMENT HISTORY DETAIL TABLE */}
            <div className="card p-4 shadow-sm bg-white border-0 mb-4">
              <h5 className="fw-bold text-dark mb-1">Payment History Log</h5>
              <p className="text-muted small mb-3">Itemized historical breakdown of incoming funds and transaction payloads.</p>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle small mb-0">
                  <thead>
                    <tr className="table-light text-muted">
                      <th>Payment Date</th>
                      <th className="text-end">Payment Amount</th>
                      <th>Payee</th>
                      <th>Proof Reference</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No captured collection clearing receipts available.
                        </td>
                      </tr>
                    ) : (
                      paymentHistory.map((pay: any) => (
                        <tr key={pay.id}>
                          <td className="fw-medium text-dark">{pay.payment_date}</td>
                          <td className="text-end fw-bold text-success">₱{Number(pay.amount).toFixed(2)}</td>
                          <td className="text-dark">{pay.payee}</td>
                          <td>
                            <span className="badge bg-light text-secondary border font-monospace">{pay.proof}</span>
                          </td>
                          <td className="text-muted text-wrap" style={{ maxWidth: "200px" }}>{pay.notes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GENERATED INSTALLMENT SCHEDULE MATRIX DATATABLE */}
            {selectedEntry.transaction_type === "installment_expense" && installments.length > 0 && (
              <div className="card p-4 shadow-sm bg-white border-0">
                <h5 className="fw-bold text-dark mb-3">Generated Installment Schedule</h5>
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle small mb-0">
                    <thead>
                      <tr className="table-light text-muted">
                        <th>Installment ID</th>
                        <th>Due Date</th>
                        <th className="text-end">Amount Due</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst: any, idx: number) => (
                        <tr key={inst.id || idx}>
                          <td><span className="font-monospace text-secondary">#{idx + 1}</span></td>
                          <td className="fw-medium text-dark">{inst.due_date}</td>
                          <td className="text-end fw-bold text-dark">₱{Number(inst.amount).toFixed(2)}</td>
                          <td className="text-center">
                            <span className={`badge px-2 py-0.5 small ${
                              inst.status === 'paid' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'
                            }`}>
                              {inst.status || 'unpaid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* DETAILS ENTRY PAYMENT MODAL */}
        {showPaymentModal && (
          <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "420px" }}>
              <div className="modal-content border-0 shadow">
                <div className="modal-header py-2 bg-dark text-white">
                  <h6 className="modal-title m-0 fw-bold">Payment Details</h6>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
                </div>
                <form onSubmit={handleProcessPaymentMock}>
                  <div className="modal-body py-3 text-dark small">
                    
                    {/* Row 1: Date & Amount Fields */}
                    <div className="row g-2 mb-2">
                      <div className="col-6">
                        <label className="form-label mb-1 fw-semibold">Payment Date</label>
                        <input 
                          type="date" 
                          className="form-control form-control-sm" 
                          required
                          value={payDateInput} 
                          onChange={(e) => setPayDateInput(e.target.value)} 
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label mb-1 fw-semibold">Payment Amount</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            className="form-control"
                            step="0.01" 
                            required 
                            max={totalObligation - amountPaid}
                            value={paymentAmountInput}
                            onChange={(e) => setPaymentAmountInput(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Payee Field (Defaults to Borrower Name) */}
                    <div className="mb-2">
                      <label className="form-label mb-1 fw-semibold">Payee</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="e.g. Juan Dela Cruz / Bank Channel" 
                        required
                        value={payeeInput}
                        onChange={(e) => setPayeeInput(e.target.value)}
                      />
                    </div>

                    {/* Row 3: Proof Field */}
                    <div className="mb-2">
                      <label className="form-label mb-1 fw-semibold">Proof of Payment</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="e.g. Reference Ref#, URL link, Check ID"
                        required
                        value={proofInput}
                        onChange={(e) => setProofInput(e.target.value)}
                      />
                    </div>

                    {/* Row 4: Specific Transaction Notes */}
                    <div>
                      <label className="form-label mb-1 fw-semibold">Transaction Notes</label>
                      <textarea 
                        className="form-control form-control-sm" 
                        rows={2}
                        placeholder="Add secondary receipt notes..."
                        value={paymentNotesInput}
                        onChange={(e) => setPaymentNotesInput(e.target.value)}
                      />
                    </div>

                  </div>
                  <div className="modal-footer p-2 bg-light">
                    <button type="button" className="btn btn-sm btn-light border" onClick={() => setShowPaymentModal(false)}>Close</button>
                    <button type="submit" className="btn btn-sm btn-primary px-3">Post Transaction</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // SCREEN A: MAIN LOANS INDEX TABLE COMPONENT (Default View Screen)
  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fw-bold text-dark">Loans Ledger</h1>
        <Link href="/add_loans" className="btn btn-primary fw-medium">
          + Add Loan
        </Link>
      </div>

      <div className="card p-3 shadow-sm border-0 bg-white">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-secondary small text-uppercase">
                <th>Ref ID</th>
                <th>Entry Name</th>
                <th>Borrower</th>
                <th>Lender</th>
                <th className="text-end">Borrowed</th>
                <th className="text-end">Remaining</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4">
                    No records found in entries database.
                  </td>
                </tr>
              ) : (
                entries.map((entry: any) => (
                  <tr key={entry.id}>
                    <td><strong className="text-dark">{entry.ref_id}</strong></td>
                    <td>
                      <span className="fw-medium text-dark">{entry.entry_name}</span>
                      <small className="d-block text-muted text-capitalize" style={{ fontSize: '11px' }}>
                        {entry.transaction_type.replace('_', ' ')}
                      </small>
                    </td>
                    <td className="text-dark">{getContactName(entry.borrower)}</td>
                    <td className="text-dark">{getContactName(entry.lender)}</td>
                    <td className="text-end fw-medium text-dark">₱{Number(entry.amount_borrowed).toFixed(2)}</td>
                    <td className="text-end fw-bold text-danger">₱{Number(entry.amount_remaining).toFixed(2)}</td>
                    <td className="text-muted small">{entry.date_borrowed || "N/A"}</td>
                    <td>
                      <span className={`badge border px-2 py-1 text-capitalize ${getStatusClass(entry.status)}`}>
                        {entry.status ? entry.status.replace('_', ' ') : "unpaid"}
                      </span>
                    </td>
                    <td className="text-end">
                      <button 
                        onClick={() => handleViewDetails(entry.id)} 
                        className="btn btn-sm btn-outline-dark"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}