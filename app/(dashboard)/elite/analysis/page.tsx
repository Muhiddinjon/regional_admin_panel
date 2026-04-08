import { cookies } from 'next/headers'
import AnalysisClient from './client'

export default async function AnalysisPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('admin_token')?.value ?? ''
  return <AnalysisClient role={role} />
}
