"use client";

import { Item, Member, PaymentStatus } from "@/app/types/payments";

interface PaymentListProps {
  items: Item[];
  members: Member[];
  onStatusChange: (description: string, memberId: string, newStatus: PaymentStatus) => void;
}

const STATUS_STYLES: Record<PaymentStatus, { badge: string; label: string }> = {
  unpaid: { badge: "bg-danger-subtle text-danger border border-danger-subtle", label: "Unpaid" },
  partially_paid: { badge: "bg-warning-subtle text-warning border border-warning-subtle", label: "Partial" },
  paid: { badge: "bg-success-subtle text-success border border-success-subtle", label: "Paid" },
};

const NEXT_STATUS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ["partially_paid", "paid"],
  partially_paid: ["paid", "unpaid"],
  paid: ["unpaid"],
};

function StatusBadge({ status, onChange }: { status: PaymentStatus; onChange: (s: PaymentStatus) => void }) {
  const style = STATUS_STYLES[status];
  return (
    <div className="dropdown">
      <button
        className={`btn btn-sm badge border-0 py-1 px-2 dropdown-toggle ${style.badge}`}
        style={{ fontSize: "0.75rem", fontWeight: 600 }}
        data-bs-toggle="dropdown"
      >
        {style.label}
      </button>
      <ul className="dropdown-menu dropdown-menu-end shadow-sm" style={{ minWidth: 140 }}>
        {NEXT_STATUS[status].map((s) => (
          <li key={s}>
            <button className="dropdown-item small" onClick={() => onChange(s)}>
              Mark as <span className={`badge ms-1 ${STATUS_STYLES[s].badge}`}>{STATUS_STYLES[s].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PaymentList({ items, members, onStatusChange }: PaymentListProps) {
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  if (items.length === 0) {
    return (
      <div className="text-muted text-center py-4 small">
        No items yet. Click <strong>+ Add Item</strong> to get started.
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      {items.map((item) => (
        <div key={item.id} className="border rounded-3 overflow-hidden">
          <div className="d-flex justify-content-between align-items-start px-3 py-2 bg-light border-bottom">
            <div>
              <span className="fw-semibold text-dark">{item.description}</span>
              {item.notes && <div className="text-muted small">{item.notes}</div>}
            </div>
            <div className="text-end">
              <div className="fw-bold text-dark">₱{item.totalAmount.toFixed(2)}</div>
              <span className={`badge ${STATUS_STYLES[item.status].badge}`} style={{ fontSize: "0.7rem" }}>
                {STATUS_STYLES[item.status].label}
              </span>
            </div>
          </div>

          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th className="small text-secondary fw-semibold ps-3">Payee</th>
                <th className="small text-secondary fw-semibold text-end">Amount</th>
                <th className="small text-secondary fw-semibold text-end">Share</th>
                <th className="small text-secondary fw-semibold text-end pe-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {item.splits.map((split, idx) => (
                <tr key={idx}>
                  <td className="ps-3 align-middle">{memberMap[split.memberId] || split.memberId}</td>
                  <td className="text-end align-middle fw-semibold">₱{split.amount.toFixed(2)}</td>
                  <td className="text-end align-middle text-muted small">{split.percentage.toFixed(1)}%</td>
                  <td className="text-end align-middle pe-3">
                    <StatusBadge
                      status={split.status}
                      onChange={(newStatus) => onStatusChange(item.description, split.memberId, newStatus)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}