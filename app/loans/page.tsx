export default function LoansPage() {
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

      {/* Table Skeleton */}
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
              {/* Empty state row */}
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  No loans yet. Add your first loan.
                </td>
              </tr>
            </tbody>

          </table>
        </div>

      </div>

    </div>
  )
}