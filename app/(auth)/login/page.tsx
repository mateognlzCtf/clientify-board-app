import { LoginClient } from './LoginClient'

interface Props {
  searchParams: Promise<{ inviteToken?: string; email?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { inviteToken, email } = await searchParams
  return <LoginClient inviteToken={inviteToken} defaultEmail={email} />
}
