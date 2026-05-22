"use client";

import { useEffect, useMemo, useState } from "react";
import AddItemForm from "@/app/components/payment/addItemForm";
import PaymentList from "@/app/components/payment/paymentList";
import { Item, Member, PaymentStatus } from "@/app/types/payments";
import { supabase } from "@/services/supabase";

interface PaymentAllocationProps {
  loanId: string;
  transactionType: string;
  borrowerId?: string;
  amountBorrowed?: number;
}

export default function PaymentAllocation({
  loanId,
  transactionType,
  borrowerId = "",
  amountBorrowed = 0,
}: PaymentAllocationProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPayeeId, setPaymentPayeeId] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  // PAYMENT TRACKING
  const [amountPaid, setAmountPaid] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const remainingBalance = Math.max(amountBorrowed - amountPaid, 0);

  const paymentProgress =
    amountBorrowed > 0
      ? Math.min(Math.round((amountPaid / amountBorrowed) * 100), 100)
      : 0;
  const isGroupExpense = transactionType === "group_expense";

  async function loadMembers() {
    if (!borrowerId) { setMembers([]); return; }
    setLoadingMembers(true);
    setDbError(null);
    try {
      const { data: contact, error: e0 } = await supabase
        .from("contacts")
        .select("group_ref")
        .eq("contact_id", borrowerId)
        .single();

      if (e0) throw e0;

      const actualGroupId = contact?.group_ref;
      if (!actualGroupId) {
        setDbError("This contact has no linked group.");
        setMembers([]);
        return;
      }

      const { data: memberships, error: e1 } = await supabase
        .from("group_memberships")
        .select("member_id")
        .eq("group_id", actualGroupId);

      if (e1) throw e1;
      if (!memberships?.length) { setMembers([]); return; }

      const ids = memberships.map((r: any) => r.member_id);

      const { data: contacts, error: e2 } = await supabase
        .from("contacts")
        .select("contact_id, name")
        .in("contact_id", ids);

      if (e2) throw e2;
      setMembers((contacts ?? []).map((c: any) => ({ id: c.contact_id, name: c.name })));
    } catch (err: any) {
      setDbError(err.message || "Failed to load members.");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadItems() {
    if (!loanId) return;
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("payment_allocations")
        .select("*")
        .eq("entry_id", loanId);
      if (error) throw error;
      if (!data || data.length === 0) { setItems([]); return; }

      const grouped: Record<string, Item> = {};
      data.forEach((row: any) => {
        const key = row.description.trim();
        if (!grouped[key]) {
          grouped[key] = {
            id: row.id,
            description: key,
            totalAmount: 0,
            notes: row.notes || "",
            status: "unpaid",
            splits: [],
          };
        }
        grouped[key].totalAmount += Number(row.amount || 0);
        grouped[key].splits.push({
          memberId: row.payee_id,
          amount: Number(row.amount || 0),
          percentage: 0,
          status: row.status as PaymentStatus,
        });
      });

      Object.values(grouped).forEach((item) => {
        item.splits = item.splits.map((s) => ({
          ...s,
          percentage: item.totalAmount > 0 ? (s.amount / item.totalAmount) * 100 : 0,
        }));
        const statuses = item.splits.map((s) => s.status);
        if (statuses.every((s) => s === "paid")) item.status = "paid";
        else if (statuses.some((s) => s === "paid" || s === "partially_paid")) item.status = "partially_paid";
        else item.status = "unpaid";
      });

      setItems(Object.values(grouped));
    } catch (err: any) {
      setDbError(err.message || "Failed to load allocations.");
    } finally {
      setLoadingItems(false);
    }
  }
  async function loadPayments() {
  if (!loanId) return;

  setLoadingPayments(true);

  try {
    const { data, error } = await supabase
      .from("payments")
      .select("payment_amount")
      .eq("entry_id", loanId);

    if (error) throw error;

    const totalPaid = (data || []).reduce(
      (sum, p: any) => sum + (parseFloat(p.payment_amount) || 0),
      0
    );

    setAmountPaid(totalPaid);
  } catch (err: any) {
    console.error("Failed to load payments:", err.message);
  } finally {
    setLoadingPayments(false);
  }
}

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.totalAmount, 0), [items]);

  async function handleSave(
    description: string,
    amount: number,
    notes: string | undefined,
    splits: { memberId: string; amount: number; percentage: number }[]
  ) {
    if (amountBorrowed > 0 && grandTotal + amount > amountBorrowed) {
      alert(
        `Cannot save — this would exceed the loan amount of ₱${amountBorrowed.toFixed(2)}. Remaining: ₱${(amountBorrowed - grandTotal).toFixed(2)}`
      );
      return;
    }

    try {
      const safeSplits = Array.isArray(splits) ? splits : [];
      if (safeSplits.length === 0) {
        alert("No splits provided.");
        return;
      }

      const rows = safeSplits.map((s) => ({
        entry_id: loanId,
        description: description.trim(),
        payee_id: s.memberId,
        amount: s.amount,
        notes: notes || null,
        status: "unpaid",
      }));

      const { error } = await supabase.from("payment_allocations").insert(rows);
      if (error) throw error;
      await loadItems();
      setShowAddItem(false);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  }

  async function handleStatusChange(
    description: string,
    memberId: string,
    newStatus: PaymentStatus
  ) {
    try {
      const { error } = await supabase
        .from("payment_allocations")
        .update({ status: newStatus })
        .eq("entry_id", loanId)
        .eq("description", description)
        .eq("payee_id", memberId);
      if (error) throw error;
      await loadItems();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
  e.preventDefault();

  if (!paymentPayeeId) {
    return alert("Please select a payee.");
  }

  const parsedAmount = parseFloat(paymentAmount);

  if (!parsedAmount || parsedAmount <= 0) {
    return alert("Invalid payment amount.");
  }

  if (parsedAmount > remainingBalance) {
    return alert(
      `Payment exceeds remaining balance of ₱${remainingBalance.toFixed(2)}`
    );
  }

  setSavingPayment(true);

  try {
    // SAVE PAYMENT
    const { error } = await supabase.from("payments").insert([
      {
        entry_id: loanId,
        payment_amount: parsedAmount,
        payment_date: paymentDate,
        payee_id: paymentPayeeId,
        proof_url: paymentProofUrl.trim() || null,
        notes: paymentNotes || null,
      },
    ]);

    if (error) throw error;

    // UPDATE LOCAL STATE
    const newTotalPaid = amountPaid + parsedAmount;

    setAmountPaid(newTotalPaid);

    // OPTIONAL:
    // AUTO UPDATE ENTRY STATUS
    const newStatus =
      newTotalPaid >= amountBorrowed
        ? "paid"
        : newTotalPaid > 0
        ? "partially_paid"
        : "unpaid";

    await supabase
      .from("entries")
      .update({
        status: newStatus,
        amount_remaining: Math.max(
          amountBorrowed - newTotalPaid,
          0
        ),
      })
      .eq("id", loanId);

    // CLOSE MODAL
    setShowPaymentModal(false);

    // RESET
    setPaymentAmount("");
    setPaymentProofUrl("");
    setPaymentNotes("");
    setPaymentPayeeId("");
  } catch (err: any) {
    alert(`Payment save failed: ${err.message}`);
  } finally {
    setSavingPayment(false);
  }
}

  useEffect(() => {
  if (isGroupExpense) {
    loadMembers();
    loadItems();
    loadPayments();
  }
}, [loanId, borrowerId, transactionType]);
  if (!isGroupExpense) return null;

  return (
    <div className="card shadow-sm border-0 p-4 bg-white mt-4">
      {dbError && (
        <div className="alert alert-danger py-2 px-3 small mb-3 border-0">
          <strong>Error:</strong> {dbError}
        </div>
      )}

      {!borrowerId && (
        <div className="alert alert-warning py-2 px-3 small mb-3 border-0">
          No group ID provided.
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1 text-dark fw-bold">Payment Allocation</h4>
          <p className="text-muted small mb-0">Itemized breakdown per group member</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-dark btn-sm px-3"
            onClick={() => {
              setPaymentDate(new Date().toISOString().split('T')[0]);
              setPaymentAmount("");
              setPaymentPayeeId("");
              setPaymentProofUrl("");
              setPaymentNotes("");
              setShowPaymentModal(true);
            }}
            disabled={members.length === 0}
          >
            + Add Payment
          </button>
          <button
            className="btn btn-dark btn-sm px-3"
            onClick={() => setShowAddItem(true)}
            disabled={members.length === 0 || showAddItem}
          >
            + Add Item
          </button>
        </div>
      </div>

      {showAddItem && (
        <div className="card p-4 mb-4 bg-light border border-secondary-subtle">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0 text-dark fw-bold text-uppercase small">Configure Split</h6>
            <button className="btn-close" onClick={() => setShowAddItem(false)} />
          </div>
          <AddItemForm
            members={members}
            onCancel={() => setShowAddItem(false)}
            onSave={handleSave}
          />
        </div>
      )}

      {loadingMembers || loadingItems ? (
        <div className="text-center text-muted small py-3">Loading...</div>
      ) : members.length === 0 ? (
        <div className="alert alert-warning small py-3 mb-0 border-0">
          <h6 className="fw-semibold">⚠️ No Members Found</h6>
          <p className="mb-1">No members mapped in <code>group_memberships</code> for this group.</p>
          <p className="mb-0 font-monospace small text-secondary">Group ID: {borrowerId || "—"}</p>
        </div>
      ) : (
        <PaymentList items={items} members={members} onStatusChange={handleStatusChange} />
      )}

      <div className="card border-info bg-light-subtle p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-bold text-dark mb-0">
          Group Payment Progress
        </h6>

        <span
          className={`badge ${
            remainingBalance <= 0
              ? "bg-success"
              : amountPaid > 0
              ? "bg-warning text-dark"
              : "bg-danger"
          }`}
        >
          {remainingBalance <= 0
            ? "PAID"
            : amountPaid > 0
            ? "PARTIALLY PAID"
            : "UNPAID"}
        </span>
      </div>

        <div
          className="progress"
          style={{
            height: "10px",
            marginTop: "12px",
            marginBottom: "12px",
          }}
        >
        <div
          className="progress-bar bg-success progress-bar-striped progress-bar-animated"
          role="progressbar"
          style={{ width: `${paymentProgress}%` }}
        />
      </div>

      <div className="row text-center small">
        <div className="col">
          <div className="text-muted">Borrowed</div>
          <div className="fw-bold">
            ₱{amountBorrowed.toFixed(2)}
          </div>
        </div>

        <div className="col">
          <div className="text-muted">Paid</div>
          <div className="fw-bold text-success">
            ₱{amountPaid.toFixed(2)}
          </div>
        </div>

        <div className="col">
          <div className="text-muted">Remaining</div>
          <div
            className={`fw-bold ${
              remainingBalance <= 0
                ? "text-success"
                : "text-danger"
            }`}
          >
            ₱{remainingBalance.toFixed(2)}
          </div>
        </div>
      </div>
    </div>

      <div className="mt-3 border-top pt-3">
        <div className="d-flex justify-content-between align-items-center text-muted small">
          <span>Loan Amount</span>
          <span>₱{amountBorrowed.toFixed(2)}</span>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-1">
          <span className="fw-bold fs-5 text-dark">Total Allocated</span>
          <span className={`fw-bold fs-5 ${grandTotal > amountBorrowed ? "text-danger" : "text-dark"}`}>
            ₱{grandTotal.toFixed(2)}
          </span>
        </div>
        {grandTotal > amountBorrowed && amountBorrowed > 0 && (
          <div className="alert alert-danger py-2 px-3 small mt-2 mb-0 border-0">
            ⚠️ Over by ₱{(grandTotal - amountBorrowed).toFixed(2)}
          </div>
        )}
        {grandTotal === amountBorrowed && amountBorrowed > 0 && (
          <div className="alert alert-success py-2 px-3 small mt-2 mb-0 border-0">
            ✅ Fully allocated — matches loan amount exactly.
          </div>
        )}
        {grandTotal < amountBorrowed && amountBorrowed > 0 && grandTotal > 0 && (
          <div className="alert alert-warning py-2 px-3 small mt-2 mb-0 border-0">
            ₱{(amountBorrowed - grandTotal).toFixed(2)} remaining to allocate.
          </div>
        )}
      </div>

      {/* ADD PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "450px" }}>
            <div className="modal-content text-dark">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Add Payment</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPaymentModal(false)}
                />
              </div>
              <form onSubmit={handleSavePayment}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Payment Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      disabled={savingPayment}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Payment Amount *</label>
                    <div className="input-group">
                      <span className="input-group-text">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required
                        disabled={savingPayment}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Payee *</label>
                    <select
                      className="form-select"
                      value={paymentPayeeId}
                      onChange={(e) => setPaymentPayeeId(e.target.value)}
                      required
                      disabled={savingPayment}
                    >
                      <option value="">-- Select Payee --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Proof of Payment (URL)</label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://example.com/receipt.png"
                      value={paymentProofUrl}
                      onChange={(e) => setPaymentProofUrl(e.target.value)}
                      disabled={savingPayment}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Optional notes..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      disabled={savingPayment}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={savingPayment}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingPayment}
                  >
                    {savingPayment ? "Saving..." : "Save Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}