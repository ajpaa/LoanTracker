"use client";

import { useState, useEffect, useMemo } from "react";
import { Member } from "@/app/types/payments";

interface AddItemFormProps {
  members: Member[];
  onCancel: () => void;
  onSave: (
    description: string,
    amount: number,
    notes: string | undefined,
    splits: { memberId: string; amount: number; percentage: number }[]
  ) => void;
}

type SplitMode = "equal" | "percent" | "amount";

export default function AddItemForm({ members, onCancel, onSave }: AddItemFormProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    members.forEach((m) => (init[m.id] = true));
    setSelectedMembers(init);
  }, [members]);

  const totalAmountNum = parseFloat(amount) || 0;
  const activeMembers = members.filter((m) => selectedMembers[m.id]);

  const computedSplits = useMemo(() => {
    if (activeMembers.length === 0 || totalAmountNum <= 0) return [];

    if (splitMode === "equal") {
      const share = totalAmountNum / activeMembers.length;
      return activeMembers.map((m) => ({
        memberId: m.id,
        amount: parseFloat(share.toFixed(2)),
        percentage: parseFloat((100 / activeMembers.length).toFixed(4)),
      }));
    }

    if (splitMode === "percent") {
      return activeMembers.map((m) => {
        const pct = parseFloat(customValues[m.id]) || 0;
        return {
          memberId: m.id,
          amount: parseFloat(((pct / 100) * totalAmountNum).toFixed(2)),
          percentage: pct,
        };
      });
    }

    return activeMembers.map((m) => {
      const amt = parseFloat(customValues[m.id]) || 0;
      return {
        memberId: m.id,
        amount: parseFloat(amt.toFixed(2)),
        percentage: totalAmountNum > 0 ? parseFloat(((amt / totalAmountNum) * 100).toFixed(4)) : 0,
      };
    });
  }, [activeMembers, totalAmountNum, splitMode, customValues]);

  const validationError = useMemo(() => {
    if (splitMode === "percent" && computedSplits.length > 0) {
      const total = computedSplits.reduce((s, x) => s + x.percentage, 0);
      if (Math.abs(total - 100) > 0.01) return `Percentages sum to ${total.toFixed(2)}% — must equal 100%`;
    }
    if (splitMode === "amount" && computedSplits.length > 0) {
      const total = computedSplits.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(total - totalAmountNum) > 0.01)
        return `Split amounts sum to ₱${total.toFixed(2)} — must equal ₱${totalAmountNum.toFixed(2)}`;
    }
    return null;
  }, [computedSplits, splitMode, totalAmountNum]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("totalAmountNum:", totalAmountNum);
    console.log("activeMembers:", activeMembers);
    console.log("computedSplits:", computedSplits);
    if (!description.trim() || totalAmountNum <= 0) return alert("Please provide a valid description and amount.");
    if (activeMembers.length === 0) return alert("Select at least one member.");
    if (validationError) return alert(validationError);
    onSave(description, totalAmountNum, notes || undefined, computedSplits);
};

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label small fw-semibold text-secondary text-uppercase">Description *</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. Dinner, Transport"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold text-secondary text-uppercase">Total Amount *</label>
        <div className="input-group">
          <span className="input-group-text">₱</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold text-secondary text-uppercase">Notes</label>
        <textarea
          className="form-control"
          placeholder="Optional notes..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="form-label small fw-semibold text-secondary text-uppercase">Split Method</label>
        <div className="btn-group w-100" role="group">
          {(["equal", "percent", "amount"] as SplitMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-sm ${splitMode === mode ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => { setSplitMode(mode); setCustomValues({}); }}
            >
              {mode === "equal" ? "Equally" : mode === "percent" ? "By %" : "By ₱"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="form-label small fw-semibold text-secondary text-uppercase">Members</label>
        <div className="border rounded p-3 bg-white">
          {members.map((member) => {
            const isActive = !!selectedMembers[member.id];
            const splitPreview = computedSplits.find((s) => s.memberId === member.id);
            return (
              <div key={member.id} className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                <div className="form-check mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`chk-${member.id}`}
                    checked={isActive}
                    onChange={(e) => setSelectedMembers({ ...selectedMembers, [member.id]: e.target.checked })}
                  />
                  <label className="form-check-label text-dark" htmlFor={`chk-${member.id}`}>
                    {member.name}
                  </label>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {isActive && splitMode !== "equal" && (
                    <div className="input-group input-group-sm" style={{ width: 110 }}>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control"
                        placeholder={splitMode === "percent" ? "%" : "₱"}
                        value={customValues[member.id] || ""}
                        onChange={(e) => setCustomValues({ ...customValues, [member.id]: e.target.value })}
                      />
                      <span className="input-group-text">{splitMode === "percent" ? "%" : "₱"}</span>
                    </div>
                  )}
                  {isActive && splitPreview && totalAmountNum > 0 && (
                    <span className="badge bg-secondary-subtle text-dark border" style={{ fontSize: "0.75rem" }}>
                      ₱{splitPreview.amount.toFixed(2)} <span className="text-muted">({splitPreview.percentage.toFixed(1)}%)</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {validationError && <div className="text-danger small mt-2">{validationError}</div>}
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-dark btn-sm px-4" disabled={!!validationError}>
          Save Item
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}