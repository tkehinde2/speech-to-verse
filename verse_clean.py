import sys
import re
import time
import queue
from dataclasses import dataclass

import numpy as np
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import sounddevice as sd
from screeninfo import get_monitors

from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont, QKeySequence, QShortcut
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QComboBox, QMessageBox, QCheckBox, QSpinBox
)

from typing import Optional
import faulthandler
faulthandler.enable()


# =======================
# Audio config
# =======================
SAMPLE_RATE = 16000
BLOCK_MS = 30
BLOCK_SAMPLES = int(SAMPLE_RATE * BLOCK_MS / 1000)

DEFAULT_MODEL_SIZE = "tiny"  # start with tiny; you can switch to base/small later

# Silence/utterance detection using RMS energy
DEFAULT_SILENCE_MS_END = 900     # end utterance after this much silence
DEFAULT_MIN_UTT_MS = 600         # ignore too short
DEFAULT_MAX_UTT_MS = 9000        # safety cutoff
DEFAULT_SILENCE_RMS = 0.012      # tune per mic/room (lower = more sensitive)

# =======================
# Normalizer
# =======================
BOOK_ALIASES = {
    "john": "John",
    "psalm": "Psalms",
    "psalms": "Psalms",
    "proverbs": "Proverbs",

    # Solomon variants
    "solomon": "Song of Solomon",
    "song of solomon": "Song of Solomon",
    "song of songs": "Song of Solomon",
    "canticles": "Song of Solomon",

    # Add more aliases as you like...
}

BOOK_PREFIXES = {
    "first": "1", "1st": "1", "one": "1",
    "second": "2", "2nd": "2", "two": "2",
    "third": "3", "3rd": "3", "three": "3",
}

NUM_WORDS = {
    "zero": 0, "oh": 0,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "hundred": 100,
}

RANGE_WORDS = {"to", "through", "thru", "dash", "minus"}


def _words_to_number(tokens):
    if not tokens:
        raise ValueError("Missing number")
    if tokens[0].isdigit():
        return int(tokens[0]), 1

    current = 0
    used = 0
    for t in tokens:
        if t.isdigit():
            break
        if t not in NUM_WORDS:
            break
        used += 1
        val = NUM_WORDS[t]
        if val == 100:
            current = max(1, current) * 100
        elif val >= 20:
            current += val
        else:
            current += val
    if used == 0:
        raise ValueError("No number words")
    return current, used


def _normalize_book(book_tokens):
    key = " ".join(book_tokens).lower().strip()
    key = re.sub(r"\s+", " ", key)
    mapped = BOOK_ALIASES.get(key)
    if mapped:
        return mapped
    return " ".join(t.capitalize() for t in book_tokens)


