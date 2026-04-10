import type { MemberRole } from '@/types/member.types'

export const MEMBER_ROLES: Record<
  MemberRole,
  { label: string; description: string }
> = {
  owner: {
    label: 'Propietario',
    description: 'Control total del proyecto. No puede ser removido.',
  },
  admin: {
    label: 'Admin',
    description: 'Puede gestionar miembros e issues.',
  },
  member: {
    label: 'Miembro',
    description: 'Puede crear y editar issues.',
  },
}
