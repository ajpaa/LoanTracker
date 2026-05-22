"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation" 
import { supabase } from "@/services/supabase"
import PaymentAllocation from "../../components/payment/paymentAllocation" 

interface StorageFile {
  name: string
  url: string
}

interface PaymentRecord {
  id: string
  payment_amount: number
  payment_date: string
  payer_name?: string
  payee_name?: string
  notes: string
  proof_urls?: StorageFile[]
  is_skip?: boolean // flag to identify manual skips in history
}

export default function LoanDetailsPage() {
  const { id } = useParams() 
  const activeEntryId = id as string

  // Read-only Data States
  const [entry, setEntry] = useState<any>(null)
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paymentLogs, setPaymentLogs] = useState<PaymentRecord[]>([])
  
  // Interactive Modal, Inline Editing & Staging States
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [loadingInitialData, setLoadingInitialData] = useState(true)
  const [isEditingDateBorrowed, setIsEditingDateBorrowed] = useState(false)
  const [dateBorrowedInput, setDateBorrowedInput] = useState("")
  const [updatingDateBorrowed, setUpdatingDateBorrowed] = useState(false)
  const [isEditingGlobalNotes, setIsEditingGlobalNotes] = useState(false)
  const [isSavingGlobalNotes, setIsSavingGlobalNotes] = useState(false)
  const [globalNotesInput, setGlobalNotesInput] = useState("")
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  
  // --- INLINE TRANSACTION EDITING STATES ---
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingNotesInput, setEditingNotesInput] = useState("")
  const [savingLogEdits, setSavingLogEdits] = useState(false)

  // --- REQUIRED PAYMENT ATTRIBUTES FOR THE MODAL ---
  const [paymentAmountInput, setPaymentAmountInput] = useState("")
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotesInput, setPaymentNotesInput] = useState("")
  const [modalFiles, setModalFiles] = useState<StorageFile[]>([])
  const [uploadingModalFile, setUploadingModalFile] = useState(false)

  // Live dynamic master calculations
  const amountBorrowed = entry?.amount_borrowed || 0
  const paymentTerms = entry?.payment_terms || 12 
  const transactionType = entry?.transaction_type || "installment_expense"
  
  const calculationPercentage = amountBorrowed > 0 ? Math.min(Math.round((amountPaid / amountBorrowed) * 100), 100) : 0
  const amountPerTerm = transactionType === "installment_expense" && amountBorrowed > 0 ? (amountBorrowed / paymentTerms) : amountBorrowed

  // Safely parse database text values back into objects/arrays
  const parseFilesColumn = (rawText: any): StorageFile[] => {
    if (!rawText) return []
    if (Array.isArray(rawText)) return rawText
    try {
      const parsed = JSON.parse(rawText)
      if (Array.isArray(parsed)) return parsed
    } catch {
      if (typeof rawText === 'string' && rawText.startsWith('http')) {
        return [{ name: "Receipt Attachment Document", url: rawText }]
      }
    }
    return []
  }

  const currentLoanReceipts = parseFilesColumn(entry?.receipt_url)

  useEffect(() => {
    async function loadLoanAndPayments() {
      if (!activeEntryId) return

      try {
        setLoadingInitialData(true)

        // 1. Fetch core loan records
        const { data: loanData, error: loanError } = await supabase
          .from("entries")
          .select(`
            *,
            borrower:borrower_id(name),
            lender:lender_id(name)
          `)
          .eq("id", activeEntryId)
          .single()

        if (loanError) throw loanError

        if (loanData) {
          setEntry(loanData)
          setPaymentStatus(loanData.status || "unpaid")
          setGlobalNotesInput(loanData.notes || "")
          
          if (loanData.created_at || loanData.date_borrowed) {
            const fallingBackDate = loanData.date_borrowed || loanData.created_at.split('T')[0]
            setDateBorrowedInput(fallingBackDate)
          }
        }

        // 2. Fetch payments history
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select(`
            *,
            payee:payee_id(name)
          `) 
          .eq("entry_id", activeEntryId)
          .order("payment_date", { ascending: false })

        if (paymentsError) throw paymentsError

        if (paymentsData) {
          const totalSettled = paymentsData.reduce((sum, item) => sum + (parseFloat(item.payment_amount) || 0), 0)
          setAmountPaid(totalSettled)

          const structuredLogs = paymentsData.map((p: any) => ({
            id: p.id,
            payment_amount: parseFloat(p.payment_amount) || 0,
            payment_date: p.payment_date,
            payer_name: loanData?.borrower?.name || "Borrower",
            payee_name: p.payee?.name || loanData?.lender?.name || "Lender",
            notes: p.notes || "",
            proof_urls: parseFilesColumn(p.proof_url),
            is_skip: p.notes?.includes("[MANUAL TERM SKIP]") || parseFloat(p.payment_amount) === 0
          }))
          setPaymentLogs(structuredLogs)
        }

      } catch (err: any) {
        console.error("Error synchronizing saved ledger state:", err.message)
      } finally {
        setLoadingInitialData(false)
      }
    }

    loadLoanAndPayments()
  }, [activeEntryId])

  // --- DYNAMIC TERM MATRIX GENERATION ---
  // Calculates real schedules to accurately display current term counts and dynamic badges
  const getInstallmentTermMetrics = () => {
    if (!entry || transactionType !== "installment_expense") {
      return { currentTermIndex: 1, currentTermStatus: "UNPAID" }
    }

    const startDateStr = entry.date_borrowed || entry.created_at?.split('T')[0]
    if (!startDateStr) return { currentTermIndex: 1, currentTermStatus: "UNPAID" }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Sort chronological (oldest first) to see which terms were settled
    const chronolLogs = [...paymentLogs].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
    
    // Determine current index based on how many records (payments or skips) exist
    const completedOrSkippedCount = chronolLogs.length
    const currentTermIndex = Math.min(completedOrSkippedCount + 1, paymentTerms)

    // Calculate dynamic milestone dates for the current active term (assuming monthly windows)
    const currentTermStartDate = new Date(startDateStr)
    currentTermStartDate.setMonth(currentTermStartDate.getMonth() + (currentTermIndex - 1))
    
    const currentTermDueDate = new Date(startDateStr)
    currentTermDueDate.setMonth(currentTermDueDate.getMonth() + currentTermIndex)

    let currentTermStatus = "UNPAID"

    // 1. NOT STARTED: System date is before the installment start date
    if (today < currentTermStartDate) {
      currentTermStatus = "NOT STARTED"
    } 
    // 2. Checking history flags if the index matches past entries
    else if (completedOrSkippedCount >= currentTermIndex) {
      const correspondingLog = chronolLogs[currentTermIndex - 1]
      if (correspondingLog?.is_skip) {
        currentTermStatus = "SKIPPED"
      } else {
        currentTermStatus = "PAID"
      }
    } 
    // 3. DELINQUENT: Lapsed past the term window without payments logged
    else if (today > currentTermDueDate) {
      currentTermStatus = "DELINQUENT"
    } 
    // 4. UNPAID: Inside active current runtime window but no transaction captured
    else {
      currentTermStatus = "UNPAID"
    }

    return { currentTermIndex, currentTermStatus }
  }

  const { currentTermIndex, currentTermStatus } = getInstallmentTermMetrics()

  const handleSaveGlobalNotes = async () => {
    try {
      setIsSavingGlobalNotes(true)
      const { error } = await supabase
        .from("entries")
        .update({ notes: globalNotesInput.trim() || null })
        .eq("id", activeEntryId)

      if (error) throw error
      setEntry((prev: any) => ({ ...prev, notes: globalNotesInput.trim() }))
      setIsEditingGlobalNotes(false)
    } catch (err: any) {
      alert(`Could not save loan notes: ${err.message}`)
    } finally {
      setIsSavingGlobalNotes(false)
    }
  }

  const handleUpdateDateBorrowed = async () => {
    if (!dateBorrowedInput) return
    try {
      setUpdatingDateBorrowed(true)
      const { error } = await supabase
        .from("entries")
        .update({ date_borrowed: dateBorrowedInput })
        .eq("id", activeEntryId)

      if (error) throw error
      setEntry((prev: any) => ({ ...prev, date_borrowed: dateBorrowedInput }))
      setIsEditingDateBorrowed(false)
    } catch (err: any) {
      alert(`Could not update initialization window: ${err.message}`)
    } finally {
      setUpdatingDateBorrowed(false)
    }
  }

  const handleUploadFile = async (file: File, bucket: string): Promise<StorageFile | null> => {
    const customNameInput = prompt("Enter a descriptive custom name for this file asset:", file.name.split('.')[0])
    if (customNameInput === null) return null 
    
    const finalizedDisplayName = customNameInput.trim() || file.name.split('.')[0]
    const fileExtension = file.name.split('.').pop()
    const storageFilePath = `${activeEntryId}/asset_${Date.now()}.${fileExtension}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storageFilePath, file)

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storageFilePath)

    return {
      name: finalizedDisplayName,
      url: publicUrlData.publicUrl
    }
  }

  const handleAddLoanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetFile = e.target.files?.[0]
    if (!targetFile) return

    try {
      setUploadingReceipt(true)
      const uploadedAsset = await handleUploadFile(targetFile, "loan-receipts")
      if (!uploadedAsset) return

      const progressiveList = [...currentLoanReceipts, uploadedAsset]

      const { error: dbUpdateError } = await supabase
        .from("entries")
        .update({ receipt_url: JSON.stringify(progressiveList) })
        .eq("id", activeEntryId)

      if (dbUpdateError) throw dbUpdateError

      setEntry((prev: any) => ({ ...prev, receipt_url: progressiveList }))
    } catch (err: any) {
      alert(`Document pipeline upload failure: ${err.message}`)
    } finally {
      setUploadingReceipt(false)
      e.target.value = ""
    }
  }

  const handleRemoveLoanReceipt = async (indexToRemove: number) => {
    if (!confirm("Are you sure you want to decouple this receipt file attachment?")) return
    try {
      const remainingAssets = currentLoanReceipts.filter((_, idx) => idx !== indexToRemove)
      
      const { error } = await supabase
        .from("entries")
        .update({ receipt_url: remainingAssets.length > 0 ? JSON.stringify(remainingAssets) : null })
        .eq("id", activeEntryId)

      if (error) throw error
      setEntry((prev: any) => ({ ...prev, receipt_url: remainingAssets.length > 0 ? remainingAssets : null }))
    } catch (err: any) {
      alert(`Could not remove file attachment link: ${err.message}`)
    }
  }

  const handleAddModalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetFile = e.target.files?.[0]
    if (!targetFile) return

    try {
      setUploadingModalFile(true)
      const uploadedAsset = await handleUploadFile(targetFile, "loan-receipts")
      if (uploadedAsset) {
        setModalFiles(prev => [...prev, uploadedAsset])
      }
    } catch (err: any) {
      alert(`Temporary file context upload failed: ${err.message}`)
    } finally {
      setUploadingModalFile(false)
      e.target.value = ""
    }
  }

  const handleRemoveModalFile = (indexToRemove: number) => {
    setModalFiles(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleOpenPaymentModal = () => {
    const remainingToPay = Math.max(amountBorrowed - amountPaid, 0)
    if (transactionType === "straight_expense") {
      setPaymentAmountInput(remainingToPay.toFixed(2))
    } else if (amountPerTerm > 0) {
      setPaymentAmountInput(amountPerTerm.toFixed(2))
    }
    
    setPaymentDateInput(new Date().toISOString().split('T')[0])
    setPaymentNotesInput("")
    setModalFiles([])
    setShowPaymentModal(true)
  }

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedInput = parseFloat(paymentAmountInput)

    if (!activeEntryId || !parsedInput || parsedInput <= 0) {
      alert("Please ensure all required payment parameters are valid.")
      return
    }

    try {
      setProcessingPayment(true)
      const nextTotalPaid = amountPaid + parsedInput
      const isNowFullyPaid = amountBorrowed - nextTotalPaid <= 0
      const evaluatedStatus = isNowFullyPaid ? "paid" : "partially_paid"
      const completionTimestamp = isNowFullyPaid ? new Date().toISOString().split('T')[0] : null

      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert([
          {
            entry_id: activeEntryId,            
            payment_amount: parsedInput,        
            payment_date: paymentDateInput,
            payee_id: entry?.lender_id || null, 
            proof_url: modalFiles.length > 0 ? JSON.stringify(modalFiles) : null, 
            notes: paymentNotesInput.trim() || `Term payment logged confirmation.`
          }
        ])
        .select()
        .single()

      if (paymentError) throw paymentError

      const { error: entryUpdateError } = await supabase
        .from("entries")
        .update({ 
          status: evaluatedStatus,
          date_fully_paid: completionTimestamp
        })
        .eq("id", activeEntryId)

      if (entryUpdateError) throw entryUpdateError

      setAmountPaid(nextTotalPaid)
      setPaymentStatus(evaluatedStatus)
      setEntry((prev: any) => ({ 
        ...prev, 
        status: evaluatedStatus, 
        date_fully_paid: completionTimestamp 
      }))

      const appendedLog: PaymentRecord = {
        id: newPayment.id,
        payment_amount: parsedInput,
        payment_date: paymentDateInput,
        payer_name: entry?.borrower?.name || "Borrower",
        payee_name: entry?.lender?.name || "Lender",
        notes: paymentNotesInput.trim() || `Term payment logged confirmation.`,
        proof_urls: modalFiles,
        is_skip: false
      }
      setPaymentLogs(prev => [appendedLog, ...prev])
      setShowPaymentModal(false)

    } catch (error: any) {
      alert(`Could not save transaction context: ${error.message}`)
    } finally {
      setProcessingPayment(false)
    }
  }

  // --- LOG MANUAL TERM SKIP AS AN INSTANCE IN THE LEDGER ---
  const handleManualSkipTerm = async () => {
    if (!confirm(`Are you sure you want to mark Term ${currentTermIndex} as SKIPPED?`)) return
    
    try {
      const skipTimestamp = new Date().toISOString().split('T')[0]
      
      const { data: skippedRecord, error: skipError } = await supabase
        .from("payments")
        .insert([
          {
            entry_id: activeEntryId,
            payment_amount: 0, // No currency balance transferred
            payment_date: skipTimestamp,
            payee_id: entry?.lender_id || null,
            proof_url: null,
            notes: `[MANUAL TERM SKIP] Term ${currentTermIndex} was explicitly passed by ledger administrator.`
          }
        ])
        .select()
        .single()

      if (skipError) throw skipError

      const appendedLog: PaymentRecord = {
        id: skippedRecord.id,
        payment_amount: 0,
        payment_date: skipTimestamp,
        payer_name: entry?.borrower?.name || "Borrower",
        payee_name: entry?.lender?.name || "Lender",
        notes: `[MANUAL TERM SKIP] Term ${currentTermIndex} was explicitly passed by ledger administrator.`,
        proof_urls: [],
        is_skip: true
      }

      setPaymentLogs(prev => [appendedLog, ...prev])
    } catch (err: any) {
      alert(`Failed committing manual matrix term bypass: ${err.message}`)
    }
  }

  const startEditingLog = (log: PaymentRecord) => {
    setEditingLogId(log.id)
    setEditingNotesInput(log.notes)
  }

  const handleSaveLogEdits = async (logId: string) => {
    try {
      setSavingLogEdits(true)
      const { error } = await supabase
        .from("payments")
        .update({ notes: editingNotesInput.trim() || null })
        .eq("id", logId)

      if (error) throw error

      setPaymentLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, notes: editingNotesInput.trim() } : log
      ))
      setEditingLogId(null)
    } catch (err: any) {
      alert(`Could not patch ledger entry details: ${err.message}`)
    } finally {
      setSavingLogEdits(false)
    }
  }

  const handleUpdateLogFiles = async (logId: string, currentFiles: StorageFile[], fileInputEvent: React.ChangeEvent<HTMLInputElement>) => {
    const targetFile = fileInputEvent.target.files?.[0]
    if (!targetFile) return

    try {
      const uploadedAsset = await handleUploadFile(targetFile, "loan-receipts")
      if (!uploadedAsset) return

      const advancedFileList = [...currentFiles, uploadedAsset]

      const { error } = await supabase
        .from("payments")
        .update({ proof_url: JSON.stringify(advancedFileList) })
        .eq("id", logId)

      if (error) throw error

      setPaymentLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, proof_urls: advancedFileList } : log
      ))
    } catch (err: any) {
      alert(`Failed processing structural files patch: ${err.message}`)
    } finally {
      fileInputEvent.target.value = ""
    }
  }

  const handleRemoveLogFile = async (logId: string, currentFiles: StorageFile[], indexToRemove: number) => {
    if (!confirm("De-couple this file asset configuration link?")) return
    try {
      const advancedFileList = currentFiles.filter((_, idx) => idx !== indexToRemove)

      const { error } = await supabase
        .from("payments")
        .update({ proof_url: advancedFileList.length > 0 ? JSON.stringify(advancedFileList) : null })
        .eq("id", logId)

      if (error) throw error

      setPaymentLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, proof_urls: advancedFileList } : log
      ))
    } catch (err: any) {
      alert(`Could not strip target log attachment link: ${err.message}`)
    }
  }

  // Determine styling variations for the new runtime status flags
  const getBadgeColorStyles = (status: string) => {
    switch (status) {
      case "PAID": return "bg-success text-white"
      case "UNPAID": return "bg-warning text-dark"
      case "SKIPPED": return "bg-secondary text-white"
      case "DELINQUENT": return "bg-danger text-white"
      case "NOT STARTED": default: return "bg-light text-muted border"
    }
  }

  if (loadingInitialData) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Syncing data profiles...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-4" style={{ maxWidth: "680px" }}>

      <div className="mb-3">
        <Link href="/loans" className="text-decoration-none text-secondary">
          &larr; Back to Loans List
        </Link>
      </div>

      {/* --- MAIN PROFILE COMPONENT --- */}
      <div className="card p-4 shadow-sm mb-4 position-relative bg-white">
        
        <div className="position-absolute" style={{ top: "1.5rem", right: "1.5rem" }}>
          <span className={`badge text-uppercase px-2.5 py-1.5 small fw-bold tracking-wide ${
            paymentStatus === 'fully_paid' || paymentStatus === 'paid' ? 'bg-success text-white' :
            paymentStatus === 'partially_paid' ? 'bg-info text-dark' : 'bg-warning text-dark'
          }`}>{paymentStatus.replace('_', ' ')}</span>
        </div>

        <h3 className="fw-bold mb-1 pe-5">Loan Overview</h3>
        <p className="text-muted small mb-4">
          Overview profile of the saved shared liability balancing record.
        </p>

        <div className="text-center py-4 mb-2 border-bottom">
          <div className="text-uppercase tracking-wider text-secondary small mb-1" style={{ fontSize: "11px" }}>Amount Borrowed</div>
          <div className="text-dark display-5 fw-normal">₱{amountBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="list-group list-group-flush mb-2">
          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">Loan Entry Name</span>
            <span className="text-secondary">{entry?.entry_name}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">Transaction Type</span>
            <span className="text-secondary text-capitalize">{transactionType.replace("_", " ")}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">Borrower Name (Payer)</span>
            <span className="text-secondary">{entry?.borrower?.name || entry?.borrower_id}</span>
          </div>
          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">Lender Name (Receiver)</span>
            <span className="text-secondary">{entry?.lender?.name || entry?.lender_id}</span>
          </div>

          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">
              Date Borrowed 
              {!isEditingDateBorrowed && (
                <span className="text-primary ps-1.5 fw-normal text-decoration-none" onClick={() => setIsEditingDateBorrowed(true)} style={{ cursor: "pointer", fontSize: '11px' }}>
                  ✏️ Edit
                </span>
              )}
            </span>
            {isEditingDateBorrowed ? (
              <div className="d-flex align-items-center gap-1">
                <input 
                  type="date" 
                  className="form-control form-control-sm py-0.5" 
                  value={dateBorrowedInput}
                  onChange={(e) => setDateBorrowedInput(e.target.value)}
                  disabled={updatingDateBorrowed}
                />
                <button className="btn btn-sm btn-success py-0 px-2" onClick={handleUpdateDateBorrowed} disabled={updatingDateBorrowed}>✓</button>
                <button className="btn btn-sm btn-light border py-0 px-2" onClick={() => setIsEditingDateBorrowed(false)}>×</button>
              </div>
            ) : (
              <span className="text-secondary small">
                {entry?.date_borrowed || entry?.created_at?.split('T')[0]}
              </span>
            )}
          </div>

          <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
            <span className="small fw-bold text-dark">Date Fully Paid</span>
            <span className="small text-secondary">
              {entry?.date_fully_paid ? entry.date_fully_paid : "Not yet paid"}
            </span>
          </div>

          <div className="list-group-item px-0 py-2.5">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-dark">Proof of Loan Documents</span>
              <div className="position-relative">
                <button className="btn btn-sm btn-outline-primary py-0.5 px-2 text-xs" style={{ fontSize: "11px" }} disabled={uploadingReceipt}>
                  {uploadingReceipt ? "Uploading..." : "➕ Attach File"}
                </button>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="position-absolute top-0 start-0 opacity-0 w-100 h-100" 
                  style={{ cursor: "pointer" }}
                  onChange={handleAddLoanReceipt}
                  disabled={uploadingReceipt}
                />
              </div>
            </div>

            {currentLoanReceipts.length > 0 ? (
              <div className="d-flex flex-wrap gap-1 mt-2">
                {currentLoanReceipts.map((file, idx) => (
                  <div key={idx} className="d-inline-flex align-items-center bg-light border rounded px-2 py-1 small" style={{ fontSize: "11px" }}>
                    <a href={file.url} target="_blank" rel="noreferrer" className="text-primary text-decoration-none me-2 fw-semibold">
                      📄 {file.name} ↗
                    </a>
                    <span className="text-danger border-start ps-1.5" onClick={() => handleRemoveLoanReceipt(idx)} style={{ cursor: "pointer" }}>
                      ×
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-muted small italic" style={{ fontSize: "11px" }}>No document files attached to master parameters.</span>
            )}
          </div>
        </div>
      </div>

      {/* --- LOAN NOTES INTERACTIVE UTILITY CARD --- */}
      <div className="card p-3 shadow-sm bg-white mb-4">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <label className="form-label small fw-bold text-dark m-0">Loan Notes</label>
          {!isEditingGlobalNotes && (
            <button 
              type="button" 
              className="btn btn-sm p-0 text-primary small fw-semibold" 
              style={{ fontSize: "12px" }}
              onClick={() => setIsEditingGlobalNotes(true)}
            >
              {entry?.notes ? "✏️ Edit Notes" : "➕ Add Notes"}
            </button>
          )}
        </div>

        {isEditingGlobalNotes ? (
          <div>
            <textarea
              className="form-control form-control-sm text-secondary mb-2"
              rows={3}
              placeholder="Log agreements or historical timelines for this loan asset contract..."
              value={globalNotesInput}
              onChange={(e) => setGlobalNotesInput(e.target.value)}
            />
            <div className="d-flex justify-content-end gap-1">
              <button 
                type="button" 
                className="btn btn-light border btn-sm px-2.5" 
                style={{ fontSize: "11px" }}
                onClick={() => {
                  setGlobalNotesInput(entry?.notes || "")
                  setIsEditingGlobalNotes(false)
                }}
                disabled={isSavingGlobalNotes}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm px-3" 
                onClick={handleSaveGlobalNotes}
                disabled={isSavingGlobalNotes}
                style={{ fontSize: "11px" }}
              >
                {isSavingGlobalNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        ) : (
          <p className={`m-0 small ${entry?.notes ? 'text-secondary' : 'text-muted italic'}`}>
            {entry?.notes ? entry.notes : "No notes logged for this structural loan contract account."}
          </p>
        )}
      </div>

      {entry && (
        <PaymentAllocation
          loanId={entry.id}
          transactionType={entry.transaction_type}
          borrowerId={entry.borrower_id ?? entry.borrower?.contact_id}
        />
      )}

      {entry && entry.transaction_type !== "group_expense" && (
        <div className="card p-3 text-center text-muted border-dashed bg-white mb-4 small">
          This is an individual expense ({transactionType.replace("_", " ")}). Group allocation tools are hidden.
        </div>
      )}

      {/* --- DESIGN VIEW A: INSTALLMENT MONITOR VIEW --- */}
      {transactionType === "installment_expense" && (
        <div className="card p-4 shadow-sm bg-white border border-info mb-4 position-relative">
          
          {/* Status Tag Layout */}
          <div className="position-absolute" style={{ top: "1.5rem", right: "1.5rem" }}>
            <span className={`badge px-2.5 py-1.5 small fw-bold tracking-wide text-uppercase ${getBadgeColorStyles(currentTermStatus)}`}>
              {currentTermStatus}
            </span>
          </div>

          <h5 className="fw-bold text-dark mb-1">Installment Details</h5>
          <p className="text-muted small mb-3">
            Timeline monitoring track and interactive term controls. 
            <span className="text-dark fw-bold ps-1">Term {currentTermIndex} of {paymentTerms}</span>
          </p>

          <div className="row g-2 mb-3 bg-light p-2 rounded small text-secondary">
            <div className="col-6"><strong>Term Value Rate:</strong> ₱{amountPerTerm.toFixed(2)}</div>
            <div className="col-6"><strong>Target Horizon:</strong> {paymentTerms} Payments</div>
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between small fw-bold mb-1 text-secondary">
              <span>Collection Matrix Progress</span>
              <span>{calculationPercentage}% Complete</span>
            </div>
            <div className="progress" style={{ height: "10px" }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                role="progressbar"
                style={{ width: `${calculationPercentage}%` }}
                aria-valuenow={calculationPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="d-flex justify-content-between text-muted small mt-1" style={{ fontSize: '11px' }}>
              <span>Settled: ₱{amountPaid.toFixed(2)}</span>
              <span>Target: ₱{amountBorrowed.toFixed(2)}</span>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm flex-grow-1"
              onClick={handleOpenPaymentModal}
              disabled={amountBorrowed === 0 || paymentStatus === 'fully_paid' || paymentStatus === 'paid'}
            >
              ➕ Add Payment
            </button>
            <button
              type="button"
              className="btn btn-outline-warning btn-sm flex-grow-1"
              onClick={handleManualSkipTerm}
              disabled={paymentStatus === 'fully_paid' || paymentStatus === 'paid' || currentTermStatus === 'SKIPPED'}
            >
              ⏭️ Skip Term
            </button>
          </div>
        </div>
      )}

      {/* --- DESIGN VIEW B: STRAIGHT EXPENSE TRACKING VIEW --- */}
      {transactionType === "straight_expense" && (
        <div className="card p-4 shadow-sm bg-white border border-primary mb-4">
          <h5 className="fw-bold text-dark mb-1">Settlement Tracking</h5>
          <p className="text-muted small mb-3">One-time payment transaction ledger metrics.</p>

          <div className="mb-4">
            <div className="d-flex justify-content-between small fw-bold mb-1 text-secondary">
              <span>Payment Progress</span>
              <span>{calculationPercentage}% Settled</span>
            </div>
            <div className="progress" style={{ height: "10px" }}>
              <div
                className="progress-bar bg-primary"
                role="progressbar"
                style={{ width: `${calculationPercentage}%` }}
                aria-valuenow={calculationPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="d-flex justify-content-between text-muted small mt-1" style={{ fontSize: '11px' }}>
              <span>Paid: ₱{amountPaid.toFixed(2)}</span>
              <span>Remaining Balance: ₱{Math.max(amountBorrowed - amountPaid, 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="d-flex">
            <button
              type="button"
              className="btn btn-primary btn-sm w-100"
              onClick={handleOpenPaymentModal}
              disabled={amountBorrowed === 0 || paymentStatus === 'fully_paid' || paymentStatus === 'paid'}
            >
              ➕ Record Full Settlement
            </button>
          </div>
        </div>
      )}

      {/* --- RECONCILED SETTLEMENT INSTANCE RECORDS LOG --- */}
      <div className="card p-4 shadow-sm bg-white border mb-4">
        <h5 className="fw-bold text-dark mb-1">Settlement History Ledger</h5>
        <p className="text-muted small mb-3">Granular records logs of verified funds capture events.</p>

        {paymentLogs.length > 0 ? (
          <div className="d-flex flex-column gap-3">
            {paymentLogs.map((log) => {
              const logProofs = log.proof_urls || []
              return (
                /* Individual Dedicated Box Container per Transaction Instance */
                <div key={log.id} className="card p-3 shadow-sm bg-white border">
                  
                  {/* Clean Form List Configuration */}
                  <div className="list-group list-group-flush">
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                      <span className="small fw-bold text-dark">Amount Paid</span>
                      <span className={`fw-bold ${log.is_skip ? 'text-secondary' : 'text-success'}`}>
                        ₱{log.payment_amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                      <span className="small fw-bold text-dark">Date Logged</span>
                      <span className="text-secondary small">{log.payment_date}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                      <span className="small fw-bold text-dark">Payer Name</span>
                      <span className="text-secondary small">{log.payer_name}</span>
                    </div>

                    {/* PAYMENT NOTES (Matches Global Loan Notes Styling) */}
                    <div className="list-group-item px-0 py-2.5 border-0">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small fw-bold text-dark m-0">Payment Notes</span>
                        {editingLogId !== log.id && (
                          <button 
                            type="button" 
                            className="btn btn-sm p-0 text-primary small fw-semibold" 
                            style={{ fontSize: "12px" }}
                            onClick={() => startEditingLog(log)}
                          >
                            {log.notes ? "✏️ Edit Notes" : "➕ Add Notes"}
                          </button>
                        )}
                      </div>

                      {editingLogId === log.id ? (
                        <div className="mt-2">
                          <textarea 
                            className="form-control form-control-sm text-secondary small mb-2" 
                            rows={2} 
                            value={editingNotesInput} 
                            onChange={(e) => setEditingNotesInput(e.target.value)}
                          />
                          <div className="d-flex justify-content-end gap-1">
                            <button className="btn btn-light border btn-sm px-2.5" style={{ fontSize: "11px" }} onClick={() => setEditingLogId(null)} disabled={savingLogEdits}>Cancel</button>
                            <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: "11px" }} onClick={() => handleSaveLogEdits(log.id)} disabled={savingLogEdits}>Save Notes</button>
                          </div>
                        </div>
                      ) : (
                        <p className={`m-0 small ${log.notes ? 'text-secondary' : 'text-muted italic'}`}>
                          {log.notes ? log.notes : "No specific payment notes attached."}
                        </p>
                      )}
                    </div>

                    {/* INSTANCE RECEIPT FILE PIPELINE (Matches Proof of Loan Documents Styling) */}
                    {!log.is_skip && (
                      <div className="list-group-item px-0 py-2.5 border-0">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-bold text-dark">Instance Payment Receipts</span>
                          <div className="position-relative">
                            <button className="btn btn-sm btn-outline-primary py-0.5 px-2 text-xs" style={{ fontSize: "11px" }}>
                              ➕ Attach File
                            </button>
                            <input 
                              type="file" 
                              accept="image/*,application/pdf" 
                              className="position-absolute top-0 start-0 opacity-0 w-100 h-100" 
                              style={{ cursor: "pointer" }}
                              onChange={(e) => handleUpdateLogFiles(log.id, logProofs, e)}
                            />
                          </div>
                        </div>
                        {logProofs.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1 mt-2">
                            {logProofs.map((file, idx) => (
                              <div key={idx} className="d-inline-flex align-items-center bg-light border rounded px-2 py-1 small" style={{ fontSize: "11px" }}>
                                <a href={file.url} target="_blank" rel="noreferrer" className="text-primary text-decoration-none me-2 fw-semibold">
                                  📄 {file.name} ↗
                                </a>
                                <span className="text-danger border-start ps-1.5" onClick={() => handleRemoveLogFile(log.id, logProofs, idx)} style={{ cursor: "pointer" }}>
                                  ×
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted small italic" style={{ fontSize: "11px" }}>No receipts logged for this instance transfer window.</span>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted border rounded small bg-light italic">
            No payments balance settlement logging records discovered.
          </div>
        )}
      </div>

      {/* --- CAPTURE TRANSACTIONAL MODAL WINDOW --- */}
      {showPaymentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "460px" }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header py-3 bg-dark text-white">
                <h5 className="modal-title m-0 fw-bold fs-6">Capture Receipt & Payment Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)} />
              </div>
              <form onSubmit={handleProcessPayment}>
                <div className="modal-body py-3 row g-3">
                  
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payment Date *</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      required
                      value={paymentDateInput}
                      onChange={(e) => setPaymentDateInput(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Amount Tendered *</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">₱</span>
                      <input
                        type="number"
                        className="form-control"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={paymentAmountInput}
                        onChange={(e) => setPaymentAmountInput(e.target.value)}
                        max={amountBorrowed - amountPaid}
                        disabled={processingPayment || transactionType === "straight_expense"}
                      />
                    </div>
                    {transactionType === "straight_expense" && (
                      <span className="text-muted" style={{ fontSize: "11px" }}>Amount is locked for complete straight single settlement closures.</span>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payer (Locked Party) *</label>
                    <input type="text" className="form-control form-control-sm text-secondary bg-light" disabled value={`${entry?.borrower?.name || "Borrower"} (Borrower Account)`} />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payee (Receiving Party Locked) *</label>
                    <input type="text" className="form-control form-control-sm text-secondary bg-light" disabled value={`${entry?.lender?.name || "Lender"} (Lender Account)`} />
                  </div>

                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label small fw-bold text-dark m-0">Proof of Payment File Attachments</label>
                      <div className="position-relative">
                        <span className="text-primary small fw-semibold" style={{ cursor: "pointer", fontSize: "12px" }}>
                          {uploadingModalFile ? "Processing Upload..." : "➕ Add Proof Document"}
                        </span>
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          className="position-absolute top-0 start-0 opacity-0 w-100 h-100" 
                          style={{ cursor: "pointer" }}
                          onChange={handleAddModalFile}
                          disabled={uploadingModalFile}
                        />
                      </div>
                    </div>
                    {modalFiles.length > 0 ? (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {modalFiles.map((file, idx) => (
                          <div key={idx} className="d-inline-flex align-items-center bg-light border px-2 py-1 rounded small" style={{ fontSize: "11px" }}>
                            <span className="text-dark truncate max-w-120 me-1.5">📄 {file.name}</span>
                            <span className="text-danger border-start ps-1.5" style={{ cursor: "pointer" }} onClick={() => handleRemoveModalFile(idx)}>×</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted small italic" style={{ fontSize: "11px" }}>No validation receipt documents attached yet.</span>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">Payment Notes</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="Enter wire trace codes or specific payment logs context..."
                      value={paymentNotesInput}
                      onChange={(e) => setPaymentNotesInput(e.target.value)}
                    />
                  </div>

                </div>
                <div className="modal-footer p-2 bg-light">
                  <button type="button" className="btn btn-sm btn-light border" onClick={() => setShowPaymentModal(false)} disabled={processingPayment}>Close</button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={processingPayment || uploadingModalFile}>
                    {processingPayment ? "Processing..." : "Add Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}