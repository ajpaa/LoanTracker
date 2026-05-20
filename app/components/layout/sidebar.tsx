import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r p-6">
      <h1 className="text-xl font-bold mb-8">
        Loan Tracker
      </h1>

      <nav className="flex flex-col gap-4">
        <Link href="/" className="font-semibold">
          Dashboard
        </Link>

        <Link href="/loans">
          Loans
        </Link>

        <Link href="/contacts">
          Contacts
        </Link>
      </nav>
    </aside>
  )
}