# AI Document Data Extractor Demo

A portfolio demo for extracting selected fields from PDF documents and exporting the results to CSV or Excel.

## Local setup

Install frontend dependencies:

```bash
npm install
npm run dev
```

Run the Python backend in a second terminal:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Create `backend/.env` and add:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Create `.env` in the project root and add:

```env
VITE_API_URL=http://localhost:8000
```

## Notes

Do not commit real API keys. Keep `backend/.env` private.
