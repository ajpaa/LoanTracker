'use server';
import { supabase } from '@/lib/supabase'

export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts_totals')
    .select('id, name, contact_info, total_lent, total_borrowed, net_balance, type')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function createContact(contact: any) {
  const { data, error } = await supabase
    .from('contacts')
    .insert(contact)

  if (error) throw error
  return data
}

export async function createGroup(group: any) {
  const { data, error } = await supabase
    .from('group_members')
    .insert(group)
    
  if (error) throw error
  return data
}

export async function deleteContact(id: number) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('contact_id', id)

  if (error) throw error
}
