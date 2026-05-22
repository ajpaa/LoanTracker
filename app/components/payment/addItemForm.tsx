"use client";

import { useState } from "react";
import { Member } from "@/app/types/payments";

type Props = {
  members: Member[];

  onSave: (
    desc: string,
    amount: number,
    memberIds: string[],
    notes?: string,
    splits?: any[] // 🔥 NEW: supports percent/amount breakdown
  ) => void;

  onCancel?: () => void;
};

export default function AddItemForm({
  members,
  onSave,
  onCancel,
}: Props) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [splitMode, setSplitMode] =
    useState<"equal" | "percent" | "amount">("equal");

  const [percentMap, setPercentMap] = useState<Record<string, number>>({});
  const [amountMap, setAmountMap] = useState<Record<string, number>>({});

  // ─────────────────────────────
  // TOGGLE MEMBER
  // ─────────────────────────────
  function toggleMember(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  }

  const totalAmount = Number(amount) || 0;

  // ─────────────────────────────
  // SPLIT BUILDERS
  // ─────────────────────────────
  function buildEqual() {
    const share = totalAmount / selected.length;

    return selected.map((id) => ({
      memberId: id,
      amount: share,
      percent: 100 / selected.length,
      status: "unpaid",
    }));
  }

  function buildPercent() {
    return selected.map((id) => ({
      memberId: id,
      percent: percentMap[id] || 0,
      amount: (totalAmount * (percentMap[id] || 0)) / 100,
      status: "unpaid",
    }));
  }

  function buildAmount() {
    return selected.map((id) => ({
      memberId: id,
      amount: amountMap[id] || 0,
      percent:
        totalAmount > 0
          ? ((amountMap[id] || 0) / totalAmount) * 100
          : 0,
      status: "unpaid",
    }));
  }

  // ─────────────────────────────
  // HANDLE SAVE
  // ─────────────────────────────
  function handleSave() {
    let splits: any[] = [];

    if (splitMode === "equal") {
      splits = buildEqual();
    }

    if (splitMode === "percent") {
      splits = buildPercent();
    }

    if (splitMode === "amount") {
      splits = buildAmount();
    }

    onSave(
      desc,
      totalAmount,
      selected,
      notes,
      splits
    );
  }

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  return (
    <div className="card mb-3">
      <div className="card-body">

        {/* DESCRIPTION */}
        <input
          className="form-control mb-2"
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        {/* AMOUNT */}
        <input
          className="form-control mb-2"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* NOTES */}
        <textarea
          className="form-control mb-2"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* SPLIT MODE */}
        <div className="d-flex gap-2 mb-3">

          <button
            className={`btn btn-sm ${splitMode === "equal" ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setSplitMode("equal")}
          >
            Divide Equally
          </button>

          <button
            className={`btn btn-sm ${splitMode === "percent" ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setSplitMode("percent")}
          >
            Divide by Percent
          </button>

          <button
            className={`btn btn-sm ${splitMode === "amount" ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setSplitMode("amount")}
          >
            Divide by Amount
          </button>

        </div>

        {/* MEMBERS */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn btn-sm ${
                selected.includes(m.id)
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
              onClick={() => toggleMember(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* PERCENT INPUTS */}
        {splitMode === "percent" &&
          members
            .filter((m) => selected.includes(m.id))
            .map((m) => (
              <input
                key={m.id}
                className="form-control mb-1"
                placeholder={`${m.name} %`}
                type="number"
                onChange={(e) =>
                  setPercentMap({
                    ...percentMap,
                    [m.id]: Number(e.target.value),
                  })
                }
              />
            ))}

        {/* AMOUNT INPUTS */}
        {splitMode === "amount" &&
          members
            .filter((m) => selected.includes(m.id))
            .map((m) => (
              <input
                key={m.id}
                className="form-control mb-1"
                placeholder={`${m.name} amount`}
                type="number"
                onChange={(e) =>
                  setAmountMap({
                    ...amountMap,
                    [m.id]: Number(e.target.value),
                  })
                }
              />
            ))}

        {/* ACTION BUTTONS */}
        <div className="d-flex gap-2 mt-3">

          <button
            className="btn btn-dark"
            onClick={handleSave}
          >
            Save
          </button>

          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              setDesc("");
              setAmount("");
              setSelected([]);
              setNotes("");
              setPercentMap({});
              setAmountMap({});

              onCancel?.();
            }}
          >
            Cancel
          </button>

        </div>

      </div>
    </div>
  );
}