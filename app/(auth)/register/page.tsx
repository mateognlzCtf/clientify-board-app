import { RegisterClient } from './RegisterClient'

interface Props {
  searchParams: Promise<{ inviteToken?: string; email?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { inviteToken, email } = await searchParams
  return <RegisterClient inviteToken={inviteToken} defaultEmail={email} />
}
