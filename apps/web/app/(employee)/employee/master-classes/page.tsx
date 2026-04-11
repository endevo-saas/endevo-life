'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2, BookOpen, Star, Calendar, Users } from 'lucide-react'
import { api } from '@/lib/api'

interface MasterClass {
  classId: string
  title: string
  description: string
  domain: string
  instructor: string
  durationMinutes?: number
  maxAttendees?: number
}

interface Registration {
  registrationId: string
  classId: string
  userId: string
  registeredAt: string
}

export default function MasterClassesPage() {
  const [allClasses, setAllClasses] = useState<MasterClass[]>([])
  const [recommendedClasses, setRecommendedClasses] = useState<MasterClass[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'recommended' | 'all'>('recommended')

  async function loadClasses() {
    try {
      const [allResult, recResult, regResult] = await Promise.all([
        api.employeeGetMasterClasses(),
        api.employeeGetRecommendedClasses(),
        api.employeeGetClassRegistrations(),
      ])

      setAllClasses(allResult.classes || [])
      setRecommendedClasses(recResult.classes || [])
      setRegistrations(regResult.registrations || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load master classes')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(classId: string) {
    setRegistering(classId)
    setError('')
    try {
      const result = await api.employeeRegisterForClass(classId)
      setRegistrations([...(registrations || []), result])
      // Show success message
      setTimeout(() => {
        setRegistering(null)
      }, 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to register for class')
      setRegistering(null)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  const isRegistered = (classId: string) => {
    return registrations?.some(r => r.classId === classId)
  }

  const getDomainColor = (domain: string) => {
    const colors: { [key: string]: string } = {
      legal: 'bg-blue-100 text-blue-800',
      financial: 'bg-green-100 text-green-800',
      physical: 'bg-purple-100 text-purple-800',
      digital: 'bg-orange-100 text-orange-800',
    }
    return colors[domain.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const getDomainBorderColor = (domain: string) => {
    const colors: { [key: string]: string } = {
      legal: 'border-blue-200',
      financial: 'border-green-200',
      physical: 'border-purple-200',
      digital: 'border-orange-200',
    }
    return colors[domain.toLowerCase()] || 'border-gray-200'
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading master classes...</p>
        </div>
      </div>
    )
  }

  const classesToDisplay = activeTab === 'recommended' ? recommendedClasses : allClasses

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Master Classes</h1>
          </div>
          <p className="text-gray-600">Learn from industry experts on legacy planning topics</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Registration Count */}
        {registrations && registrations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <p className="text-green-700">You're registered for {registrations.length} class{registrations.length !== 1 ? 'es' : ''}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'recommended'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Star className="w-4 h-4 inline mr-2" />
            For You ({recommendedClasses.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Classes ({allClasses.length})
          </button>
        </div>

        {/* Classes Grid */}
        {classesToDisplay.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classesToDisplay.map(cls => (
              <div key={cls.classId} className={`border rounded-lg overflow-hidden hover:shadow-lg transition ${getDomainBorderColor(cls.domain)} border-2`}>
                {/* Header */}
                <div className={`p-4 ${getDomainColor(cls.domain)}`}>
                  <h3 className="font-bold text-lg mb-1">{cls.title}</h3>
                  <p className="text-sm opacity-90">{cls.instructor}</p>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">{cls.description}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {cls.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {cls.durationMinutes} min
                      </span>
                    )}
                    {cls.maxAttendees && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {cls.maxAttendees} max
                      </span>
                    )}
                  </div>

                  {/* Domain Badge */}
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getDomainColor(cls.domain)}`}>
                    {cls.domain}
                  </span>
                </div>

                {/* Action */}
                <div className="p-4 border-t border-gray-200">
                  {isRegistered(cls.classId) ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 font-semibold py-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Registered
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRegister(cls.classId)}
                      disabled={registering === cls.classId}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {registering === cls.classId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        'Register'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {activeTab === 'recommended'
                ? 'No recommended classes at this time. Check back soon!'
                : 'No master classes available.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
