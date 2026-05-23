"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/services/supabase"
import { getContacts, getAvailableGroups } from "@/services/contacts"

interface ManualMember {
  name: string;
  phone: string;
  contact_id?: string;
}

interface AlertModalState {
  isOpen: boolean;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  onConfirm?: () => void;
}

export default function AddLoansPage() {
  const router = useRouter()

  // Form Field States
  const [entryName, setEntryName] = useState("")
  const [transactionType, setTransactionType] = useState("installment_expense")
  const [borrowerNameInput, setBorrowerNameInput] = useState("")
  const [lenderNameInput, setLenderNameInput] = useState("")
  const [amountBorrowed, setAmountBorrowed] = useState("")
  
  // Group Expense Fields
  const [groupName, setGroupName] = useState("")
  const [manualMembers, setManualMembers] = useState<ManualMember[]>([{ name: "", phone: "" }])
  const [originalGroupMembers, setOriginalGroupMembers] = useState<string[]>([])
  
  // Installment Specific Fields
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paymentFrequency, setPaymentFrequency] = useState("Monthly")
  const [paymentDayMonthly, setPaymentDayMonthly] = useState("1")
  const [paymentDayWeekly, setPaymentDayWeekly] = useState("Sunday")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState("12")
  
  // System State
  const [contacts, setContacts] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Custom Modern Modal UI State
  const [modal, setModal] = useState<AlertModalState>({
    isOpen: false,
    type: "success",
    title: "",
    message: ""
  })

  // Custom Dropdown Active UI State
  const [activeDropdown, setActiveDropdown] = useState<{
  field: "borrower" | "lender" | "group" | "bulk_members" | "member_row" | null
  index?: number
}>({ field: null })
  
  // Inline Multi-select search query string
  const [bulkSearchQuery, setBulkSearchQuery] = useState("")
  
  // Unique random numeric string suffix generated once per page load cycle
  const [randomSuffix] = useState(() => Math.floor(1000 + Math.random() * 9000).toString())

  // Refs for tracking click outside to close dropdowns
  const componentContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (componentContainerRef.current && !componentContainerRef.current.contains(event.target as Node)) {
        setActiveDropdown({ field: null })
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Helper to summon beautiful feedback notifications
  const triggerModal = (type: "success" | "error" | "warning", title: string, message: string, onConfirm?: () => void) => {
    setModal({ isOpen: true, type, title, message, onConfirm })
  }

  // --- LOGIC: AUTOMATED REF ID INITIALS + NUMBERS ---
  const getInitials = (fullName: string): string => {
    if (!fullName.trim()) return ""
    return fullName
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join("")
      .toUpperCase()
  }

  const targetBorrowerName = transactionType === "group_expense" ? groupName : borrowerNameInput
  const borrowerInitials = getInitials(targetBorrowerName) || "???"
  const lenderInitials = getInitials(lenderNameInput) || "???"
  const generatedRefId = `${borrowerInitials}-${lenderInitials}-${randomSuffix}`

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
  async function loadGroups() {
    try {
      const data = await getAvailableGroups()
      setGroups(data || [])
    } catch (err) {
      console.error("Error loading groups:", err)
    }
  }

  loadGroups()
}, [])

  // --- AUTOFILL MEMBERS WHEN EXISTING GROUP IS SELECTED ---
  useEffect(() => {
    async function fetchGroupMemberships() {
      if (transactionType !== "group_expense" || !groupName.trim()) return

      const matchedGroup = groups.find(
  g => g.group_name.toLowerCase() === groupName.trim().toLowerCase()
)

      if (!matchedGroup) return

      try {
        const { data: groupRows, error: groupErr } = await supabase
          .from("groups")
          .select("group_id")
          .eq("group_name", matchedGroup.group_name)

        if (groupErr || !groupRows || groupRows.length === 0) return
        const groupRow = groupRows[0]

        const { data: memberships, error: memErr } = await supabase
        
          .from("group_memberships")
          .select(`
            member_id,
            contacts!group_memberships_member_id_fkey (
              name,
              contact_info
            )
          `)
          .eq("group_id", groupRow.group_id)

          const lenderInGroup = memberships?.some((m: any) => {
  const contact = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts
  return contact?.name?.toLowerCase() === lenderNameInput.trim().toLowerCase()
})

if (lenderInGroup && lenderNameInput.trim() !== "") {
  triggerModal(
    "warning",
    "Invalid Group Selection",
    `The lender "${lenderNameInput}" is already a member of "${groupName}". You cannot select this group.`
  )

  setGroupName("")
  setManualMembers([{ name: "", phone: "" }])
  setActiveDropdown({ field: null })

  return
}

        if (memErr || !memberships) return

        const formattedMembers: ManualMember[] = memberships
  .map((m: any) => {
    const contact = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts

    return {
      name: contact?.name || "",
      phone: contact?.contact_info || "",
      contact_id: m.member_id
    }
  })
  .filter(m => m.name)

        // IDENTITY INTERCEPTOR: Verify if any group member matches the selected Lender
        const hasLenderInGroup = formattedMembers.some(
          m => m.name.trim().toLowerCase() === lenderNameInput.trim().toLowerCase()
        )

        if (hasLenderInGroup && lenderNameInput.trim() !== "") {
          triggerModal(
            "warning",
            "Restricted Action",
            `You cannot select "${matchedGroupContact.name}" because the current Lender (${lenderNameInput}) is already a member of this group. Please choose another group configuration.`
          )
          setGroupName("")
          setManualMembers([{ name: "", phone: "" }])
          return
        }

        // reset first so UI doesn't keep old stale rows
setManualMembers([{ name: "", phone: "" }])

if (formattedMembers.length > 0) {
  setManualMembers(formattedMembers)
}
      } catch (err) {
        console.error("Failed to parse group membership autofill maps:", err)
      }
    }

    fetchGroupMemberships()
  }, [groupName, transactionType, contacts, lenderNameInput])

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

  const handleManualMemberNameChange = (index: number, nameValue: string) => {
    const updated = [...manualMembers]
    updated[index].name = nameValue

    const matchedContact = contacts.find(
      c => c.name.toLowerCase() === nameValue.trim().toLowerCase() && c.type === "person"
    )

    if (matchedContact) {
      updated[index].phone = matchedContact.contact_info || ""
      updated[index].contact_id = matchedContact.contact_id
    } else {
      updated[index].contact_id = undefined
    }

    setManualMembers(updated)
  }

  const handleManualMemberPhoneChange = (index: number, phoneValue: string) => {
    const updated = [...manualMembers]
    updated[index].phone = phoneValue
    setManualMembers(updated)
  }

  const handleRemoveManualMember = (index: number) => {
    const updated = manualMembers.filter((_, i) => i !== index)
    setManualMembers(updated.length ? updated : [{ name: "", phone: "" }])
  }

  const handleSelectBulkMember = (contactItem: any) => {
    const baseline = manualMembers.length === 1 && !manualMembers[0].name.trim() ? [] : [...manualMembers]
    
    const newMemberEntry: ManualMember = {
      name: contactItem.name,
      phone: contactItem.contact_info || "",
      contact_id: contactItem.contact_id
    }

    setManualMembers([...baseline, newMemberEntry])
    setBulkSearchQuery("")
  }

  async function resolveContactIdByName(nameStr: string, type: "person" | "group", phoneStr?: string): Promise<string> {
    const cleanedName = nameStr.trim()
    if (!cleanedName) throw new Error("Name payload cannot be blank.")
    
    if (contacts && contacts.length > 0) {
      const matched = contacts.find(c => c.name.toLowerCase() === cleanedName.toLowerCase() && c.type === type)
      if (matched && matched.contact_id) return matched.contact_id
    }

    const { data: dbContacts, error: fetchError } = await supabase
      .from("contacts")
      .select("contact_id")
      .eq("name", cleanedName)
      .eq("type", type)

    if (fetchError) throw fetchError
    if (dbContacts && dbContacts.length > 0) return dbContacts[0].contact_id

    const { data: newContacts, error: insertError } = await supabase
      .from("contacts")
      .insert([{ name: cleanedName, type: type, contact_info: phoneStr || null }])
      .select()

    if (insertError) throw insertError
    if (!newContacts || newContacts.length === 0) {
      throw new Error(`Failed to generate a contact record for "${cleanedName}".`)
    }
    
    return newContacts[0].contact_id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const isGroup = transactionType === "group_expense"
    const validationBorrowerName = isGroup ? groupName : borrowerNameInput

    if (!entryName.trim() || !validationBorrowerName.trim() || !lenderNameInput.trim() || !amountBorrowed) {
      triggerModal("warning", "Missing Fields", "Please populate all basic required form fields before saving.")
      return
    }

    if (validationBorrowerName.trim().toLowerCase() === lenderNameInput.trim().toLowerCase()) {
      triggerModal("warning", "Validation Conflict", "The Lender and Borrower cannot be the exact same person or group entity.")
      return
    }

    if (isGroup) {
      const lenderInMembers = manualMembers.some(
        m => m.name.trim().toLowerCase() === lenderNameInput.trim().toLowerCase()
      )
      if (lenderInMembers) {
        triggerModal("warning", "Validation Conflict", "The Lender cannot simultaneously be listed as an itemized Group Member.")
        return
      }
    }

    try {
      setSubmitting(true)
      const parsedAmount = parseFloat(amountBorrowed)
      
      const activeLenderId = await resolveContactIdByName(lenderNameInput, "person")
      if (!activeLenderId) {
        throw new Error("Unable to resolve or create a valid contact ID for the Lender.")
      }
      
      let activeBorrowerId: string
      let targetGroupId: string | null = null

      if (isGroup) {
        const { data: existingGroups, error: fetchGroupError } = await supabase
          .from("groups")
          .select("group_id, group_name")
          .eq("group_name", groupName.trim())

        const validManualMembers = manualMembers.filter(m => m.name.trim() !== "")
        const existingGroup = existingGroups && existingGroups.length > 0 ? existingGroups[0] : null

        if (existingGroup) {
          const { data: dbMemberships } = await supabase
            .from("group_memberships")
            .select(`
              member_id,
              contacts ( name )
            `)
            .eq("group_id", existingGroup.group_id)

          const dbMemberNamesSet = new Set(
            (dbMemberships || []).map((m: any) => m.contacts?.name?.trim().toLowerCase()).filter(Boolean)
          )
          const uiMemberNamesSet = new Set(
            validManualMembers.map(m => m.name.trim().toLowerCase())
          )

          let rostersMatch = dbMemberNamesSet.size === uiMemberNamesSet.size
          if (rostersMatch) {
            for (const name of uiMemberNamesSet) {
              if (!dbMemberNamesSet.has(name)) {
                rostersMatch = false
                break
              }
            }
          }

          if (!rostersMatch) {
            triggerModal(
              "warning",
              "Group Name Conflict",
              `A group named "${groupName.trim()}" already exists with a different set of members. To save this alternative roster, please change the group name field to a unique name instead.`
            )
            setSubmitting(false)
            return
          }

          targetGroupId = existingGroup.group_id
          activeBorrowerId = await resolveContactIdByName(groupName, "group")
        } else {
          activeBorrowerId = await resolveContactIdByName(groupName, "group")

          const { data: groupData, error: groupError } = await supabase
            .from("groups")
            .insert([{ group_name: groupName.trim() }])
            .select()

          if (groupError || !groupData || groupData.length === 0) throw groupError || new Error("Failed to create group record.")
          targetGroupId = groupData[0].group_id
        }

        const processedMemberIds: string[] = []
        for (const member of validManualMembers) {
          const memberId = await resolveContactIdByName(member.name, "person", member.phone)
          if (memberId) {
            processedMemberIds.push(memberId)
          }
        }
        // Link the borrower contact to this group
        const { error: groupRefError } = await supabase
          .from("contacts")
          .update({ group_ref: targetGroupId })
          .eq("contact_id", activeBorrowerId)

        if (groupRefError) throw groupRefError
        

        

        if (processedMemberIds.length > 0 && targetGroupId) {
          const membershipPayload = []
          for (const mId of processedMemberIds) {
            const { data: dynamicChecks } = await supabase
              .from("group_memberships")
              .select("id")
              .eq("group_id", targetGroupId)
              .eq("member_id", mId)

            if (!dynamicChecks || dynamicChecks.length === 0) {
              membershipPayload.push({ group_id: targetGroupId, member_id: mId })
            }
          }

          if (membershipPayload.length > 0) {
            const { error: membershipError } = await supabase
              .from("group_memberships")
              .insert(membershipPayload)

            if (membershipError) throw membershipError
          }
        }
      } else {
        activeBorrowerId = await resolveContactIdByName(borrowerNameInput, "person")
      }

      // DETERMINISTIC TRANSACTION TYPE TOKENS: Fallback logic maps text keys to target DB definitions
      let dbTransactionTypeToken = transactionType
      if (transactionType === "straight_loan") {
        // Try 'straight_expense' as it matches the typical snake_case schema naming pattern of the other options
        dbTransactionTypeToken = "straight_expense"
      }

      const basePayload: any = {
        entry_name: entryName.trim(),
        description: entryName.trim(),
        transaction_type: dbTransactionTypeToken, 
        borrower_id: activeBorrowerId, 
        lender_id: activeLenderId,    
        amount_borrowed: parsedAmount,
        amount_remaining: parsedAmount, 
        status: transactionType === "installment_expense" ? paymentStatus.toLowerCase() : "unpaid", 
        date_borrowed: new Date().toISOString().split('T')[0],
        group_id: targetGroupId,
        ref_id: generatedRefId,
        ...(transactionType === "installment_expense" && {
          payment_frequency: paymentFrequency.toLowerCase(),
          recurrence_day: paymentFrequency === "Monthly" ? paymentDayMonthly : paymentDayWeekly,
          start_date: startDate,
          total_terms: installmentsTotalTerms,
        })
      }

      const { data: insertedEntries, error: entryError } = await supabase
        .from("entries") 
        .insert([basePayload])
        .select()

      if (entryError) throw entryError
      const createdEntry = insertedEntries?.[0]

      if (transactionType === "installment_expense" && createdEntry) {
        const recurrenceDayValue = paymentFrequency === "Monthly" ? paymentDayMonthly : paymentDayWeekly

        const { error: rpcError } = await supabase.rpc("generate_installment_schedule", {
          p_entry_id: createdEntry.id,
          p_start_date: startDate,
          p_frequency: paymentFrequency.toLowerCase(),
          p_recurrence_day: recurrenceDayValue,
          p_terms: installmentsTotalTerms,
          p_total_amount: parsedAmount,
          p_notes: `Initial schedule for ${entryName.trim()} - Ref: ${generatedRefId}`
        })

        if (rpcError) {
          console.error("Failed to generate installment schedule matrix:", rpcError.message)
          triggerModal("error", "Schedule Generation Failure", `Loan recorded, but dynamic generation of dates failed: ${rpcError.message}`)
          return
        }
      }

      triggerModal(
        "success",
        "Transaction Authorized",
        "Loan record updates and profiles successfully compiled to ledgers.",
        () => {
          router.push("/loans")
          router.refresh()
        }
      )

    } catch (err: any) {
      console.error("Database submission error:", err.message)
      triggerModal("error", "Submission Refused", err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // --- FILTERED SELECTION LOGIC CORRECTIONS ---
  const filteredPeopleBorrowers = contacts.filter(c => 
    c.type === "person" && 
    c.name.toLowerCase().includes(borrowerNameInput.toLowerCase()) &&
    c.name.toLowerCase() !== lenderNameInput.trim().toLowerCase()
  )
  
  const filteredGroups = groups.filter(g =>
  g.group_name.toLowerCase().includes(groupName.toLowerCase())
)
  
  const activeSelectedNamesSet = new Set(manualMembers.map(m => m.name.trim().toLowerCase()))

  const filteredLenders = contacts.filter(c => {
    const targetBorrowerCompare = transactionType === "group_expense" ? groupName : borrowerNameInput
    const isPerson = c.type === "person"
    const matchesQuery = c.name.toLowerCase().includes(lenderNameInput.toLowerCase())
    const isNotBorrower = c.name.toLowerCase() !== targetBorrowerCompare.trim().toLowerCase()
    
    // RESTRICTION: Ensure lender cannot be selected if they are inside the current roster list
    const isNotAGroupMember = !activeSelectedNamesSet.has(c.name.trim().toLowerCase())

    return isPerson && matchesQuery && isNotBorrower && isNotAGroupMember
  })

  const filteredBulkOptions = contacts.filter(c => {
    const isPerson = c.type === "person"
    const matchesSearch = c.name.toLowerCase().includes(bulkSearchQuery.toLowerCase())
    const isNotYetSelected = !activeSelectedNamesSet.has(c.name.trim().toLowerCase())
    const isNotLender = c.name.toLowerCase() !== lenderNameInput.trim().toLowerCase()
    return isPerson && matchesSearch && isNotYetSelected && isNotLender
  })

  return (
    <div className="container py-4" style={{ maxWidth: "600px" }} ref={componentContainerRef}>
      
      {/* MODERN INTERACTIVE DIALOG MODAL */}
      {modal.isOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center px-3" style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 2000, backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3 p-4 shadow-lg w-100 border-0" style={{ maxWidth: "420px", transform: "translateY(0)", transition: "transform 0.2s ease-out" }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              {modal.type === "success" && <span className="badge bg-success-subtle text-success rounded-circle p-2 fs-5">✓</span>}
              {modal.type === "error" && <span className="badge bg-danger-subtle text-danger rounded-circle p-2 fs-5">✕</span>}
              {modal.type === "warning" && <span className="badge bg-warning-subtle text-warning rounded-circle p-2 fs-5">⚠️</span>}
              <h5 className="fw-bold mb-0 text-dark">{modal.title}</h5>
            </div>
            <p className="text-secondary small mb-4 mt-2 line-height-base">{modal.message}</p>
            <div className="d-flex justify-content-end">
              <button 
                type="button" 
                className={`btn btn-sm px-4 fw-medium ${modal.type === 'success' ? 'btn-success' : modal.type === 'error' ? 'btn-danger' : 'btn-warning text-dark'}`}
                onClick={() => {
                  setModal(prev => ({ ...prev, isOpen: false }));
                  if (modal.onConfirm) modal.onConfirm();
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary small">&larr; Cancel and Go Back</Link>
      </div>

      <div className="card p-4 shadow-sm border-0 bg-white text-dark">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-bold mb-0 fs-4">Create New Loan Account</h2>
        </div>

        <form onSubmit={handleSubmit}>
          
          <div className="mb-3">
            <label className="form-label fw-semibold small text-secondary">Loan Identification / Entry Name</label>
            <input type="text" className="form-control" required value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="e.g., Personal Equipment Finance Term" />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold small text-secondary">Transaction Structure</label>
              <select className="form-select" value={transactionType} onChange={(e) => {
                setTransactionType(e.target.value);
                setBorrowerNameInput("");
                setGroupName("");
              }}>
                <option value="installment_expense">Installment Expense Matrix</option>
                <option value="straight_loan">Straight Loan / Single Payout</option>
                <option value="group_expense">Group Expense</option>
              </select>
            </div>
            <div className="col-sm-6">
              <label className="form-label fw-semibold small text-secondary">Principal Amount Borrowed</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-secondary border-end-0">₱</span>
                <input type="number" step="0.01" className="form-control border-start-0" required value={amountBorrowed} onChange={(e) => setAmountBorrowed(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            {transactionType === "group_expense" ? (
              <div className="col-sm-6 position-relative">
                <label className="form-label fw-semibold small text-secondary">Borrower (Group)</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Type or Select Group"
                  value={groupName}
                  onFocus={() => setActiveDropdown({ field: "group" })}
                  onChange={(e) => { setGroupName(e.target.value); setActiveDropdown({ field: "group" }); }}
                />
                {activeDropdown.field === "group" && filteredGroups.length > 0 && (
                  <ul className="dropdown-menu show w-100 shadow-sm border border-light-subtle position-absolute start-0 mt-1 overflow-y-auto" style={{ maxHeight: "200px", zIndex: 1000 }}>
                    {filteredGroups.map(g => (
                      <li key={g.group_id}>
                        <button type="button" className="dropdown-item py-2 border-bottom border-light-subtle text-start" onClick={() => { setGroupName(g.group_name); setActiveDropdown({ field: null }); }}>
                          <div className="fw-medium text-dark">{g.group_name}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="col-sm-6 position-relative">
                <label className="form-label fw-semibold small text-secondary">Borrower profile</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Type or Select Borrower"
                  value={borrowerNameInput}
                  onFocus={() => setActiveDropdown({ field: "borrower" })}
                  onChange={(e) => { setBorrowerNameInput(e.target.value); setActiveDropdown({ field: "borrower" }); }}
                />
                {activeDropdown.field === "borrower" && filteredPeopleBorrowers.length > 0 && (
                  <ul className="dropdown-menu show w-100 shadow-sm border border-light-subtle position-absolute start-0 mt-1 overflow-y-auto" style={{ maxHeight: "200px", zIndex: 1000 }}>
                    {filteredPeopleBorrowers.map(b => (
                      <li key={b.contact_id}>
                        <button type="button" className="dropdown-item py-2 border-bottom border-light-subtle text-start" onClick={() => { setBorrowerNameInput(b.name); setActiveDropdown({ field: null }); }}>
                          <div className="fw-medium text-dark">{b.name}</div>
                          {b.contact_info && <div className="text-muted small fs-7">{b.contact_info}</div>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="col-sm-6 position-relative">
              <label className="form-label fw-semibold small text-secondary">Lender profile</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="Type or Select Lender"
                value={lenderNameInput}
                onFocus={() => setActiveDropdown({ field: "lender" })}
                onChange={(e) => { setLenderNameInput(e.target.value); setActiveDropdown({ field: "lender" }); }}
              />
              {activeDropdown.field === "lender" && filteredLenders.length > 0 && (
                <ul className="dropdown-menu show w-100 shadow-sm border border-light-subtle position-absolute start-0 mt-1 overflow-y-auto" style={{ maxHeight: "200px", zIndex: 1000 }}>
                  {filteredLenders.map(l => (
                    <li key={l.contact_id}>
                      <button type="button" className="dropdown-item py-2 border-bottom border-light-subtle text-start" onClick={() => { setLenderNameInput(l.name); setActiveDropdown({ field: null }); }}>
                        <div className="fw-medium text-dark">{l.name}</div>
                        {l.contact_info && <div className="text-muted small fs-7">{l.contact_info}</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {transactionType === "installment_expense" && (
            <div className="p-3 bg-light rounded mb-4 border border-info-subtle">
              <h6 className="fw-bold text-info-emphasis mb-3 small uppercase tracking-wide">Installment Generation Parameters</h6>
              
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small mb-1 text-secondary">Payment Frequency</label>
                  <select className="form-select form-select-sm" value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)}>
                    <option value="Monthly">Monthly Cycle</option>
                    <option value="Weekly">Weekly Cycle</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1 text-secondary">Total Fixed Terms</label>
                  <input type="number" className="form-control form-control-sm" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} min="1" />
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small mb-1 text-secondary">Target Start Effective Date</label>
                  <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1 text-secondary">Recurrence Due Day</label>
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
            <div className="p-3 bg-light rounded mb-4 border border-primary-subtle">
              <h6 className="fw-bold text-primary mb-3 small uppercase tracking-wide">Manage Group Members List</h6>

              <div className="mb-3">
                {manualMembers.map((member, index) => {
                  const filteredRowContacts = contacts.filter(c => {
                    const isPerson = c.type === "person"
                    const matchesInput = c.name.toLowerCase().includes(member.name.toLowerCase())
                    const isNotYetSelected = !activeSelectedNamesSet.has(c.name.trim().toLowerCase()) || c.name.toLowerCase() === member.name.toLowerCase()
                    const isNotLender = c.name.toLowerCase() !== lenderNameInput.trim().toLowerCase()
                    return isPerson && matchesInput && isNotYetSelected && isNotLender
                  })
                  
                  return (
                    <div key={index} className="row g-2 mb-2 align-items-center position-relative">
                      <div className="col-5 position-relative">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Search or Type Name"
                          value={member.name}
                          onFocus={() => setActiveDropdown({ field: "member_row", index })}
                          onChange={(e) => { handleManualMemberNameChange(index, e.target.value); setActiveDropdown({ field: index }); }}
                        />
                        {activeDropdown.field === "member_row" &&
 activeDropdown.index === index &&
 filteredRowContacts.length > 0 && (
                          <ul className="dropdown-menu show w-100 shadow-sm border border-light-subtle position-absolute start-0 mt-1 overflow-y-auto" style={{ maxHeight: "150px", zIndex: 1010 }}>
                            {filteredRowContacts.map(c => (
                              <li key={c.contact_id}>
                                <button type="button" className="dropdown-item py-1 border-bottom border-light-subtle text-start small" onClick={() => { handleManualMemberNameChange(index, c.name); setActiveDropdown({ field: null, index: undefined }); }}>
                                  <strong>{c.name}</strong>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="col-5">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Phone / Info (Optional)"
                          value={member.phone}
                          onChange={(e) => handleManualMemberPhoneChange(index, e.target.value)}
                        />
                      </div>
                      <div className="col-2 text-end">
                        <button type="button" className="btn btn-outline-danger btn-sm px-2 py-1 border-0" onClick={() => handleRemoveManualMember(index)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* INLINE BULK MULTI-SELECT FILTER BAR */}
              <div className="position-relative mb-3 pt-2 border-top border-light-subtle">
                <label className="form-label small text-secondary fw-semibold mb-1">Quick Add Registered Contacts</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm bg-white" 
                  placeholder="Click to browse or search profiles..." 
                  value={bulkSearchQuery}
                  onFocus={() => setActiveDropdown({ field: "bulk_members" })}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                />
                {activeDropdown.field === "bulk_members" && filteredBulkOptions.length > 0 && (
                  <ul className="dropdown-menu show w-100 shadow-sm border border-light-subtle position-absolute start-0 mt-1 overflow-y-auto" style={{ maxHeight: "180px", zIndex: 1020 }}>
                    {filteredBulkOptions.map(c => (
                      <li key={c.contact_id}>
                        <button type="button" className="dropdown-item py-2 border-bottom border-light-subtle text-start d-flex justify-content-between align-items-center" onClick={() => handleSelectBulkMember(c)}>
                          <div>
                            <span className="fw-medium text-dark d-block small">{c.name}</span>
                            {c.contact_info && <span className="text-muted fs-7 d-block">{c.contact_info}</span>}
                          </div>
                          <span className="badge bg-primary-subtle text-primary rounded-pill px-2 py-1 font-monospace fs-8">+ Append</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted small fs-7">Roster Size: <strong>{manualMembers.filter(m => m.name.trim()).length} member(s)</strong></span>
                <button type="button" className="btn btn-link btn-sm text-decoration-none p-0 text-primary fw-medium" onClick={handleAddManualMember}>
                  + Add Empty Row
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-2 border-top d-flex gap-2 justify-content-end">
            <button type="submit" className="btn btn-primary btn-sm px-4 fw-medium shadow-sm" disabled={submitting}>
              {submitting ? "Saving Transaction..." : "Save Loan Agreement"}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}