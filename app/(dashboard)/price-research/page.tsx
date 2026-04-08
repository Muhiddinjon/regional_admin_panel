import { cookies } from 'next/headers'
import PriceResearchClient from './client'

export default async function Page() {
  const cookieStore = await cookies()
  const role = (cookieStore.get('admin_token')?.value ?? 'rm') as 'rm' | 'ops' | 'pm' | 'checker'
  return <PriceResearchClient role={role} />
}
