"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AddItemForm from "@/app/components/payment/addItemForm";
import PaymentList from "@/app/components/payment/paymentList";

import {
  Item,
  Member,
} from "@/app/types/payments";

import {
  getMembers,
  getEntries,
  getAllocations,
  createPaymentEntry,
  createPaymentAllocations,
} from "@/services/payment.service";

interface PaymentAllocationProps {
  loanId?: string | number;
}

export default function PaymentAllocation({ loanId }: PaymentAllocationProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);

  async function loadMembers() {
    const { data, error } = await getMembers();

    if (error) {
      console.log("getMembers error:", error);
      return;
    }

    setMembers((data ?? []) as Member[]);
  }

  async function fetchData() {
    const [{ data: entries }, { data: allocations }] =
      await Promise.all([
        getEntries(),
        getAllocations(),
      ]);

    // Filter down calculations if we are locked into a specific loan
    const filteredEntries = loanId 
      ? (entries ?? []).filter((entry) => String(entry.id) === String(loanId))
      : (entries ?? []);

    const formatted: Item[] = filteredEntries.map((entry) => {
      const related = (allocations ?? []).filter(
        (a) => a.entry_id === entry.id
      );

      return {
        id: entry.id,
        description: entry.description,
        status: entry.status ?? "unpaid",
        totalAmount: related.reduce(
          (s, r) => s + Number(r.amount),
          0
        ),
        notes: related?.[0]?.notes ?? "",
        splits: related.map((r) => ({
          memberId: r.payee_id,
          amount: Number(r.amount),
        })),
      };
    });

    setItems(formatted);
  }

  async function addItem(
    desc: string,
    amount: number,
    memberIds: string[],
    notes?: string
  ) {
    if (!memberIds.length) return;

    const share = amount / memberIds.length;
    let activeEntryId = loanId;

    // If we are NOT inside a specific loan page, generate a new master entry first
    if (!activeEntryId) {
      const { data: entry, error } = await createPaymentEntry({
        ref_id: "LN-" + Date.now(),
        entry_name: desc,
        description: desc,
        transaction_type: "group_expense",
        borrower_id: memberIds[0],
        lender_id: memberIds[0],
        amount_borrowed: amount,
        amount_remaining: amount,
        status: "unpaid",
      });

      if (error || !entry) return;
      activeEntryId = entry.id;
    }

    // Map your individual participant splits safely back to the master ID reference
    const allocations = memberIds.map((mid) => ({
      entry_id: activeEntryId,
      payee_id: mid,
      amount: share,
      description: desc,
      notes: notes ?? null,
      status: "unpaid",
    }));

    await createPaymentAllocations(allocations);

    // Refresh view lists
    fetchData();

    // Reset tracking flag
    setShowAddItem(false);
  }

  useEffect(() => {
    loadMembers();
    fetchData();
  }, [loanId]);

  const grandTotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + (i.totalAmount || 0),
        0
      ),
    [items]
  );

  return (
    <div className="container py-4 px-0">

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 fw-bold">Allocations Control Dashboard</h5>
        
        {/* The component exposes the button globally or contextually */}
        <button
          className="btn btn-dark btn-sm"
          onClick={() => setShowAddItem(true)}
        >
          + Add Split Allocation
        </button>
      </div>

      {/* Add Item Splitting Context Canvas Overlay Form */}
      {showAddItem && (
        <div className="card p-3 mb-3 bg-light border">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0 text-secondary small fw-bold">Configure Member Splits</h6>
            <button 
              className="btn-close" 
              style={{ fontSize: "12px" }} 
              onClick={() => setShowAddItem(false)}
            ></button>
          </div>
          <AddItemForm
            members={members}
            onSave={(desc, amount, memberIds, notes) => {
              addItem(desc, amount, memberIds, notes);
            }}
          />
        </div>
      )}

      <PaymentList
        items={items}
        members={members}
      />

      <div className="mt-3 fw-bold text-end text-dark">
        Total Splitting Obligation: ₱{grandTotal.toFixed(2)}
      </div>

    </div>
  );
}