def normalize_reference(spoken: str) -> str:
    s = spoken.lower()
    s = re.sub(r"[^\w\s:-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("chapter", " chapter ").replace("verse", " verse ")
    s = re.sub(r"\s+", " ", s).strip()

    tokens = s.split()
    if not tokens:
        raise ValueError("Empty speech")

    prefix = None
    if tokens[0] in BOOK_PREFIXES:
        prefix = BOOK_PREFIXES[tokens[0]]
        tokens = tokens[1:]
        if not tokens:
            raise ValueError("Missing book after prefix")

    book_tokens = []
    i = 0
    while i < len(tokens):
        if tokens[i].isdigit() or tokens[i] in NUM_WORDS or tokens[i] in {"chapter", "verse"}:
            break
        book_tokens.append(tokens[i])
        i += 1

    if not book_tokens:
        raise ValueError("Could not find book name")

    book = _normalize_book(book_tokens)
    if prefix:
        book = f"{prefix} {book}"

    if i < len(tokens) and tokens[i] == "chapter":
        i += 1

    chapter, used = _words_to_number(tokens[i:])
    i += used

    if i < len(tokens) and tokens[i] == "verse":
        i += 1

    verse_start, used = _words_to_number(tokens[i:])
    i += used

    verse_end = None
    if i < len(tokens) and tokens[i] in RANGE_WORDS:
        i += 1
        if i < len(tokens) and tokens[i] == "verse":
            i += 1
        verse_end, used = _words_to_number(tokens[i:])
        i += used

    if verse_end is not None:
        return f"{book} {chapter}:{verse_start}-{verse_end}"
    return f"{book} {chapter}:{verse_start}"


# =======================
# Bible API fetch
# =======================
def make_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({"User-Agent": "VersePresenter/1.0"})
    return s


SESSION = make_session()


def fetch_passage_text(reference: str, include_verse_numbers: bool = True) -> tuple[str, str]:
    ref = reference.strip()
    if not ref:
        raise ValueError("Enter a reference (e.g., John 3:16-18).")

    url = f"https://bible-api.com/{ref.replace(' ', '%20')}"
    r = SESSION.get(url, timeout=(5, 25))
    if r.status_code != 200:
        raise ValueError(f"Bible API returned {r.status_code} for {ref}")

    data = r.json()
    display_ref = data.get("reference", ref)
    verses = data.get("verses", [])

    if verses:
        multi = len(verses) > 1
        lines = []
        for v in verses:
            vnum = v.get("verse")
            vtext = (v.get("text") or "").strip()
            if include_verse_numbers and multi and vnum is not None:
                lines.append(f"{vnum} {vtext}")
            else:
                lines.append(vtext)
        passage_text = "\n".join(lines).strip()
    else:
        passage_text = (data.get("text") or "").strip()

    passage_text = re.sub(r"[ \t]+\n", "\n", passage_text)
    passage_text = re.sub(r"\n{3,}", "\n\n", passage_text)

    if not passage_text:
        raise ValueError("No passage text found.")
    return display_ref, passage_text


# =======================
# Full-screen display window
# =======================
class VerseDisplay(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Verse Display")
        self.setStyleSheet("background-color: black; color: white;")

        self.passage_label = QLabel("")
        self.passage_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.passage_label.setWordWrap(True)

        self.ref_label = QLabel("")
        self.ref_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        passage_font = QFont("Arial", 44)
        passage_font.setBold(True)
        self.passage_label.setFont(passage_font)

        ref_font = QFont("Arial", 24)
        self.ref_label.setFont(ref_font)

        layout = QVBoxLayout()
        layout.addStretch(1)
        layout.addWidget(self.passage_label, stretch=8)
        layout.addWidget(self.ref_label, stretch=1)
        layout.addStretch(1)
        self.setLayout(layout)

        QShortcut(QKeySequence("Escape"), self, activated=self.showNormal)
        QShortcut(QKeySequence("Ctrl+W"), self, activated=self.close)

    def set_content(self, passage_text: str, reference: str):
        self.passage_label.setText(passage_text)
        self.ref_label.setText(reference)

    def show_on_monitor_fullscreen(self, monitor_index: int):
        monitors = get_monitors()
        if monitors:
            monitor_index = max(0, min(monitor_index, len(monitors) - 1))
            m = monitors[monitor_index]
            self.setGeometry(m.x, m.y, m.width, m.height)
        self.showFullScreen()
        self.raise_()
        self.activateWindow()


# =======================
# Mic thread (no webrtcvad)
# =======================
@dataclass
class VoiceParams:
    device_index: Optional[int]
    model_size: str
    silence_rms: float
    end_silence_ms: int
    min_utt_ms: int
    max_utt_ms: int


class MicListenerThread(QThread):
    got_text = pyqtSignal(str)
    got_error = pyqtSignal(str)
    status = pyqtSignal(str)

    def __init__(self, params: VoiceParams):
        super().__init__()
        self.params = params
        self._stop = False
        self._q: "queue.Queue[np.ndarray]" = queue.Queue()

    def stop(self):
        self._stop = True

    def _callback(self, indata, frames, time_info, status):
        if not self._stop:
            self._q.put(indata.copy())

    @staticmethod
    def _rms(x: np.ndarray) -> float:
        return float(np.sqrt(np.mean(np.square(x))) + 1e-12)

    def run(self):
        try:
            # Delay import so GUI always opens first
            from faster_whisper import WhisperModel

            self.status.emit(f"Loading Whisper model: {self.params.model_size} (offline)...")
            model = WhisperModel(self.params.model_size, device="cpu", compute_type="int8")
            self.status.emit("Mic listening... speak a reference and pause.")

            stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="float32",
                blocksize=BLOCK_SAMPLES,
                callback=self._callback,
                device=self.params.device_index
            )
            stream.start()

            buf = []
            in_speech = False
            silence_ms = 0
            utt_ms = 0

            while not self._stop:
                try:
                    block = self._q.get(timeout=0.1)
                except queue.Empty:
                    continue

                x = block[:, 0]
                level = self._rms(x)

                if level >= self.params.silence_rms:
                    if not in_speech:
                        in_speech = True
                        silence_ms = 0
                        utt_ms = 0
                        buf.clear()
                    buf.append(x)
                    utt_ms += BLOCK_MS
                    silence_ms = 0
                else:
                    if in_speech:
                        buf.append(x)  # small tail
                        utt_ms += BLOCK_MS
                        silence_ms += BLOCK_MS

                if in_speech and utt_ms >= self.params.max_utt_ms:
                    silence_ms = self.params.end_silence_ms

                if in_speech and silence_ms >= self.params.end_silence_ms:
                    in_speech = False

                    if utt_ms < self.params.min_utt_ms:
                        buf.clear()
                        continue

                    audio = np.concatenate(buf, axis=0).astype(np.float32)
                    buf.clear()

                    segments, _ = model.transcribe(
                        audio,
                        language="en",
                        vad_filter=True,
                        beam_size=3,
                        initial_prompt="The speaker is reading Bible references (book chapter verse), e.g., John 3:16, 2nd John 1:3, Psalm 23:1."
                    )
                    text = " ".join(s.text.strip() for s in segments).strip()
                    if text:
                        self.got_text.emit(text)

            stream.stop()
            stream.close()
            self.status.emit("Mic stopped.")

        except Exception as e:
            self.got_error.emit(str(e))


# =======================
# Control Window
# =======================
class ControlWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Verse Presenter (API + Offline Voice)")
        self.display = VerseDisplay()
        self.mic_thread = None  # type: Optional[MicListenerThread]


        # Monitor picker
        self.monitor_picker = QComboBox()
        monitors = get_monitors()
        if monitors:
            for i, m in enumerate(monitors):
                self.monitor_picker.addItem(f"Screen {i+1}: {m.width}x{m.height} @ ({m.x},{m.y})")
        else:
            self.monitor_picker.addItem("Default Screen")

        # Reference input
        self.input_ref = QLineEdit()
        self.input_ref.setPlaceholderText("Enter reference, e.g. John 3:16-18")

        self.chk_verse_numbers = QCheckBox("Show verse numbers (for ranges)")
        self.chk_verse_numbers.setChecked(True)

        self.chk_auto_show = QCheckBox("Auto-show after voice (if parsed)")
        self.chk_auto_show.setChecked(False)

        # Mic selection
        self.mic_picker = QComboBox()
        self.btn_refresh_mics = QPushButton("Refresh Mics")
        self.btn_refresh_mics.clicked.connect(self.refresh_mics)

        self.model_picker = QComboBox()
        for m in ["tiny", "base", "small", "medium"]:
            self.model_picker.addItem(m)
        self.model_picker.setCurrentText(DEFAULT_MODEL_SIZE)

        # Sensitivity tuning
        self.silence_spin = QSpinBox()
        self.silence_spin.setRange(2, 30)  # tenths of a second
        self.silence_spin.setValue(int(DEFAULT_SILENCE_MS_END / 100))
        self.silence_spin.setSuffix("  (end pause: tenths sec)")

        self.rms_spin = QSpinBox()
        self.rms_spin.setRange(1, 200)  # map to 0.001..0.200
        self.rms_spin.setValue(int(DEFAULT_SILENCE_RMS * 1000))
        self.rms_spin.setSuffix("  (silence threshold x0.001)")

        self.btn_mic_toggle = QPushButton("🎤 Start Mic (Offline)")
        self.btn_mic_toggle.clicked.connect(self.toggle_mic)

        self.status_label = QLabel("Ready.")
        self.status_label.setStyleSheet("color: gray;")

        # Display buttons
        self.btn_show = QPushButton("Show Full Screen")
        self.btn_update = QPushButton("Update Text")
        self.btn_hide = QPushButton("Hide")

        self.btn_show.clicked.connect(self.show_fullscreen)
        self.btn_update.clicked.connect(self.update_only)
        self.btn_hide.clicked.connect(self.hide_display)

        # Layout
        top = QHBoxLayout()
        top.addWidget(QLabel("Target screen:"))
        top.addWidget(self.monitor_picker)

        ref_row = QHBoxLayout()
        ref_row.addWidget(self.input_ref)

        api_row = QHBoxLayout()
        api_row.addWidget(self.chk_verse_numbers)
        api_row.addWidget(self.chk_auto_show)

        mic_row1 = QHBoxLayout()
        mic_row1.addWidget(QLabel("Mic:"))
        mic_row1.addWidget(self.mic_picker, stretch=1)
        mic_row1.addWidget(self.btn_refresh_mics)

        mic_row2 = QHBoxLayout()
        mic_row2.addWidget(QLabel("Whisper model:"))
        mic_row2.addWidget(self.model_picker)
        mic_row2.addSpacing(10)
        mic_row2.addWidget(self.silence_spin)
        mic_row2.addWidget(self.rms_spin)
        mic_row2.addWidget(self.btn_mic_toggle)

        bottom = QHBoxLayout()
        bottom.addWidget(self.btn_show)
        bottom.addWidget(self.btn_update)
        bottom.addWidget(self.btn_hide)

        layout = QVBoxLayout()
        layout.addLayout(top)
        layout.addLayout(ref_row)
        layout.addLayout(api_row)
        layout.addLayout(mic_row1)
        layout.addLayout(mic_row2)
        layout.addWidget(self.status_label)
        layout.addLayout(bottom)
        self.setLayout(layout)

        self.input_ref.returnPressed.connect(self.show_fullscreen)

        self.refresh_mics()
        self.resize(1020, 260)
        self.move(100, 100)
        self.raise_()
        self.activateWindow()

    def refresh_mics(self):
        self.mic_picker.clear()
        try:
            devices = sd.query_devices()
            default_in = sd.default.device[0] if isinstance(sd.default.device, (list, tuple)) else None

            for idx, d in enumerate(devices):
                if d.get("max_input_channels", 0) > 0:
                    name = d.get("name", f"Device {idx}")
                    marker = " (default)" if default_in == idx else ""
                    self.mic_picker.addItem(f"[{idx}] {name}{marker}", userData=idx)

            if self.mic_picker.count() == 0:
                self.mic_picker.addItem("No input devices found", userData=None)

            self.status_label.setText("Mic list updated.")
        except Exception as e:
            self.status_label.setText(f"Mic refresh error: {e}")

    def selected_mic_index(self):
        return self.mic_picker.currentData()

    def toggle_mic(self):
        if self.mic_thread and self.mic_thread.isRunning():
            self.mic_thread.stop()
            self.mic_thread = None
            self.btn_mic_toggle.setText("🎤 Start Mic (Offline)")
            self.status_label.setText("Stopping mic...")
            return

        params = VoiceParams(
            device_index=self.selected_mic_index(),
            model_size=self.model_picker.currentText(),
            silence_rms=max(0.001, self.rms_spin.value() / 1000.0),
            end_silence_ms=int(self.silence_spin.value() * 100),
            min_utt_ms=DEFAULT_MIN_UTT_MS,
            max_utt_ms=DEFAULT_MAX_UTT_MS,
        )

        self.mic_thread = MicListenerThread(params)
        self.mic_thread.got_text.connect(self.on_voice_text)
        self.mic_thread.got_error.connect(self.on_voice_error)
        self.mic_thread.status.connect(self.status_label.setText)
        self.mic_thread.start()
        self.btn_mic_toggle.setText("⏹ Stop Mic")

    def on_voice_text(self, raw: str):
        self.status_label.setText(f"Heard: {raw}")
        try:
            ref = normalize_reference(raw)
            self.input_ref.setText(ref)
            self.status_label.setText(f"Parsed: {ref}")
            if self.chk_auto_show.isChecked():
                self.show_fullscreen()
        except Exception:
            self.input_ref.setText(raw)

    def on_voice_error(self, err: str):
        self.btn_mic_toggle.setText("🎤 Start Mic (Offline)")
        self.mic_thread = None
        QMessageBox.critical(self, "Mic/Whisper Error", err)

    def _load_passage(self):
        return fetch_passage_text(
            self.input_ref.text(),
            include_verse_numbers=self.chk_verse_numbers.isChecked()
        )

    def show_fullscreen(self):
        try:
            display_ref, passage_text = self._load_passage()
            self.display.set_content(passage_text, display_ref)
            self.display.show_on_monitor_fullscreen(self.monitor_picker.currentIndex())
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))

    def update_only(self):
        try:
            display_ref, passage_text = self._load_passage()
            self.display.set_content(passage_text, display_ref)
            if not self.display.isVisible():
                self.display.show()
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))

    def hide_display(self):
        self.display.hide()

    def closeEvent(self, event):
        if self.mic_thread and self.mic_thread.isRunning():
            self.mic_thread.stop()
        event.accept()

def excepthook(exc_type, exc, tb):
    import traceback
    traceback.print_exception(exc_type, exc, tb)
    try:
        QMessageBox.critical(None, "Unhandled Error", "".join(traceback.format_exception(exc_type, exc, tb)))
    except Exception:
        pass

sys.excepthook = excepthook


def main():
    app = QApplication(sys.argv)
    w = ControlWindow()
    w.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
