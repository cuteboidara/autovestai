'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { adminRoute } from '@/lib/admin-route'
import { adminApi } from '@/services/api/admin'
import { useAuthStore } from '@/store/auth-store'
import { useNotificationStore } from '@/store/notification-store'

export default function ChangePasswordPage() {
  const router = useRouter()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const pushNotification = useNotificationStore((state) => state.push)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 8) {
      pushNotification({ title: 'Password too short', description: 'New password must be at least 8 characters.', type: 'error' })
      return
    }

    if (newPassword !== confirmPassword) {
      pushNotification({ title: 'Passwords do not match', description: 'New password and confirmation must match.', type: 'error' })
      return
    }

    setSubmitting(true)

    try {
      await adminApi.changeMyPassword({ currentPassword, newPassword })
      await refreshUser()
      pushNotification({ title: 'Password changed', description: 'Your password has been updated successfully.', type: 'success' })
      router.replace(adminRoute())
    } catch (error) {
      pushNotification({
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0E1A] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1F2937] bg-[#111827]">
            <KeyRound className="h-6 w-6 text-[#F5A623]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F9FAFB]">Change Your Password</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Your account requires a password change before you can continue.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="rounded-2xl border border-[#1F2937] bg-[#111827] p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting ? 'Changing password...' : 'Set New Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
