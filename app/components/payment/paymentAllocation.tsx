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
}

export default function PaymentAllocation({ loanId, transactionType, borrowerId = "" }: PaymentAllocationProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const isGroupExpense = transactionType === "group_expense";

  async function loadMembers() {
  if (!borrowerId) { setMembers([]); return; }
  setLoadingMembers(true);
  setDbError(null);
  try {
    // Step 1: get the real groups.group_id from this contact
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

    // Step 2: query group_memberships with the correct group_id
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
          grouped[key] = { id: row.id, description: key, totalAmount: 0, notes: row.notes || "", status: "unpaid", splits: [] };
        }
        grouped[key].totalAmount += Number(row.amount || 0);
        grouped[key].splits.push({ memberId: row.payee_id, amount: Number(row.amount || 0), percentage: 0, status: row.status as PaymentStatus });
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

  async function handleSave(
  description: string,
  amount: number,
  notes: string | undefined,
  splits: { memberId: string; amount: number; percentage: number }[]
) {
  try {
    console.log("handleSave splits:", splits); // debug

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

  async function handleStatusChange(description: string, memberId: string, newStatus: PaymentStatus) {
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

  useEffect(() => {
    console.log("=== useEffect triggered ===");
    console.log("isGroupExpense:", isGroupExpense);
    console.log("loanId:", loanId);
    console.log("borrowerId:", borrowerId);
    console.log("transactionType:", transactionType);
    if (isGroupExpense) {
      loadMembers();
      loadItems();
    }
  }, [loanId, borrowerId, transactionType]);

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.totalAmount, 0), [items]);

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
        <button
          className="btn btn-dark btn-sm px-3"
          onClick={() => setShowAddItem(true)}
          disabled={members.length === 0 || showAddItem}
        >
          + Add Item
        </button>
      </div>

      {showAddItem && (
        <div className="card p-4 mb-4 bg-light border border-secondary-subtle">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0 text-dark fw-bold text-uppercase small">Configure Split</h6>
            <button className="btn-close" onClick={() => setShowAddItem(false)} />
          </div>
          <AddItemForm members={members} onCancel={() => setShowAddItem(false)} onSave={handleSave} />
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

      <div className="mt-3 text-end fs-5 fw-bold text-dark border-top pt-3">
        Total: ₱{grandTotal.toFixed(2)}
      </div>
    </div>
  );
}