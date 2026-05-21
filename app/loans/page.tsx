import React from "react"
import PaymentAllocation from "./paymentAllocation"

export default function LoansPage() {

  const entries = [
    {
      id: 1,
      ref_id: "LN-001",
      name: "Personal Loan",
      borrower: "John",
      lender: "Maria",
      amount: 5000,
      remaining: 2000,
      date: "2026-05-21",
      status: "Active",
      transaction_type: "group_expense",
    },
  ]

  return (
    <div className="container py-4">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Loans</h1>

        <button className="btn btn-primary">
          + Add Loan
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card p-3 mb-3">
        <div className="row g-2">

          <div className="col-md-6">
            <input
              className="form-control"
              placeholder="Search loans..."
            />
          </div>

          <div className="col-md-6 d-flex gap-2">
            <button className="btn btn-outline-secondary">
              All
            </button>

            <button className="btn btn-outline-secondary">
              I Lent
            </button>

            <button className="btn btn-outline-secondary">
              I Borrowed
            </button>
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="card p-3">

        <div className="table-responsive">
          <table className="table table-hover">

            <thead>
              <tr>
                <th>Ref ID</th>
                <th>Entry Name</th>
                <th>Borrower</th>
                <th>Lender</th>
                <th>Amount</th>
                <th>Remaining</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              {entries.map((entry) => (
                <React.Fragment key={entry.id}>

                  <tr>
                    <td>{entry.ref_id}</td>
                    <td>{entry.name}</td>
                    <td>{entry.borrower}</td>
                    <td>{entry.lender}</td>
                    <td>{entry.amount}</td>
                    <td>{entry.remaining}</td>
                    <td>{entry.date}</td>
                    <td>{entry.status}</td>
                  </tr>

                  {entry.transaction_type === "group_expense" && (
                    <tr>
                      <td colSpan={8}>
                        <PaymentAllocation />
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              ))}

            </tbody>

          </table>
        </div>

      </div>

    </div>
  )
}