import { useVerseStore } from '../stores/verseStore'

export default function VoiceStatus() {
  const { isListening, whisperStatus, lastHeard } = useVerseStore()

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isListening ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
          }`}
        />
        <span className="text-xs text-zinc-400">{whisperStatus}</span>
      </div>
      {lastHeard && (
        <div className="bg-zinc-800 rounded-lg px-3 py-2">
          <p className="text-xs text-zinc-500 mb-0.5">Last heard:</p>
          <p className="text-sm text-zinc-300">&ldquo;{lastHeard}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
