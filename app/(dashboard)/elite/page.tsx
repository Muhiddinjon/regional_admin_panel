import { cookies } from 'next/headers'
import EliteClient from './client'

export default async function ElitePage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('admin_token')?.value ?? 'rm'
  return <EliteClient role={role} />
}
