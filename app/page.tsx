'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Loan = {
  id: number
  name: string
  amount: number
}

export default function HomePage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  async function fetchLoans() {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.log(error)
    } else {
      setLoans(data)
    }
  }

  async function addLoan() {
    if (!name || !amount) return

    const { error } = await supabase
      .from('loans')
      .insert({
        name,
        amount: Number(amount),
      })

    if (!error) {
      setName('')
      setAmount('')
      fetchLoans()
    }
  }

  async function deleteLoan(id: number) {
    await supabase
      .from('loans')
      .delete()
      .eq('id', id)

    fetchLoans()
  }

  useEffect(() => {
    fetchLoans()
  }, [])

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-6">
        Supabase CRUD Test
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          className="border p-2"
          placeholder="Loan name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="border p-2"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={addLoan}
          className="bg-blue-500 text-white px-4"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {loans.map((loan) => (
          <div
            key={loan.id}
            className="border p-4 flex justify-between"
          >
            <div>
              <p>{loan.name}</p>
              <p>${loan.amount}</p>
            </div>

            <button
              onClick={() => deleteLoan(loan.id)}
              className="bg-red-500 text-white px-3"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}