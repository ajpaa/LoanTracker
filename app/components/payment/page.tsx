"use client";

import PaymentAllocation from "@/app/components/payment/paymentAllocation";

export default function Page() {
  return (
    <div className="container py-4">
      {/* Target a real UUID from the public.contacts group log table view */}
      <PaymentAllocation 
        loanId="test-loan-id" 
        transactionType="group_expense" 
        borrowerId="722dff3b-66cb-4933-8b19-7036f890123c" 
      />
    </div>
  );
}