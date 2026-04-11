'use client'

import { useState } from 'react'
import { ShieldCheck, Phone, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { api, User as UserType } from '@/lib/api'

interface PersonalContactSectionProps {
  profile: UserType
  onUpdate: () => void
}

interface ContactState {
  personal_email: string
  personal_phone_number: string
}

interface OtpState {
  channel: 'email' | 'phone' | null
  otp_id: string
  code: string
  sending: boolean
  verifying: boolean
}

interface ValidationErrors {
  personal_email?: string
  personal_phone_number?: string
}

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/

function validate(form: ContactState): ValidationErrors {
  const errors: ValidationErrors = {}
  if (form.personal_email && !EMAIL_PATTERN.test(form.personal_email)) {
    errors.personal_email = 'Enter a valid email address'
  }
  if (form.personal_phone_number && !PHONE_PATTERN.test(form.personal_phone_number)) {
    errors.personal_phone_number = 'Enter a valid phone in E.164 format (e.g. +14155551234)'
  }
  return errors
}

export default function PersonalContactSection({
  profile,
  onUpdate,
}: PersonalContactSectionProps) {
  const [form, setForm] = useState<ContactState>({
    personal_email: profile.personal_email ?? '',
    personal_phone_number: profile.personal_phone_number ?? '',
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  const [otp, setOtp] = useState<OtpState>({
    channel: null,
    otp_id: '',
    code: '',
    sending: false,
    verifying: false,
  })
  const [otpError, setOtpError] = useState('')

  // Show verified badges based on the current saved profile, refreshed after save
  const [emailVerified, setEmailVerified] = useState(
    profile.personal_email_verified ?? false
  )
  const [phoneVerified, setPhoneVerified] = useState(
    profile.personal_phone_verified ?? false
  )

  // -------------------------------------------------------------------------
  // Save personal contact fields
  // -------------------------------------------------------------------------

  async function handleSave() {
    setErrors({})
    setSaveError('')
    setSuccessMsg('')

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const payload: { personal_email?: string; personal_phone_number?: string } = {}
    if (form.personal_email !== (profile.personal_email ?? '')) {
      payload.personal_email = form.personal_email
    }
    if (form.personal_phone_number !== (profile.personal_phone_number ?? '')) {
      payload.personal_phone_number = form.personal_phone_number
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    setSaving(true)
    try {
      await api.employeeUpdatePersonalContact(payload)

      // Reset verified badges when a field changes
      if (payload.personal_email !== undefined) setEmailVerified(false)
      if (payload.personal_phone_number !== undefined) setPhoneVerified(false)

      setSuccessMsg('Personal contact saved')
      setTimeout(() => setSuccessMsg(''), 4000)
      onUpdate()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // OTP send
  // -------------------------------------------------------------------------

  async function handleSendOtp(channel: 'email' | 'phone') {
    setOtpError('')
    setOtp((prev) => ({ ...prev, channel, otp_id: '', code: '', sending: true }))

    try {
      if (channel === 'email') {
        const r = await api.employeeSendPersonalEmailOtp(form.personal_email)
        if (r && r.otp_id) {
          setOtp((prev) => ({ ...prev, otp_id: r.otp_id, sending: false }))
        } else {
          throw new Error('Failed to send OTP')
        }
      } else {
        const r = await api.employeeSendPersonalPhoneOtp(form.personal_phone_number)
        if (r && r.otp_id) {
          setOtp((prev) => ({ ...prev, otp_id: r.otp_id, sending: false }))
        } else {
          throw new Error('Failed to send SMS')
        }
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'Failed to send OTP')
      setOtp((prev) => ({ ...prev, channel: null, sending: false }))
    }
  }

  // -------------------------------------------------------------------------
  // OTP verify
  // -------------------------------------------------------------------------

  async function handleVerifyOtp() {
    setOtpError('')
    setOtp((prev) => ({ ...prev, verifying: true }))

    try {
      if (otp.channel === 'email') {
        const r = await api.employeeVerifyPersonalEmailOtp(otp.otp_id, otp.code)
        if (r?.verified) {
          setEmailVerified(true)
          setOtp({ channel: null, otp_id: '', code: '', sending: false, verifying: false })
          onUpdate()
        } else {
          throw new Error('Verification failed')
        }
      } else {
        const r = await api.employeeVerifyPersonalPhoneOtp(otp.otp_id, otp.code)
        if (r?.verified) {
          setPhoneVerified(true)
          setOtp({ channel: null, otp_id: '', code: '', sending: false, verifying: false })
          onUpdate()
        } else {
          throw new Error('Verification failed')
        }
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'Verification failed')
      setOtp((prev) => ({ ...prev, verifying: false }))
    }
  }

  const hasSavedEmail = Boolean(form.personal_email || profile.personal_email)
  const hasSavedPhone = Boolean(
    form.personal_phone_number || profile.personal_phone_number
  )

  return (
    <section
      data-testid="personal-contact-section"
      className="mt-8 pt-6 border-t border-white/10"
    >
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-purple-400" />
        Personal Contact
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        Optional — used to contact you outside work channels.
      </p>

      {/* Success / error banners */}
      {successMsg && (
        <div
          data-testid="personal-contact-success"
          className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm"
        >
          {successMsg}
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {saveError}
        </div>
      )}

      <div className="space-y-5">
        {/* Personal email */}
        <div>
          <label
            data-testid="personal-email-label"
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            Personal Email
            <span className="ml-1 text-xs text-slate-500">(optional)</span>
          </label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                data-testid="personal-email-input"
                type="email"
                value={form.personal_email}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, personal_email: e.target.value }))
                  setErrors((prev) => ({ ...prev, personal_email: undefined }))
                }}
                placeholder="you@personal.com"
                className="input-field w-full"
              />
              {errors.personal_email && (
                <p
                  data-testid="personal-email-error"
                  className="mt-1 text-xs text-red-400"
                >
                  {errors.personal_email}
                </p>
              )}
            </div>

            {emailVerified ? (
              <span
                data-testid="personal-email-verified-badge"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium whitespace-nowrap"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Verified
              </span>
            ) : hasSavedEmail ? (
              <button
                data-testid="verify-personal-email-btn"
                onClick={() => handleSendOtp('email')}
                disabled={otp.sending && otp.channel === 'email'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all text-xs font-medium whitespace-nowrap disabled:opacity-50"
              >
                {otp.sending && otp.channel === 'email' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Verify
              </button>
            ) : null}
          </div>

          {/* Email OTP input */}
          {otp.channel === 'email' && otp.otp_id && (
            <div className="mt-3 flex gap-2 items-center">
              <input
                data-testid="personal-email-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp.code}
                onChange={(e) =>
                  setOtp((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="6-digit code"
                className="input-field w-36"
              />
              <button
                data-testid="confirm-personal-email-otp-btn"
                onClick={handleVerifyOtp}
                disabled={otp.verifying || otp.code.length !== 6}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {otp.verifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Confirm
              </button>
            </div>
          )}
        </div>

        {/* Personal phone */}
        <div>
          <label
            data-testid="personal-phone-label"
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            Personal Phone
            <span className="ml-1 text-xs text-slate-500">(optional)</span>
          </label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                data-testid="personal-phone-input"
                type="tel"
                value={form.personal_phone_number}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    personal_phone_number: e.target.value,
                  }))
                  setErrors((prev) => ({
                    ...prev,
                    personal_phone_number: undefined,
                  }))
                }}
                placeholder="+14155551234"
                className="input-field w-full"
              />
              {errors.personal_phone_number && (
                <p
                  data-testid="personal-phone-error"
                  className="mt-1 text-xs text-red-400"
                >
                  {errors.personal_phone_number}
                </p>
              )}
            </div>

            {phoneVerified ? (
              <span
                data-testid="personal-phone-verified-badge"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium whitespace-nowrap"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Verified
              </span>
            ) : hasSavedPhone ? (
              <button
                data-testid="verify-personal-phone-btn"
                onClick={() => handleSendOtp('phone')}
                disabled={otp.sending && otp.channel === 'phone'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all text-xs font-medium whitespace-nowrap disabled:opacity-50"
              >
                {otp.sending && otp.channel === 'phone' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
                Verify
              </button>
            ) : null}
          </div>

          {/* Phone OTP input */}
          {otp.channel === 'phone' && otp.otp_id && (
            <div className="mt-3 flex gap-2 items-center">
              <input
                data-testid="personal-phone-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp.code}
                onChange={(e) =>
                  setOtp((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="6-digit code"
                className="input-field w-36"
              />
              <button
                data-testid="confirm-personal-phone-otp-btn"
                onClick={handleVerifyOtp}
                disabled={otp.verifying || otp.code.length !== 6}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {otp.verifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>

      {/* OTP send/verify error */}
      {otpError && (
        <p className="mt-3 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {otpError}
        </p>
      )}

      {/* Save button */}
      <div className="mt-5">
        <button
          data-testid="save-personal-contact-btn"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Personal Contact'}
        </button>
      </div>
    </section>
  )
}
