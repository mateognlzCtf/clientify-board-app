import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // Verify auth
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${user.id}/${Date.now()}.${ext}`

  const supabase = createAdminClient()

  // Ensure bucket exists
  await supabase.storage.createBucket('comment-images', { public: true }).catch(() => {})

  const { error } = await supabase.storage
    .from('comment-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('comment-images')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
