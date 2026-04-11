import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/services/projects.service'
import { ProjectsClient } from './ProjectsClient'
import { ProjectCardSkeleton } from '@/components/ui/Skeleton'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: projects, error } = await getProjects(supabase)

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {error}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">For you</h1>
        <p className="text-sm text-gray-500 mt-1">Recommended spaces</p>
      </div>

      <ProjectsClient
        projects={projects ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
