'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface ProjectNavProps {
  items: { href: string; label: string; icon: React.ReactNode }[]
}

export function ProjectNav({ items }: ProjectNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 -mb-px">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
              active
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            )}
          >
            {icon}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
