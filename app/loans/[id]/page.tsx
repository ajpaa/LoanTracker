"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/services/supabase";
import PaymentAllocation from "@/app/components/payment/paymentAllocation";

export default function SpecificLoanDetailPage() {
  const { id } = useParams(); 
  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetailedEntry() {
      if (!id) return;
      
      const { data, error } = await supabase
      .from("entries")
      .select(`
        *,
        borrower:borrower_id(contact_id, name),
        lender:lender_id(contact_id, name)
      `)
      .eq("id", id)
      .single();

      if (error) {
        console.error("Error pulling entry details:", error.message);
      } else {
        setEntry(data);
      }
      setLoading(false);
    }

    fetchDetailedEntry();
  }, [id]);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-dark" role="status">
          <span className="visually-hidden">Loading entry details...</span>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="container py-5 text-center">
        <h4 className="text-danger">Loan Record Not Found</h4>
        <p className="text-muted small">The ID may be invalid or missing from the database entries schema.</p>
        <Link href="/loans" className="btn btn-dark mt-2">Return to Ledger</Link>
      </div>
    );
  }

  const getContactName = (contactField: any) => {
    if (!contactField) return "Unknown";
    return Array.isArray(contactField) ? contactField[0]?.name : contactField?.name;
  };

  return (
    <div className="container py-4">
      {/* Navigation Line */}
      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary small">
          &larr; Back to Ledger
        </Link>
      </div>

      {/* Profile Detail Card */}
      <div className="card shadow-sm border-0 mb-4 p-4 bg-white">
        <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
          <div>
            <span className="badge bg-dark mb-1">{entry.ref_id}</span>
            <h2 className="mb-1 text-dark fw-bold">{entry.entry_name}</h2>
            {entry.description && <p className="text-secondary small mb-0">{entry.description}</p>}
          </div>
          <span className="badge bg-light text-dark border px-3 py-2 text-uppercase fs-6">
            {entry.status.replace("_", " ")}
          </span>
        </div>

        {/* Structural Balances Grid */}
        <div className="row g-4 mb-3">
          <div className="col-md-3 col-6">
            <span className="text-muted d-block small text-uppercase fw-semibold mb-1">Lender</span>
            <span className="fs-5 fw-medium text-dark">{getContactName(entry.lender)}</span>
          </div>
          <div className="col-md-3 col-6">
            <span className="text-muted d-block small text-uppercase fw-semibold mb-1">Borrower</span>
            <span className="fs-5 fw-medium text-dark">{getContactName(entry.borrower)}</span>
          </div>
          <div className="col-md-3 col-6">
            <span className="text-muted d-block small text-uppercase fw-semibold mb-1">Total Obligation</span>
            <span className="fs-5 fw-bold text-primary">₱{Number(entry.amount_borrowed).toFixed(2)}</span>
          </div>
          <div className="col-md-3 col-6">
            <span className="text-muted d-block small text-uppercase fw-semibold mb-1">Remaining Balance</span>
            <span className="fs-5 fw-bold text-danger">₱{Number(entry.amount_remaining).toFixed(2)}</span>
          </div>
        </div>

        {entry.notes && (
          <div className="mt-2 p-3 bg-light rounded text-secondary small">
            <strong>Internal Notes:</strong> {entry.notes}
          </div>
        )}
      </div>

      {/* ✅ Fixed: borrowerId is now correctly supplied from the entry payload row context */}
      <PaymentAllocation 
        loanId={entry.id} 
        transactionType={entry.transaction_type} 
        borrowerId={entry.borrower_id ?? entry.borrower?.contact_id}
      />

      {/* Fallback visual helper if it is an individual expense */}
      {entry.transaction_type !== "group_expense" && (
        <div className="card p-4 text-center text-muted border-dashed bg-white">
          This is an individual expense ({entry.transaction_type.replace("_", " ")}). Group allocation tools are hidden.
        </div>
      )}
    </div>
  );
}