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

interface AlertModalState {
  isOpen: boolean;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  onConfirm?: () => void;
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
  const [paymentItemDescription, setPaymentItemDescription] = useState(""); 
  const [paymentPayeeId, setPaymentPayeeId] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  
  // PAYMENT TRACKING
  const [amountPaid, setAmountPaid] = useState(0);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Custom Modern Modal UI State
  const [modal, setModal] = useState<AlertModalState>({
    isOpen: false,
    type: "success",
    title: "",
    message: ""
  });

  const remainingBalance = Math.max(amountBorrowed - amountPaid, 0);

  const paymentProgress =
    amountBorrowed > 0
      ? Math.min(Math.round((amountPaid / amountBorrowed) * 100), 100)
      : 0;
  const isGroupExpense = transactionType === "group_expense";

  const triggerModal = (type: "success" | "error" | "warning", title: string, message: string, onConfirm?: () => void) => {
    setModal({ isOpen: true, type, title, message, onConfirm });
  };

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
      // 1. Fetch all allocations
      const { data: allocations, error: allocError } = await supabase
        .from("payment_allocations")
        .select("*")
        .eq("entry_id", loanId);
      if (allocError) throw allocError;
      if (!allocations || allocations.length === 0) { setItems([]); return; }

      // 2. Fetch all recorded payments to compute modern partial statuses accurately
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("payee_id, payment_amount, notes")
        .eq("entry_id", loanId);
      if (payError) throw payError;

      const grouped: Record<string, Item> = {};
      
