'use client'

import React, { useEffect, useState } from 'react' // Added React here
import { getContacts } from '@/services/contacts'
import { supabase } from '@/services/supabase' 

export default function ContactsPage() {
  // 1. Added <any[]> here so it accepts database data arrays cleanly
  const [contacts, setContacts] = useState<any[]>([]) 
  
  // Modal & Form State Management
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [type, setType] = useState("person") 
  const [submitting, setSubmitting] = useState(false)
  
  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await getContacts()
    setContacts(data || [])
  }

  // Handle Contact Insertion Form submission
  async function handleAddContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !contactInfo.trim()) return

    try {
      setSubmitting(true)

      // Insert new contact row using the exact structural fields shown in your ledger table rows
      const { error } = await supabase
        .from('Contact')
        .insert([
          {
            name: name.trim(),
            contact_info: contactInfo.trim(),
            type: type
          }
        ])

      if (error) throw error

      // Clean form state variables and dismiss the dialog frame
      setName("")
      setContactInfo("")
      setType("person")
      setIsModalOpen(false)

      // Refresh the table with the newly created row instantly
      await load()
    } catch (err) {
      console.error("Failed to insert contact registry item:", err)
      alert("Error adding contact. Check database table schema bindings.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-4">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Contacts</h1>

        {/* Clicking this now flips open the local bootstrap popup modal view */}
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add Contact
        </button>
      </div>

      {/* Table */}
      <div className="card p-3">

        <table className="table table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Info</th>
              <th>Type</th>
            </tr>
          </thead>

          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">
                  No contacts yet
                </td>
              </tr>
            ) : (
              contacts.map((c: any) => (
                <tr key={c.contact_id || c.id}>
                  <td>{c.name}</td>
                  <td>{c.contact_info}</td>
                  <td className="text-capitalize">{c.type || 'person'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>

      {/* INLINE BOOTSTRAP MODAL DIALOG POPUP LAYER */}
      {isModalOpen && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content">
              
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Add New Contact</h5>
                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
              </div>

              <form onSubmit={handleAddContactSubmit}>
                <div className="modal-body">
                  
                  {/* Field Module 1: Name */}
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

                  {/* Field Module 2: Contact Info */}
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

                  {/* Field Module 3: Type Selector */}
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Type</label>
                    <select 
                      className="form-select"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="person">Person</option>
                      <option value="organization">Organization</option>
                    </select>
                  </div>

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
    </div>
  )
}