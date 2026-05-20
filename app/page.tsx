export default function Dashboard() {
  return (
    <div className="container py-4">
      <h1 className="mb-4">Dashboard</h1>

      {/* Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3">
            <h6>Total Lent</h6>
            <h3>0</h3>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <h6>Remaining</h6>
            <h3>0</h3>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <h6>I Owe</h6>
            <h3>0</h3>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card p-3">
            <h6>People I Owe</h6>
            <h3>0</h3>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="alert alert-info">
        No loans yet. Click below to add your first loan.
      </div>

      <button className="btn btn-primary">
        Add First Loan
      </button>
    </div>
  )
}