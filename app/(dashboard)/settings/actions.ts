'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ServiceResult } from '@/types/common.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function updateProfileAction(data: {
  full_name: string
}): Promise<ServiceResult<null>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: data.full_name.trim() || null })
    .eq('id', user.id)

  if (error) return { data: null, error: 'Error updating profile.' }

  revalidatePath('/settings')
  revalidatePath('/dashboard')

  return { data: null, error: null }
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<ServiceResult<{ avatar_url: string }>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  const file = formData.get('file') as File | null
  if (!file) return { data: null, error: 'No file provided.' }

  // Ensure bucket exists
  await supabase.storage.createBucket('avatars', { public: true }).catch(() => {})

  // Remove old avatar if exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.avatar_url) {
    const MARKER = '/object/public/avatars/'
    const idx = profile.avatar_url.indexOf(MARKER)
    if (idx !== -1) {
      const oldPath = profile.avatar_url.slice(idx + MARKER.length)
      await supabase.storage.from('avatars').remove([oldPath])
    }
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true })

  if (uploadError) return { data: null, error: 'Error uploading image.' }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url })
    .eq('id', user.id)

  if (updateError) return { data: null, error: 'Error saving avatar.' }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')

  return { data: { avatar_url }, error: null }
}

export async function removeAvatarAction(): Promise<ServiceResult<null>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.avatar_url) {
    const MARKER = '/object/public/avatars/'
    const idx = profile.avatar_url.indexOf(MARKER)
    if (idx !== -1) {
      const path = profile.avatar_url.slice(idx + MARKER.length).split('?')[0]
      await supabase.storage.from('avatars').remove([path])
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (error) return { data: null, error: 'Error removing avatar.' }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')

  return { data: null, error: null }
}
