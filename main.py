import os
import json
import tempfile
import pandas as pd
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader
from openai import OpenAI

app = FastAPI(
    title="AI Document Data Extractor Backend",
    description="Limited live demo backend for extracting custom fields from PDFs using OpenAI",
    version="1.0.0"
)

# Enable CORS for portfolio front-end integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your portfolio domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client using environment variables
# Always fetch API keys from the environment to prevent hardcoding secrets
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def get_openai_client():
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="OPENAI_API_KEY is not configured in backend environment variables."
        )
    return OpenAI(api_key=OPENAI_API_KEY)

def extract_text_from_pdf(pdf_path: str) -> str:
    """Helper function to parse and extract text content from a local PDF file."""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Failed to parse PDF document. Ensure it's a valid PDF file. Error: {str(e)}"
        )

@app.post("/extract")
async def extract_fields_from_pdf(
    files: List[UploadFile] = File(...),
    fields: str = Form(...)  # Comma-separated fields or a JSON array string
):
    """
    Endpoint to extract user-defined fields from uploaded PDF files.
    """
    # Demo constraints
    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 PDF files allowed per upload.")
    
    # Parse fields
    try:
        if fields.strip().startswith("["):
            target_fields = json.loads(fields)
        else:
            target_fields = [f.strip() for f in fields.split(",") if f.strip()]
    except Exception:
        raise HTTPException(status_code=400, detail="Fields should be a comma-separated list or JSON list.")
    
    if not target_fields:
        raise HTTPException(status_code=400, detail="No target fields specified.")
    
    if len(target_fields) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 target fields allowed in demo mode.")

    client = get_openai_client()
    results = []

    # Process files temporarily
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF. Only PDF files are supported.")
        
        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            temp_path = temp_pdf.name
            try:
                contents = await file.read()
                if len(contents) > 5 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds the 5MB size limit.")
                temp_pdf.write(contents)
            finally:
                temp_pdf.close()
        
        try:
            # 1. Extract text from the PDF file
            extracted_text = extract_text_from_pdf(temp_path)
            
            if not extracted_text:
                raise HTTPException(status_code=400, detail=f"No text content could be extracted from {file.filename}.")

            # 2. Call OpenAI API using structured output to extract fields
            fields_schema = {
                "type": "object",
                "properties": {
                    field: {
                        "type": "string", 
                        "description": f"The exact extracted value of the field '{field}'. Return 'Not found' if the field is not present."
                    } for field in target_fields
                },
                "required": target_fields
            }

            system_prompt = (
                "You are an expert document extraction assistant. You will analyze the provided raw document text and "
                "extract specific fields. If a field's information is not present in the document text, return strictly "
                "'Not found' for that field. Do not make up, guess, or assume any values."
            )

            user_prompt = f"Document Text:\n{extracted_text}\n\nFields to extract: {', '.join(target_fields)}"

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={
                    "type": "json_object"
                },
                temperature=0.0
            )

            extraction_json = json.loads(response.choices[0].message.content)
            
            # Align keys to exactly the requested fields
            aligned_data = {}
            for field in target_fields:
                aligned_data[field] = extraction_json.get(field, "Not found")

            results.append({
                "fileName": file.filename,
                "status": "Extracted",
                "data": aligned_data
            })

        except Exception as e:
            # Graceful error state for individual file failures
            results.append({
                "fileName": file.filename,
                "status": "Failed",
                "data": {field: "Extraction error" for field in target_fields},
                "error": str(e)
            })
        finally:
            # Cleanup: Delete the temporary file immediately after processing
            if os.path.exists(temp_path):
                os.remove(temp_path)

    return {
        "success": True,
        "results": results,
        "fields": target_fields
    }

@app.post("/export")
async def export_to_file(
    rows: List[dict],
    fields: List[str],
    format: str = "csv"
):
    """
    Endpoint to receive JSON results and convert them to a downloadable spreadsheet (CSV or Excel)
    using temporary storage and returning a FileResponse, cleaning up after sending.
    """
    # Build list of rows for the spreadsheet
    sheet_rows = []
    for row in rows:
        formatted_row = {
            "File Name": row.get("fileName", "Unknown"),
        }
        data = row.get("data", {})
        for field in fields:
            formatted_row[field] = data.get(field, "Not found")
        
        formatted_row["Status"] = row.get("status", "Extracted")
        sheet_rows.append(formatted_row)
    
    # Generate temporary spreadsheet
    df = pd.DataFrame(sheet_rows)
    
    suffix = ".xlsx" if format.lower() == "xlsx" else ".csv"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
    
    try:
        if format.lower() == "xlsx":
            df.to_excel(temp_path, index=False, engine="openpyxl")
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "extracted_document_data.xlsx"
        else:
            df.to_csv(temp_path, index=False)
            media_type = "text/csv"
            filename = "extracted_document_data.csv"
            
        return FileResponse(
            temp_path, 
            media_type=media_type, 
            filename=filename,
            background=lambda: os.path.exists(temp_path) and os.remove(temp_path) # Clean up on response completion
        )
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to generate download. Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
