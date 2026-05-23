import { supabase } from '@/services/supabase'

export async function getGroupsWithMembers() {
  // 1. Get all groups
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('group_id, group_name')
    .order('group_name', { ascending: true });

  if (groupsError) throw groupsError;

  // 2. Get all memberships joined with contact details
  const { data: memberships, error: membershipsError } = await supabase
    .from('group_memberships')
    .select(`
      group_id,
      member_id,
      contacts (
        contact_id,
        name,
        contact_info
      )
    `);

  if (membershipsError) throw membershipsError;

  // 3. Merge: attach members to their group
  return (groups || []).map((g) => ({
    ...g,
    members: (memberships || [])
      .filter((m) => m.group_id === g.group_id)
      .map((m) => m.contacts)
  }));
<<<<<<< HEAD
}
=======
}
>>>>>>> princess-test
