'use client';

import { useEffect, useState } from 'react'
import { getGroupsWithMembers } from '@/services/contacts-client'

type Member = {
  contact_id: string
  name: string
  contact_info: string
}

type Group = {
  group_id: string
  group_name: string
  members: Member[]
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getGroupsWithMembers()
      setGroups(data || [])
      setExpandedGroups(new Set(data?.map((g: Group) => g.group_id) || []))
    } catch (err) {
      console.error('Error loading groups:', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="container py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" />
        Loading groups...
      </div>
    )
  }

  return (
    <div className="container py-4">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-0">Groups</h1>
          <p className="text-muted small mb-0">{groups.length} group{groups.length !== 1 ? 's' : ''} total</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={load}>
          ↺ Refresh
        </button>
      </div>

      {/* Empty State */}
      {groups.length === 0 && (
        <div className="card p-5 text-center text-muted">
          <div style={{ fontSize: '2rem' }}>👥</div>
          <p className="mt-2 mb-0">No groups yet. Create a group contact first.</p>
        </div>
      )}

      {/* Group Cards */}
      <div className="d-flex flex-column gap-3">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.group_id)

          return (
            <div key={group.group_id} className="card shadow-sm">

              {/* Group Header — clickable to expand/collapse */}
              <div
                className="card-header d-flex justify-content-between align-items-center"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleGroup(group.group_id)}
              >
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '1.1rem' }}>👥</span>
                  <span className="fw-bold fs-6">{group.group_name}</span>
                  <span className="badge bg-light text-dark border">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-muted">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded Members Table */}
              {isExpanded && (
                <div className="card-body p-0">
                  {group.members.length === 0 ? (
                    <div className="text-center text-muted py-4 small">
                      No members in this group yet.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="ps-3">Name</th>
                            <th>Contact Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.members.map((member) => (
                            <tr key={member.contact_id}>
                              <td className="ps-3 fw-semibold">
                                <span className="me-1">👤</span>
                                {member.name}
                              </td>
                              <td className="text-muted small">{member.contact_info || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}