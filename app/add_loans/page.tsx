'use client'

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/services/supabase"
import { getContacts } from "@/services/contacts"

export default function AddLoansPage() {
  const router = useRouter()

  // Form Field States
  const [entryName, setEntryName] = useState("")
  const [borrowerId, setBorrowerId] = useState("")
  const [lenderId, setLenderId] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")
  
  // System State
  const [contacts, setContacts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

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

      // 1. Generate the mandatory unique reference ID matching your team's format: LN-<timestamp>
      const generatedRefId = `LN-${Date.now()}`

      // 2. Submit to 'entries' matching all strict database constraints perfectly
      const { error } = await supabase
        .from("entries") 
        .insert([
          {
            ref_id: generatedRefId,               // Satisfies the NON-NULLABLE constraint
            entry_name: entryName.trim(),
            description: entryName.trim(),        // Backfills description column safely
            transaction_type: "group_expense",    // Matches exact constraint token lowercase
            borrower_id: borrowerId, 
            lender_id: lenderId,    
            amount_borrowed: parsedAmount,
            amount_remaining: parsedAmount, 
            status: "unpaid",                     // Fixed: Matches exact constraint token lowercase
            date_borrowed: new Date().toISOString().split('T')[0] // Formats safely to YYYY-MM-DD
          }
        ])

      if (error) {
        console.error("Supabase Database Insert Error:", error.message)
        alert(`Failed to save loan: ${error.message}`)
        return
      }

      // Redirect back to the loans dashboard pipeline on success
      router.push("/loans")
      router.refresh()
    } catch (err: any) {
      console.error("Database exception thrown during transaction creation:", err)
      alert("Failed to submit new loan ledger item record.")
    } finally {
      setSubmitting(false)
    }
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
      <div className="card p-4 shadow-sm">
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

          {/* Borrower Dropdown */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-dark">Borrower (Who owes the money?)</label>
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
            <label className="form-label small fw-bold text-dark">Lender (Who provided the funds?)</label>
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

    </div>
  )
}