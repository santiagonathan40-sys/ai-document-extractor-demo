import os
import json
import tempfile
import sqlite3
from datetime import date
from io import BytesIO
from typing import List, Dict, Any

import pandas as pd
import pymupdf4llm
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is missing. Add it to your .env file.")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="AI Document Data Extractor Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For testing. Later, replace with your real portfolio URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILES = 3
MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_FIELDS = 5
DAILY_ATTEMPT_LIMIT = 3
DB_FILE = "usage_limits.db"


def init_usage_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usage_limits (
            ip_address TEXT NOT NULL,
            usage_date TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (ip_address, usage_date)
        )
    """)

    conn.commit()
    conn.close()


init_usage_db()


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def check_usage_limit(ip_address: str):
    today = date.today().isoformat()

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT attempts FROM usage_limits WHERE ip_address = ? AND usage_date = ?",
        (ip_address, today)
    )

    row = cursor.fetchone()

    if row and row[0] >= DAILY_ATTEMPT_LIMIT:
        conn.close()
        raise HTTPException(
            status_code=429,
            detail="You have reached the demo limit for today. Please contact me for a custom automation version."
        )

    if row:
        cursor.execute(
            "UPDATE usage_limits SET attempts = attempts + 1 WHERE ip_address = ? AND usage_date = ?",
            (ip_address, today)
        )
    else:
        cursor.execute(
            "INSERT INTO usage_limits (ip_address, usage_date, attempts) VALUES (?, ?, ?)",
            (ip_address, today, 1)
        )

    conn.commit()
    conn.close()

class ExportRequest(BaseModel):
    rows: List[Dict[str, Any]]
    format: str = "csv"


@app.get("/")
def health_check():
    return {
        "status": "running",
        "message": "AI Document Data Extractor backend is working."
    }


def validate_fields(fields: List[str]) -> List[str]:
    cleaned_fields = []

    for field in fields:
        clean_field = field.strip()
        if clean_field:
            cleaned_fields.append(clean_field)

    if not cleaned_fields:
        raise HTTPException(status_code=400, detail="Please provide at least one field to extract.")

    if len(cleaned_fields) > MAX_FIELDS:
        raise HTTPException(status_code=400, detail=f"You can extract up to {MAX_FIELDS} fields only.")

    return cleaned_fields


async def validate_file(file: UploadFile) -> bytes:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail=f"{file.filename} is not a PDF file.")

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"{file.filename} is larger than 5MB.")

    return contents


def extract_pdf_text(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        text = pymupdf4llm.to_markdown(temp_path)
        return text[:15000]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def extract_fields_with_ai(document_text: str, fields: List[str]) -> Dict[str, str]:
    field_list = "\n".join([f"- {field}" for field in fields])

    prompt = f"""
You are a document data extraction assistant.

Extract the requested fields from the document text.

Requested fields:
{field_list}

Rules:
- Return only valid JSON.
- Use the exact field names requested.
- If a field is not found, return "Not found".
- Do not guess.
- Do not add fields that were not requested.

Document text:
{document_text}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You extract structured data from business documents and return clean JSON only."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        response_format={"type": "json_object"},
        temperature=0
    )

    content = response.choices[0].message.content

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = {field: "Not found" for field in fields}

    final_data = {}

    for field in fields:
        value = data.get(field, "Not found")
        if value is None or str(value).strip() == "":
            value = "Not found"
        final_data[field] = str(value)

    return final_data


@app.post("/extract")
async def extract_data(
    request: Request,
    files: List[UploadFile] = File(...),
    fields: str = Form(...)
):
    client_ip = get_client_ip(request)
    check_usage_limit(client_ip)
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"You can upload up to {MAX_FILES} PDF files only.")

    try:
        parsed_fields = json.loads(fields)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Fields must be sent as a JSON array.")

    selected_fields = validate_fields(parsed_fields)

    results = []

    for file in files:
        file_bytes = await validate_file(file)

        try:
            document_text = extract_pdf_text(file_bytes)
            extracted_data = extract_fields_with_ai(document_text, selected_fields)

            row = {
                "File Name": file.filename,
                **extracted_data,
                "Status": "Extracted"
            }

            results.append(row)

        except Exception as error:
            row = {
                "File Name": file.filename,
                **{field: "Not found" for field in selected_fields},
                "Status": f"Error: {str(error)}"
            }

            results.append(row)

    return {
        "success": True,
        "fields": ["File Name", *selected_fields, "Status"],
        "rows": results
    }


@app.post("/export")
async def export_data(request: ExportRequest):
    if not request.rows:
        raise HTTPException(status_code=400, detail="No rows provided for export.")

    dataframe = pd.DataFrame(request.rows)

    export_format = request.format.lower()

    if export_format == "csv":
        output = BytesIO()
        dataframe.to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=extracted_data.csv"
            }
        )

    if export_format in ["xlsx", "excel"]:
        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, sheet_name="Extracted Data")

        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=extracted_data.xlsx"
            }
        )

    raise HTTPException(status_code=400, detail="Invalid export format. Use csv or xlsx.")