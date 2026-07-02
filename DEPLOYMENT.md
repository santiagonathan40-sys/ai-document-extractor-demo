# Deployment Instructions for Render

This document describes how to deploy the Python FastAPI backend for the **AI Document Data Extractor** to [Render](https://render.com).

## Prerequisites

1. A [GitHub](https://github.com) or [GitLab](https://gitlab.com) account.
2. A free account on [Render](https://render.com).
3. An OpenAI API Key (or Gemini API Key if you choose to adapt the code).

---

## Deployment Steps

### 1. Structure Your Backend Repository
Create a separate repository or folder on GitHub/GitLab containing the following files:
* `main.py` (The FastAPI application code)
* `requirements.txt` (The dependencies file)

### 2. Create a Web Service on Render
1. Log in to your Render Dashboard and click **New +** and select **Web Service**.
2. Connect your GitHub/GitLab repository.
3. Configure the following service settings:
   * **Name**: `ai-document-extractor-api` (or any name you prefer)
   * **Region**: Select a region close to your users (e.g., `Oregon (US West)` or `Frankfurt (EU Central)`)
   * **Branch**: `main` (or your default branch)
   * **Root Directory**: (Leave blank if files are at the root of your repository)
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 3. Add Environment Variables
1. Under **Environment Variables**, click **Add Environment Variable**.
2. Create the following key-value pairs:
   * **Key**: `OPENAI_API_KEY`
   * **Value**: *Your OpenAI API Key* (starts with `sk-...`)
   * **Key**: `PYTHON_VERSION` (Optional, recommended)
   * **Value**: `3.10.0` or higher

### 4. Deploy!
Click **Create Web Service**. Render will pull your code, install dependencies, and spin up your FastAPI backend! Once finished, Render will provide a public URL like `https://ai-document-extractor-api.onrender.com`.

---

## Connect Your Portfolio Front-end

To connect your React portfolio front-end to your newly deployed Render API:
1. Locate the API endpoint configuration in your frontend code (typically in your `.env` or configuration file).
2. Set the API URL to:
   ```env
   VITE_API_URL="https://ai-document-extractor-api.onrender.com"
   ```
3. The front-end will automatically start routing extraction calls to your Render service!
