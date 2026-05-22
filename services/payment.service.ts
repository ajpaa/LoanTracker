import { createClient } from "@/services/supabase/client";

const supabase = createClient();

export async function getMembers() {
  return await supabase
    .from("contacts")
    .select("id, name");
}

export async function getEntries() {
  return await supabase
    .from("entries")
    .select("*");
}

export async function getAllocations() {
  return await supabase
    .from("payment_allocations")
    .select("*");
}

export async function createPaymentEntry(
  payload: any
) {
  return await supabase
    .from("entries")
    .insert(payload)
    .select()
    .single();
}


export async function createPaymentAllocations(
  payload: any[]
) {
  return await supabase
    .from("payment_allocations")
    .insert(payload);
}