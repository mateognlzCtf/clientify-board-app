'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

export function NewTicketHeaderButton() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  if (pathname.endsWith('/settings') || pathname.endsWith('/members')) return null

  return (
    <button
      type="button"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('new', '1')
        router.push(`${pathname}?${params.toString()}`)
      }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0"
    >
      <Plus size={13} />
      Create
    </button>
  )
}
