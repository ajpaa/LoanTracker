import {
  Item,
  Member,
} from "@/app/types/payments";

type Props = {
  items: Item[];
  members: Member[];
};

export default function PaymentList({
  items,
  members,
}: Props) {
  return (
    <div className="d-flex flex-column gap-3">

      {items.map((item) => (
        <div key={item.id} className="card">

          {/* HEADER */}
          <div className="card-header fw-semibold d-flex justify-content-between">
            <span>{item.description}</span>
            <span className="text-muted">
              ₱{item.totalAmount.toFixed(2)}
            </span>
          </div>

          <div className="card-body">

            {/* NOTES (NEW) */}
            {item.notes && (
              <div className="mb-2 text-muted small">
                📝 {item.notes}
              </div>
            )}

            {/* SPLITS */}
            {item.splits.length === 0 && (
              <div className="text-muted">
                No allocations yet
              </div>
            )}

            {item.splits.map((s, index) => {
              const member = members.find(
                (m) => m.id === s.memberId
              );

              return (
                <div
                  key={`${s.memberId}-${index}`}
                  className="d-flex justify-content-between align-items-center py-1"
                >

                  {/* MEMBER NAME */}
                  <span>
                    {member?.name || "Unknown"}
                  </span>

                  {/* RIGHT SIDE */}
                  <div className="text-end">

                    {/* AMOUNT */}
                    <div>
                      ₱{s.amount.toFixed(2)}
                    </div>

                    {/* PERCENT (NEW OPTIONAL FIELD) */}
                    {"percent" in s && s.percent !== undefined && (
                      <small className="text-muted">
                        {s.percent}%
                      </small>
                    )}

                  </div>

                </div>
              );
            })}

          </div>

        </div>
      ))}

    </div>
  );
}