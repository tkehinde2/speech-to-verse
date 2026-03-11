import { useVerseStore } from '../stores/verseStore'

export default function MonitorPicker() {
  const { monitors, selectedMonitor, selectMonitor } = useVerseStore()

  if (monitors.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-zinc-400">Output:</label>
      <select
        value={selectedMonitor}
        onChange={(e) => selectMonitor(parseInt(e.target.value, 10))}
        className="bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {monitors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.width}x{m.height})
          </option>
        ))}
      </select>
    </div>
  )
}
