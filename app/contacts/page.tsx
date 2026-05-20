'use client'

import { useEffect, useState } from 'react'
import { getContacts } from '@/services/contacts'

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await getContacts()
    setContacts(data || [])
  }

  return (
    <div className="container py-4">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Contacts</h1>

        <button className="btn btn-primary">
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
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.contact_info}</td>
                  <td>{c.type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  )
}