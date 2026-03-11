import { useState, useEffect, useCallback } from 'react'
import { useVerseStore } from '../stores/verseStore'
import { getAudioInputDevices, type AudioDevice } from '../lib/audio-capture'

export default function MicPicker() {
  const { selectedMicId, setSelectedMicId, isListening } = useVerseStore()
  const [devices, setDevices] = useState<AudioDevice[]>([])

  const refresh = useCallback(async () => {
    const devs = await getAudioInputDevices()
    setDevices(devs)
    if (!selectedMicId && devs.length > 0) {
      setSelectedMicId(devs[0].deviceId)
    }
  }, [selectedMicId, setSelectedMicId])

  useEffect(() => {
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [refresh])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">Microphone</label>
        <button
          onClick={refresh}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>
      <select
        value={selectedMicId}
        onChange={(e) => setSelectedMicId(e.target.value)}
        disabled={isListening}
        className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
      >
        {devices.length === 0 ? (
          <option value="">No microphones found</option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))
        )}
      </select>
    </div>
  )
}
