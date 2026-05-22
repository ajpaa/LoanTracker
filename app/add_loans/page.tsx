// app/add_loans/page.tsx
import React from "react"
import Link from "next/link"

export default function AddLoansPage() {
  return (
    <div className="container py-4">
      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary">
          &larr; Back to Loans List
        </Link>
      </div>
      
      <div className="card p-4 shadow-sm">
        <h3>Add New Loan Entry</h3>
        <p className="text-muted">Form fields to create a new loan will go here.</p>
      </div>
    </div>
  )
}