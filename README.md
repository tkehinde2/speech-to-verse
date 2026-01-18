# Bible Verse Finder

A Python application that records audio input and searches the Bible for matching verses using speech recognition.

## Requirements

- Python 3.8+
- `numpy`
- `requests`
- `sounddevice`
- `screeninfo`
- `PyQt6`
- `openai-whisper`

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/verse_clean.git
cd verse_clean
```

2. Create and activate a virtual environment:
```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

```bash
python verse_clean.py
```

The application will open a GUI where you can:
- Record Bible verses
- Search for matching verses in the Bible database

## License

MIT
