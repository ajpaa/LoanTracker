"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/services/supabase"
import { getContacts } from "@/services/contacts"

interface ManualMember {
  name: string;
  phone: string;
}

export default function AddLoansPage() {
  const router = useRouter()

  // Form Field States (Borrower & Lender are back to simple text input strings)
  const [entryName, setEntryName] = useState("")
  const [transactionType, setTransactionType] = useState("installment_expense")
  const [borrowerNameInput, setBorrowerNameInput] = useState("")
  const [lenderNameInput, setLenderNameInput] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")
  
  // Group Expense Fields
  const [groupName, setGroupName] = useState("")
  const [manualMembers, setManualMembers] = useState<ManualMember[]>([{ name: "", phone: "" }])
  const [groupMembersSelect, setGroupMembersSelect] = useState<string[]>([]) 
  
  // Installment Specific Fields
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paymentFrequency, setPaymentFrequency] = useState("Monthly")
  const [paymentDayMonthly, setPaymentDayMonthly] = useState("1")
  const [paymentDayWeekly, setPaymentDayWeekly] = useState("Sunday")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState("12")
  
  // System State
  const [contacts, setContacts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  const totalObligation = parseFloat(amountBorrowed) || 0
  const installmentsTotalTerms = parseInt(paymentTerms) || 12
  const amountPerTerm = totalObligation > 0 ? (totalObligation / installmentsTotalTerms) : 0

  const monthlyDays = Array.from({ length: 28 }, (_, i) => (i + 1).toString())
  const weeklyDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  async function loadContacts() {
    try {
      const data = await getContacts()
      if (data) setContacts(data)
    } catch (err) {
      console.error("Error retrieving contact profiles:", err)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (transactionType === "installment_expense" && startDate > todayStr) {
      setPaymentStatus("not_started")
    } else if (transactionType === "installment_expense" && paymentStatus === "not_started" && startDate <= todayStr) {
      setPaymentStatus("unpaid")
    }
  }, [startDate, transactionType])

  const handleAddManualMember = () => {
    setManualMembers([...manualMembers, { name: "", phone: "" }])
  }

  const handleManualMemberChange = (index: number, field: keyof ManualMember, value: string) => {
    const updated = [...manualMembers]
    updated[index][field] = value
    setManualMembers(updated)
  }

  const handleRemoveManualMember = (index: number) => {
    const updated = manualMembers.filter((_, i) => i !== index)
    setManualMembers(updated.length ? updated : [{ name: "", phone: "" }])
  }

  // Helper function to resolve a contact ID by name (finds existing or creates a new one)
  async function resolveContactIdByName(nameStr: string): Promise<string> {
    const cleanedName = nameStr.trim()
    
    // Check if name already exists in our loaded system profile lists
    const matched = contacts.find(c => c.name.toLowerCase() === cleanedName.toLowerCase())
    if (matched) {
      return matched.contact_id
    }

    // Double check directly against database to avoid duplicate records
    const { data: dbContact, error: fetchError } = await supabase
      .from("contacts")
      .select("contact_id")
      .eq("name", cleanedName)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (dbContact) return dbContact.contact_id

    // If it truly doesn't exist anywhere, register them as a new individual contact profile
    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert([{ name: cleanedName, type: "person" }])
      .select()
      .single()

    if (insertError) throw insertError
    return newContact.contact_id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entryName.trim() || !borrowerNameInput.trim() || !lenderNameInput.trim() || !amountBorrowed) {
      alert("Please populate all basic required form fields.")
      return
    }

    try {
      setSubmitting(true)
      const parsedAmount = parseFloat(amountBorrowed)

      // --- STEP 1: RESOLVE BORROWER AND LENDER IDs FROM TEXT INPUTS ---
      const activeBorrowerId = await resolveContactIdByName(borrowerNameInput)
      const activeLenderId = await resolveContactIdByName(lenderNameInput)

      let targetGroupId: string | null = null

      // --- STEP 2: RESOLVE GROUP AND CONTACT MEMBERS IF GROUP EXPENSE ---
      if (transactionType === "group_expense") {
        if (!groupName.trim()) {
          alert("Please provide a group name for group expenses.")
          setSubmitting(false)
          return
        }

        const { data: existingGroup, error: fetchGroupError } = await supabase
          .from("groups")
          .select("group_id")
          .eq("group_name", groupName.trim())
          .maybeSingle()

        if (fetchGroupError) throw fetchGroupError

        if (existingGroup) {
          targetGroupId = existingGroup.group_id
        } else {
          const { data: groupData, error: groupError } = await supabase
            .from("groups")
            .insert([{ group_name: groupName.trim() }])
            .select()
            .single()

          if (groupError) throw groupError
          targetGroupId = groupData.group_id
        }

        const processedManualIds: string[] = []
        const validManualMembers = manualMembers.filter(m => m.name.trim() !== "")
        
        for (const member of validManualMembers) {
          const { data: newContact, error: contactError } = await supabase
            .from("contacts")
            .insert([{
              name: member.name.trim(),
              contact_info: member.phone.trim() || null,
              type: "person"
            }])
            .select()
            .single()

          if (contactError) throw contactError
          processedManualIds.push(newContact.contact_id)
        }

        const absoluteMemberIds = Array.from(new Set([...processedManualIds, ...groupMembersSelect]))

        if (absoluteMemberIds.length > 0) {
          const membershipPayload = [];
          for (const mId of absoluteMemberIds) {
            const { data: dynamicCheck } = await supabase
              .from("group_memberships")
              .select("id")
              .eq("group_id", targetGroupId)
              .eq("member_id", mId)
              .maybeSingle()

            if (!dynamicCheck) {
              membershipPayload.push({
                group_id: targetGroupId,
                member_id: mId
              })
            }
          }

          if (membershipPayload.length > 0) {
            const { error: membershipError } = await supabase
              .from("group_memberships")
              .insert(membershipPayload)

            if (membershipError) throw membershipError
          }
        }
      }

      // --- STEP 3: COMMIT THE FINANCIALLY TRACKED ENTRY LEDGER ---
      const basePayload: any = {
        entry_name: entryName.trim(),
        description: entryName.trim(),
        transaction_type: transactionType,
        borrower_id: activeBorrowerId,
        lender_id: activeLenderId,    
        amount_borrowed: parsedAmount,
        amount_remaining: parsedAmount, 
        status: paymentStatus.toLowerCase(), 
        date_borrowed: new Date().toISOString().split('T')[0],
        group_id: targetGroupId
      }

      const { data: insertedEntries, error: entryError } = await supabase
        .from("entries") 
        .insert([basePayload])
        .select()

      if (entryError) throw entryError
      const createdEntry = insertedEntries?.[0]

      // --- STEP 4: RUN CALCULATED MATRIX GENERATORS IF APPLICABLE ---
      if (transactionType === "installment_expense" && createdEntry) {
        const recurrenceDayValue = paymentFrequency === "Monthly" ? paymentDayMonthly : paymentDayWeekly

        const { error: rpcError } = await supabase.rpc("generate_installment_schedule", {
          p_entry_id: createdEntry.id,
          p_start_date: startDate,
          p_frequency: paymentFrequency.toLowerCase(),
          p_recurrence_day: recurrenceDayValue,
          p_terms: installmentsTotalTerms,
          p_total_amount: parsedAmount,
          p_notes: `Initial schedule for ${entryName.trim()}`
        })

        if (rpcError) {
          console.error("Failed to generate installment schedule matrix:", rpcError.message)
          alert(`Loan recorded, but installment generation failed: ${rpcError.message}`)
        }
      }

      alert("Loan record and profiles updated successfully!")
      router.push("/loans")
      router.refresh()
    } catch (err: any) {
      console.error("Database submission error:", err.message)
      alert(`Submission error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: "600px" }}>
      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary small">&larr; Cancel and Go Back</Link>
      </div>
      <div className="card p-4 shadow-sm border-0 bg-white text-dark">
        <h2 className="fw-bold mb-4">Create New Loan Account</h2>
        <form onSubmit={handleSubmit}>
          
          <div className="mb-3">
            <label className="form-label fw-semibold small">Loan Identification / Entry Name</label>
            <input type="text" className="form-control" required value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="e.g., Personal Equipment Finance Term" />
          </div>

          {/* BACK TO TEXT INPUTS */}
          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold small">Borrower profile</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Type Borrower Name"
                value={borrowerNameInput}
                onChange={(e) => setBorrowerNameInput(e.target.value)}
              />
            </div>

            <div className="col-sm-6">
              <label className="form-label fw-semibold small">Lender profile</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Type Lender Name"
                value={lenderNameInput}
                onChange={(e) => setLenderNameInput(e.target.value)}
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold small">Transaction Structure</label>
              <select className="form-select" value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="installment_expense">Installment Expense Matrix</option>
                <option value="fixed_term_loan">Fixed Term / Single Payout</option>
                <option value="group_expense">Group Expense</option>
              </select>
            </div>
            <div className="col-sm-6">
              <label className="form-label fw-semibold small">Principal Amount Borrowed</label>
              <div className="input-group">
                <span className="input-group-text">₱</span>
                <input type="number" step="0.01" className="form-control" required value={amountBorrowed} onChange={(e) => setAmountBorrowed(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>

          {transactionType === "installment_expense" && (
            <div className="p-3 bg-light rounded mb-4 border border-info-subtle">
              <h6 className="fw-bold text-info-emphasis mb-3">Installment Generation Parameters</h6>
              
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small mb-1">Payment Frequency</label>
                  <select className="form-select form-select-sm" value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)}>
                    <option value="Monthly">Monthly Cycle</option>
                    <option value="Weekly">Weekly Cycle</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Total Fixed Terms</label>
                  <input type="number" className="form-control form-control-sm" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} min="1" />
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small mb-1">Target Start Effective Date</label>
                  <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Recurrence Due Day</label>
                  {paymentFrequency === "Monthly" ? (
                    <select className="form-select form-select-sm" value={paymentDayMonthly} onChange={(e) => setPaymentDayMonthly(e.target.value)}>
                      {monthlyDays.map(day => <option key={day} value={day}>Day {day}</option>)}
                    </select>
                  ) : (
                    <select className="form-select form-select-sm" value={paymentDayWeekly} onChange={(e) => setPaymentDayWeekly(e.target.value)}>
                      {weeklyDays.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-2 text-muted small pt-2 border-top">
                Estimated Billing Rate: <strong className="text-dark">₱{amountPerTerm.toFixed(2)} / term</strong>
              </div>
            </div>
          )}

          {transactionType === "group_expense" && (
            <div className="p-3 bg-light rounded mb-4 border border-secondary">
              <h6 className="fw-bold mb-3">Group Expense Details</h6>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Group Name</label>
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="e.g., Teamba"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Register New Members with Phone</label>
                {manualMembers.map((member, index) => (
                  <div key={index} className="row g-2 mb-2 align-items-center">
                    <div className="col-5">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Member Name"
                        value={member.name}
                        onChange={(e) => handleManualMemberChange(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="col-5">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Phone (Optional)"
                        value={member.phone}
                        onChange={(e) => handleManualMemberChange(index, "phone", e.target.value)}
                      />
                    </div>
                    <div className="col-2">
                      <button type="button" className="btn btn-sm btn-outline-danger w-100" onClick={() => handleRemoveManualMember(index)}>
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline-secondary mt-1" onClick={handleAddManualMember}>
                  + Add Member Row
                </button>
              </div>

              <div className="mb-2">
                <label className="form-label small fw-semibold">Select Existing Contacts Instead</label>
                <select
                  multiple
                  className="form-select text-secondary small"
                  style={{ height: "120px" }}
                  value={groupMembersSelect}
                  onChange={(e) =>
                    setGroupMembersSelect(
                      Array.from(e.target.selectedOptions, (o) => o.value)
                    )
                  }
                >
                  {contacts.map((c) => (
                    <option key={c.contact_id} value={c.contact_id}>
                      {c.name} {c.contact_info ? `(${c.contact_info})` : ""}
                    </option>
                  ))}
                </select>
                <div className="form-text text-muted extra-small">Hold Ctrl (or Cmd) to highlight multiple people.</div>
              </div>
            </div>
          )}

          <div className="d-flex gap-2 justify-content-end mt-4">
            <Link href="/loans" className="btn btn-light border px-4">Cancel</Link>
            <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
              {submitting ? "Processing Database Entry..." : "Commit Loan Ledgers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}