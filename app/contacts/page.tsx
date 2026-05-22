'use client'

import { useEffect, useState } from 'react'
import { getContacts, createContact, deleteContact } from '@/services/contacts'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [showContactForm, setShowContactForm] = useState(false)

  const [name, setName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [type, setType] = useState('person')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await getContacts()
    setContacts(data || [])
  }

  async function addContact(e: any) {
    e.preventDefault()

    const newContact = {
      name,
      contact_info: contactInfo,
      type
    }

    await createContact(newContact)

    setName('')
    setContactInfo('')
    setType('person')

    setShowContactForm(false)

    load()
  }

  async function handleDelete(id: any, name: string) {
    const confirmDelete = confirm(`Are you sure you want to delete ${name}?`)
    if (!confirmDelete) return

    try {
      await deleteContact(id)
      load()
    } catch (err) {
      console.error('Failed to delete record:', err)
      alert('An error occurred while deleting the contact.')
    }
  }

  return (
    <div className="container py-4">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Contacts</h1>

        <button
          className="btn btn-primary"
          onClick={() => setShowContactForm(true)}
        >
          + Add Contact
        </button>
      </div>

      {/* FORM */}
      {showContactForm && (
        <form onSubmit={addContact} className="card p-3 mb-4">

          <div className="mb-3">
            <label>Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label>Contact Info</label>
            <input
              type="text"
              className="form-control"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label>Type</label>
            <select
              className="form-control"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="person">Person</option>
              <option value="organization">Organization</option>
            </select>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-success">
              Save Contact
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowContactForm(false)}
            >
              Cancel
            </button>
          </div>

        </form>
      )}

      {/* TABLE */}
      <div className="card p-3">

        <table className="table table-hover">
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
                <tr key={c.contact_id || c.id}>
                  <td>{c.name}</td>
                  <td>{c.contact_info}</td>
                  <td>{c.total_lent}</td>
                  <td>{c.total_borrowed}</td>
                  <td>{c.net_balance}</td>
                  <td>{c.type}</td>
                  <td>
                    <button
                      className="text-danger border-0 bg-transparent"
                      onClick={() => handleDelete(c.id, c.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  )
}