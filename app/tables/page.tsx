import Link from 'next/link'

export default function TablesPage() {
  const tables = [1, 2, 3]
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card p-6 rounded-lg shadow">
        <h1 className="text-xl font-semibold mb-4">Links cố định cho các bàn</h1>
        <ul className="space-y-2">
          {tables.map((n) => (
            <li key={n}>
              <Link href={`/table/${n}`} className="text-primary underline">
                Mở bàn {n}: /table/{n}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
