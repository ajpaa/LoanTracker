// app/loans/page.tsx
import React from "react"
import Link from "next/link"
import { supabase } from "@/services/supabase"

async function getLoansList() {
  // Pull entries and join the borrower/lender names from the contacts relation
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
      borrower:borrower_id(name),
      lender:lender_id(name)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Supabase entries fetch error:", error.message)
    return []
  }
  return data
}

export default async function LoansPage() {
  const entries = await getLoansList()

  // Helper to safely extract joined contact names
  const getContactName = (contactField: any) => {
    if (!contactField) return "Unknown"
    return Array.isArray(contactField) ? contactField[0]?.name : contactField?.name
  }

  // Helper to give status clean badges matching your checklist constraints
  const getStatusClass = (status: string) => {
    switch (status) {
      case "paid": return "bg-success-subtle text-success border-success-subtle"
      case "partially_paid": return "bg-warning-subtle text-warning-emphasis border-warning-subtle"
      default: return "bg-danger-subtle text-danger border-danger-subtle"
    }
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Loans Ledger</h1>
        <Link href="/add_loans" className="btn btn-primary">
          + Add Loan
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="card p-3 mb-3 shadow-sm border-0 bg-white">
        <div className="row g-2">
          <div className="col-md-6">
            <input className="form-control" placeholder="Search entries..." />
          </div>
          <div className="col-md-6 d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm">All</button>
            <button className="btn btn-outline-secondary btn-sm">I Lent</button>
            <button className="btn btn-outline-secondary btn-sm">I Borrowed</button>
          </div>
        </div>
      </div>

      {/* Table Card */}
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
                      <span className="fw-medium">{entry.entry_name}</span>
                      <small className="d-block text-muted text-capitalize" style={{ fontSize: '11px' }}>
                        {entry.transaction_type.replace('_', ' ')}
                      </small>
                    </td>
                    <td>{getContactName(entry.borrower)}</td>
                    <td>{getContactName(entry.lender)}</td>
                    <td className="text-end fw-medium">₱{Number(entry.amount_borrowed).toFixed(2)}</td>
                    <td className="text-end fw-bold text-danger">₱{Number(entry.amount_remaining).toFixed(2)}</td>
                    <td className="text-muted small">{entry.date_borrowed || "N/A"}</td>
                    <td>
                      <span className={`badge border px-2 py-1 text-capitalize ${getStatusClass(entry.status)}`}>
                        {entry.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      {/* Using the unique DB entries.id for robust routing */}
                      <Link href={`/loans/${entry.id}`} className="btn btn-sm btn-outline-dark">
                        View Details
                      </Link>
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