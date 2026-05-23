'use client';

import { useEffect, useState } from 'react'
import { getContacts, createContact, deleteContact, createGroupMembership, getAvailableGroups, updateContact } from '@/services/contacts'
import Link from 'next/link'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [name, setName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [isGroupMember, setIsGroupMember] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [editName, setEditName] = useState('')
  const [editContactInfo, setEditContactInfo] = useState('')

  useEffect(() => {
    load()
    loadGroups()
  }, [])

  async function load() {
    const data = await getContacts()
    setContacts(data || [])
  }

  async function loadGroups() {
    const groups = await getAvailableGroups()
    setAvailableGroups(groups || [])
  }

  function handleEditClick(contact: any) {
    setEditingContact(contact);
    setEditName(contact.name);
    setEditContactInfo(contact.contact_info);
  }

  async function handleAddContactSubmit(e: any) {
    e.preventDefault()
    setSubmitting(true)

    const newContact = {
      name,
      contact_info: contactInfo,
      type: isGroupMember ? 'group' : 'independent'
    }

    try {
      const createdContact = await createContact(newContact)
      const createdId = createdContact?.contact_id || createdContact?.id

      if (isGroupMember && selectedGroupId && createdId) {
        await createGroupMembership(selectedGroupId, createdId)
      }

      setName('')
      setContactInfo('')
      setSelectedGroupId('')
      setIsGroupMember(false)
      setIsModalOpen(false)
      await load()
    } catch (err) {
      console.error("Error creating contact:", err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditContactSubmit(e: any) {
    e.preventDefault()
    if (!editingContact) return;
    setSubmitting(true)

    const updatedData = {
      name: editName,
      contactInfo: editContactInfo, // mapped to contact_info in service
    }

    try {
      const idToUpdate = editingContact.id || editingContact.contact_id;
      await updateContact(idToUpdate, updatedData)
      setEditingContact(null)
      await load()
    } catch (err) {
      console.error("Error updating contact:", err)
      alert("Failed to update contact profile.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-4">

      

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Contacts</h1>
        <div className="d-flex gap-2">
          <Link href="/groups" className="btn btn-outline-secondary">
            👥 Groups
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-3">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Info</th>
              <th>Total Lent</th>
              <th>Total Borrowed</th>
              <th>Net Balance</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No contacts yet
                </td>
              </tr>
            ) : (
              contacts.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.contact_info}</td>
                  <td>{c.total_lent}</td>
                  <td>{c.total_borrowed}</td>
                  <td>{c.net_balance}</td>
                  <td>
                    {c.member_of_group ? (
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(c.member_of_group)}
                        className="btn btn-sm btn-light text-primary fw-semibold"
                      >
                        Person ({c.member_of_group}) 👤
                      </button>
                    ) : (
                      <span className="badge bg-secondary">{c.type === 'group' ? 'Group Member' : 'Independent'}</span>
                    )}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(c)}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmDelete = confirm('Are you sure you want to delete ${c.name}?');
                          if (!confirmDelete) return;
                          try {
                            await deleteContact(c.id);
                            await load();
                          } catch (err) {
                            console.error("Failed to delete record:", err);
                            alert("An error occurred while deleting the contact.");
                          }
                        }}
                        className="btn btn-sm btn-outline-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD CONTACT MODAL */}
      {isModalOpen && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content text-dark">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Add New Contact</h5>
                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
              </div>
              <form onSubmit={handleAddContactSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Juan dela Cruz"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Contact Info</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., 09171234567"
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Type</label>
                    <select
                      className="form-select"
                      value={isGroupMember ? "member" : "independent"}
                      onChange={(e) => setIsGroupMember(e.target.value === "member")}
                      disabled={submitting}
                    >
                      <option value="independent">Independent</option>
                      <option value="member">Group Member</option>
                    </select>
                  </div>
                  {isGroupMember && (
                    <div className="mb-3 bg-light p-2 rounded border">
                      <label className="form-label small fw-semibold text-primary">Assign to Group Cluster</label>
                      <select
                        className="form-select border-primary"
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        required
                        disabled={submitting}
                      >
                        <option value="">-- Select an Existing Group --</option>
                        {availableGroups.map((g) => (
                          <option key={g.group_id} value={g.group_id}>
                            {g.group_name}
                          </option>
                        ))}
                      </select>
                      {availableGroups.length === 0 && (
                        <div className="text-danger small mt-1">
                          ⚠️ You must create a Group contact first before adding members to it.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save Contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONTACT MODAL */}
      {editingContact && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content text-dark">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">Edit Contact Details</h5>
                <button type="button" className="btn-close" onClick={() => setEditingContact(null)}></button>
              </div>
              <form onSubmit={handleEditContactSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Contact Info</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editContactInfo}
                      onChange={(e) => setEditContactInfo(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingContact(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    {submitting ? "Updating..." : "Update Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* GROUP INFO MODAL */}
      {selectedGroup && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
            <div className="modal-content text-dark">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">Group Info</h5>
                <button type="button" className="btn-close" onClick={() => setSelectedGroup(null)}></button>
              </div>
              <div className="modal-body text-center py-4">
                <p className="mb-1 text-muted small fw-bold">Assigned Cluster</p>
                <h4 className="text-primary fw-bold mb-3">👥 {selectedGroup}</h4>
                <p className="text-muted small mb-0">
                  This contact is managed under the organizational tracking profile of {selectedGroup}.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-primary w-100" onClick={() => setSelectedGroup(null)}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}