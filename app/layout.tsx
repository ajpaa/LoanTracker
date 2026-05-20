import './globals.css'
import Sidebar from '@/app/components/layout/sidebar'
import 'bootstrap/dist/css/bootstrap.min.css'

export const metadata = {
  title: 'Loan Tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  )
}