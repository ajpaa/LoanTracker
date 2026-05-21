"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
};

type Split = {
  memberId: string;
  amount: number;
};

type Item = {
  id: string;
  description: string;
  status: string;
  totalAmount: number;
  splits: Split[];
};

export default function PaymentAllocation() {
  const supabase = createClient();

  // ─── STATE ───────────────────────────────────────────────
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);

  // ─── LOAD DATA ───────────────────────────────────────────
  useEffect(() => {
    loadMembers();
    fetchData();
  }, []);

  // ─── LOAD CONTACTS ───────────────────────────────────────
  async function loadMembers() {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name");

    if (error) {
      console.log("contacts error:", error);
      return;
    }

    setMembers((data ?? []) as Member[]);
  }

  // ─── LOAD ENTRIES + ALLOCATIONS ──────────────────────────
  async function fetchData() {
    const [{ data: entries }, { data: allocations }] =
      await Promise.all([
        supabase.from("entries").select("*"),
        supabase.from("payment_allocations").select("*"),
      ]);

    const formatted: Item[] = (entries ?? []).map((entry) => {
      const related = (allocations ?? []).filter(
        (a) => a.entry_id === entry.id
      );

      return {
        id: entry.id,
        description: entry.description,
        status: entry.status || "unpaid",
        totalAmount: related.reduce(
          (s, r) => s + Number(r.amount),
          0
        ),
        splits: related.map((r) => ({
          memberId: r.payee_id,
          amount: Number(r.amount),
        })),
      };
    });

    setItems(formatted);
  }

  // ─── TOGGLE MEMBER ───────────────────────────────────────
  function toggleMember(id: string) {
    setNewMembers((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  }

  // ─── SAVE ITEM ───────────────────────────────────────────
  async function addItem() {
    if (!newDesc.trim()) {
      alert("Enter description");
      return;
    }

    if (!newAmount || isNaN(Number(newAmount))) {
      alert("Enter valid amount");
      return;
    }

    if (newMembers.length === 0) {
      alert("Select at least 1 member");
      return;
    }

    const total = parseFloat(newAmount);
    const share = total / newMembers.length;

    const { data: entry, error: entryError } = await supabase
  .from("entries")
  .insert({
    ref_id: "LN-" + Date.now(),

    entry_name: newDesc,
    description: newDesc,

    transaction_type: "group_expense",

    borrower_id: newMembers[0],   // ⚠️ TEMP FIX (see note below)
    lender_id: newMembers[0],     // ⚠️ TEMP FIX

    amount_borrowed: Number(newAmount),
    amount_remaining: Number(newAmount),

    status: "unpaid",
    })
    .select()
    .single();

    const allocations = newMembers.map((mid) => ({
        entry_id: entry.id,
        payee_id: mid,
        amount: share,
        status: "unpaid",
        description: newDesc, // ✅ REQUIRED FIX
    }));

    const { error: allocError } = await supabase
      .from("payment_allocations")
      .insert(allocations);

    if (allocError) {
      console.log(allocError);
      return;
    }

    setNewDesc("");
    setNewAmount("");
    setNewMembers([]);
    setShowAddItem(false);

    fetchData();
  }

  // ─── TOTAL ───────────────────────────────────────────────
  const grandTotal = useMemo(
    () => items.reduce((s, i) => s + i.totalAmount, 0),
    [items]
  );

  // ─── UI ──────────────────────────────────────────────────
  return (
    <div className="container py-4">

      <div className="d-flex justify-content-between mb-3">
        <h5>Payment Allocation</h5>

        <button
          className="btn btn-dark btn-sm"
          onClick={() => setShowAddItem(true)}
        >
          + Add Item
        </button>
      </div>

      {showAddItem && (
        <div className="card mb-3">
          <div className="card-body">

            <input
              className="form-control mb-2"
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />

            <input
              className="form-control mb-2"
              type="number"
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />

            <div className="d-flex flex-wrap gap-2 mb-2">

              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn btn-sm ${
                    newMembers.includes(m.id)
                      ? "btn-primary"
                      : "btn-outline-secondary"
                  }`}
                  onClick={() => toggleMember(m.id)}
                >
                  {m.name}
                </button>
              ))}

            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-dark btn-sm" onClick={addItem}>
                Save
              </button>

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowAddItem(false)}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      <div className="d-flex flex-column gap-3">

        {items.map((item) => (
          <div key={item.id} className="card">

            <div className="card-header fw-semibold">
              {item.description}
            </div>

            <div className="card-body">

              {item.splits.length === 0 && (
                <div className="text-muted">
                  No allocations yet
                </div>
              )}

              {item.splits.map((s) => {
                const member = members.find(
                  (m) => m.id === s.memberId
                );

                return (
                  <div
                    key={s.memberId}
                    className="d-flex justify-content-between"
                  >
                    <span>{member?.name || "Unknown"}</span>
                    <span>₱{s.amount.toFixed(2)}</span>
                  </div>
                );
              })}

            </div>

          </div>
        ))}

      </div>

      <div className="mt-3 fw-bold">
        Grand Total: ₱{grandTotal.toFixed(2)}
      </div>

    </div>
  );
}