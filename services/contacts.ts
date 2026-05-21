import { supabase } from '@/lib/supabase'

export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
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

export async function deleteContact(id: number) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) throw error
}