      allocations.forEach((row: any) => {
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

        // Aggregate total payments made by THIS specific user for THIS item description
        // (Matching via notes, metadata, or contextual heuristics if payments lack explicit item IDs)
        const memberPaymentsForItem = (payments || [])
          .filter((p: any) => p.payee_id === row.payee_id && p.notes?.includes(`[${key}]`))
          .reduce((sum: number, p: any) => sum + Number(p.payment_amount || 0), 0);

        const allocatedAmount = Number(row.amount || 0);
        const amountOwed = Math.max(allocatedAmount - memberPaymentsForItem, 0);

        // Derive status purely from dynamic mathematical thresholds
        let dynamicSplitStatus: PaymentStatus = "unpaid";
        if (memberPaymentsForItem >= allocatedAmount) {
          dynamicSplitStatus = "paid";
        } else if (memberPaymentsForItem > 0) {
          dynamicSplitStatus = "partially_paid";
        }

        grouped[key].totalAmount += allocatedAmount;
        grouped[key].splits.push({
          memberId: row.payee_id,
          amount: amountOwed, // Mutates dynamically to remaining balance owed
          percentage: 0,
          status: dynamicSplitStatus,
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
  const isFullyAllocated = amountBorrowed > 0 && grandTotal >= amountBorrowed;
  const hasNoItems = items.length === 0;

  // Dynamically filter payees down to those who still have remaining item debt
  const filteredPayeesForSelectedItem = useMemo(() => {
    if (!paymentItemDescription) return [];
    const selectedItem = items.find(item => item.description === paymentItemDescription);
    if (!selectedItem) return [];

    return selectedItem.splits
      .filter(split => split.status !== "paid") // Drop payees who have entirely cleared this item
      .map(split => {
        const matchedMember = members.find(m => m.id === split.memberId);
        return {
          id: split.memberId,
          name: matchedMember ? matchedMember.name : "Unknown Member",
          amountOwed: split.amount // Returns the remaining active balance owed
        };
      });
  }, [paymentItemDescription, items, members]);

  async function handleSave(
    description: string,
    amount: number,
    notes: string | undefined,
    splits: { memberId: string; amount: number; percentage: number }[]
  ) {
    if (isFullyAllocated) {
      triggerModal("warning", "Allocation Limit Reached", "Cannot add item — Total allocated amount has already reached or exceeded the borrowed limit.");
      return;
    }

    if (amountBorrowed > 0 && grandTotal + amount > amountBorrowed) {
      triggerModal(
        "warning",
        "Allocation Overflow",
        `Cannot save — this would exceed the loan amount of ₱${amountBorrowed.toFixed(2)}. Remaining: ₱${(amountBorrowed - grandTotal).toFixed(2)}`
      );
      return;
    }

    try {
      const safeSplits = Array.isArray(splits) ? splits : [];
      if (safeSplits.length === 0) {
        triggerModal("warning", "Missing Configuration", "No splits provided.");
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
      triggerModal("success", "Allocation Saved", "Item allocation breakdown successfully added.");
    } catch (err: any) {
      triggerModal("error", "Database Error", `Save failed: ${err.message}`);
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
      triggerModal("error", "Status Update Failed", `Status update failed: ${err.message}`);
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();

    if (hasNoItems) {
      return triggerModal("warning", "Structure Required", "Cannot add payment — structural items must be added to the allocation breakdown first.");
    }
    if (!paymentItemDescription) {
      return triggerModal("warning", "Item Required", "Please select an item allocation.");
    }
    if (!paymentPayeeId) {
      return triggerModal("warning", "Payee Required", "Please select a payee.");
    }

    const parsedAmount = parseFloat(paymentAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      return triggerModal("warning", "Invalid Value", "Invalid payment amount.");
    }

    const targetSplit = filteredPayeesForSelectedItem.find(p => p.id === paymentPayeeId);
    if (!targetSplit) {
      return triggerModal("error", "Data Error", "Selected target allocation could not be validated.");
    }

    // Protection ensuring payment doesn't exceed what they owe for this item allocation
    if (parsedAmount > targetSplit.amountOwed) {
      return triggerModal(
        "warning",
        "Allocation Limit Exceeded",
        `${targetSplit.name} cannot pay ₱${parsedAmount.toFixed(2)}. The remaining balance required for this item is ₱${targetSplit.amountOwed.toFixed(2)}.`
      );
    }

    if (parsedAmount > remainingBalance) {
      return triggerModal(
        "warning",
        "Balance Exceeded",
        `Payment exceeds total remaining group loan balance of ₱${remainingBalance.toFixed(2)}`
      );
    }

    setSavingPayment(true);

    try {
      // Append item key context in notes so loadItems can accurately rebuild partial states later
      const clearTextNotes = `[${paymentItemDescription.trim()}] ${paymentNotes || ""}`.trim();

      const { error: paymentError } = await supabase.from("payments").insert([
        {
          entry_id: loanId,
          payment_amount: parsedAmount,
          payment_date: paymentDate,
          payee_id: paymentPayeeId,
          proof_url: paymentProofUrl.trim() || null,
          notes: clearTextNotes,
        },
      ]);

      if (paymentError) throw paymentError;

      // Determine updated sub-status based on remaining item math
      const targetAllocationIsFullyCleared = parsedAmount === targetSplit.amountOwed;
      const updatedAllocationStatus: PaymentStatus = targetAllocationIsFullyCleared ? "paid" : "partially_paid";

      // Synchronize back to database allocation table row
      const { error: allocationError } = await supabase
        .from("payment_allocations")
        .update({ status: updatedAllocationStatus })
        .eq("entry_id", loanId)
        .eq("description", paymentItemDescription.trim())
        .eq("payee_id", paymentPayeeId);

      if (allocationError) throw allocationError;

      const newTotalPaid = amountPaid + parsedAmount;
      setAmountPaid(newTotalPaid);

      const nextIsFullyPaid = newTotalPaid >= amountBorrowed;
      const newStatus = nextIsFullyPaid ? "paid" : newTotalPaid > 0 ? "partially_paid" : "unpaid";

      const entryUpdatePayload: any = {
        status: newStatus,
        amount_remaining: Math.max(amountBorrowed - newTotalPaid, 0),
        date_fully_paid: nextIsFullyPaid ? new Date().toISOString().split('T')[0] : null 
      };

      const { error: entryError } = await supabase
        .from("entries")
        .update(entryUpdatePayload)
        .eq("id", loanId);

      if (entryError) throw entryError;

      await loadItems();
      await loadPayments();

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentItemDescription("");
      setPaymentPayeeId("");
      setPaymentProofUrl("");
      setPaymentNotes("");
      
      triggerModal("success", "Payment Recorded", `Payment successfully saved. Allocation status is set to: ${updatedAllocationStatus.toUpperCase()}`);
    } catch (err: any) {
      triggerModal("error", "Transaction Fault", `Payment save failed: ${err.message}`);
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
              setPaymentItemDescription("");
              setPaymentPayeeId("");
              setPaymentProofUrl("");
              setPaymentNotes("");
              setShowPaymentModal(true);
            }}
            disabled={members.length === 0 || hasNoItems}
            title={hasNoItems ? "Add at least one item allocation before processing payments" : ""}
          >
            + Add Payment
          </button>
          <button
            className="btn btn-dark btn-sm px-3"
            onClick={() => setShowAddItem(true)}
            disabled={members.length === 0 || showAddItem || isFullyAllocated}
          >
            + Add Item
          </button>
        </div>
      </div>

      {showAddItem && !isFullyAllocated && (
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
      {showPaymentModal && !hasNoItems && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1050 }}>
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
                    <label className="form-label small fw-semibold">Item Allocation *</label>
                    <select
                      className="form-select"
                      value={paymentItemDescription}
                      onChange={(e) => {
                        setPaymentItemDescription(e.target.value);
                        setPaymentPayeeId(""); 
                        setPaymentAmount("");  
                      }}
                      required
                      disabled={savingPayment}
                    >
                      <option value="">-- Select Item --</option>
                      {items.map((item) => (
                        <option key={item.description} value={item.description}>
                          {item.description} (₱{item.totalAmount.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Payee *</label>
                    <select
                      className="form-select"
                      value={paymentPayeeId}
                      onChange={(e) => {
                        setPaymentPayeeId(e.target.value);
                        const match = filteredPayeesForSelectedItem.find(p => p.id === e.target.value);
                        if (match) {
                          // Suggest entire remaining allocation deficit balance as default input value
                          setPaymentAmount(match.amountOwed.toString()); 
                        }
                      }}
                      required
                      disabled={savingPayment || !paymentItemDescription}
                    >
                      <option value="">-- Select Payee --</option>
                      {filteredPayeesForSelectedItem.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Owes: ₱{m.amountOwed.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    {paymentItemDescription && filteredPayeesForSelectedItem.length === 0 && (
                      <div className="text-success small mt-1">✓ This item is fully paid by everyone!</div>
                    )}
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
                        disabled={savingPayment || !paymentPayeeId}
                      />
                    </div>
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
                    disabled={savingPayment || !paymentPayeeId}
                  >
                    {savingPayment ? "Saving..." : "Save Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODERN NOTIFICATION MODAL */}
      {modal.isOpen && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            width: "100vw", 
            height: "100vh", 
            backgroundColor: "rgba(0, 0, 0, 0.45)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 9999 
          }}
        >
          <div className="card border-0 shadow-lg rounded-4 text-center p-4 text-dark" style={{ width: "90%", maxWidth: "400px", backgroundColor: "#fff" }}>
            <div className="mb-3" style={{ fontSize: "3rem" }}>
              {modal.type === "success" && <span className="text-success">✅</span>}
              {modal.type === "warning" && <span className="text-warning">⚠️</span>}
              {modal.type === "error" && <span className="text-danger">❌</span>}
            </div>
            <h5 className="fw-bold mb-2 text-dark">{modal.title}</h5>
            <p className="text-muted small px-2 mb-4">{modal.message}</p>
            <button
              type="button"
              className={`btn w-100 py-2 fw-semibold rounded-3 ${
                modal.type === "success" ? "btn-success" : modal.type === "warning" ? "btn-warning text-dark" : "btn-danger"
              }`}
              onClick={() => {
                const currentOnConfirm = modal.onConfirm;
                setModal({ isOpen: false, type: "success", title: "", message: "" });
                if (currentOnConfirm) currentOnConfirm();
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}