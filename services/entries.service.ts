// services/entries.service.ts
import { supabase } from "./supabase"

// Fetch all loans for the main table list
export async function getAllLoans() {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .order("date", { ascending: false })

  if (error) {
    console.error("Error fetching loans:", error.message)
    return []
  }
  return data
}

// Fetch a single loan matching the ref_id, plus its group allocations if they exist
export async function getLoanByRefId(refId: string) {
  // Fetch loan details
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("ref_id", refId)
    .single()

  if (loanError) {
    console.error("Error fetching loan details:", loanError.message)
    return null
  }

  // If it's a group expense, fetch individual breakdown records from allocations table
  let allocations = []
  if (loan.transaction_type === "group_expense") {
    const { data: allocData, error: allocError } = await supabase
      .from("allocations")
      .select("*")
      .eq("loan_id", loan.id) // matching foreign key relation

    if (!allocError) {
      allocations = allocData
    }
  }

  return { loan, allocations }
}