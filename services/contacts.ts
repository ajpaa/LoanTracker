'use server';
import { supabase } from '@/services/supabase'

// Get all contacts from contacts_totals (which has the calculated totals)
export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts_totals')
    .select('id, name, contact_info, total_lent, total_borrowed, net_balance, type, member_of_group')
    .order('name', { ascending: true })

  if (error) {
    console.error("Error inside getContacts database service:", error.message)
    throw error
  }
  return data
}

// Get available groups for dropdown
export async function getAvailableGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('group_id, group_name')
    .order('group_name', { ascending: true });

  if (error) throw error
  return data || [];
}

// Create a new contact
export async function createContact(contact: any) {
  const { data, error } = await supabase
    .from('contacts')
    .insert(contact)
    .select() 
    .single(); 

  if (error) throw error
  return data
}

// Create group membership
export async function createGroupMembership(groupId: string, memberId: string) {
  const { data, error } = await supabase
    .from('group_memberships')
    .insert([{ group_id: groupId, member_id: memberId }])
    .select();
    
  if (error) throw error
  return data
}

// Delete contact
export async function deleteContact(id: string) {
  // First delete group memberships if any
  const { error: membershipError } = await supabase
    .from('group_memberships')
    .delete()
    .or(`group_id.eq.${id},member_id.eq.${id}`);

  if (membershipError) console.error('Error deleting memberships:', membershipError);

  // Then delete the contact
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('contact_id', id)

  if (error) throw error
}
