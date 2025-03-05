from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from apscheduler.schedulers.background import BackgroundScheduler
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import os
import json
import logging
import uvicorn
import re
import pickle
import ssl
import nltk
from nltk.corpus import stopwords
from tensorflow.keras.models import load_model
import requests
from datetime import datetime, timedelta
from functools import lru_cache
from langdetect import detect, DetectorFactory
from deep_translator import GoogleTranslator
from typing import List, Dict, Any

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Consistent language detection
DetectorFactory.seed = 0

# SSL Configuration for NLTK
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Load stopwords
nltk.download('stopwords', quiet=True)
stop_words = set(stopwords.words('english'))

# Load models and vectorizer
model = load_model("my_models/phishing_email_model.h5", compile=False)
with open("my_models/tfidf_vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)


# Persistent files
PROCESSED_EMAILS_FILE = "processed_emails.json"
TOKEN_FILE = "token.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Utility Functions
def load_processed_emails():
    """Load processed email IDs from a persistent file."""
    if os.path.exists(PROCESSED_EMAILS_FILE):
        with open(PROCESSED_EMAILS_FILE, 'r') as f:
            data = json.load(f)
            # Remove entries older than 7 days to prevent file growth
            current_time = datetime.now()
            data = {k: v for k, v in data.items() if 
                    current_time - datetime.fromisoformat(v) <= timedelta(days=7)}
            return data
    return {}

def save_processed_emails(processed_emails):
    """Save processed email IDs to a persistent file."""
    with open(PROCESSED_EMAILS_FILE, 'w') as f:
        json.dump(processed_emails, f)

def clean_text(text):
    text = str(text).lower()
    text = re.sub(r'\W', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = ' '.join(word for word in text.split() if word not in stop_words)
    return text

def detect_language(text):
    try:
        return detect(text[:1000])  # Use first 1000 characters for speed
    except Exception as e:
        logger.error(f"Language detection error: {e}")
        return "unknown"

@lru_cache(maxsize=1000)
def translate_to_english(text, source_lang):
    if source_lang == "en" or source_lang == "unknown":
        return text
    try:
        limited_text = text[:5000] if len(text) > 5000 else text
        return GoogleTranslator(source=source_lang, target="en").translate(limited_text)
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text

def extract_urls(text):
    url_pattern = r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+"
    return re.findall(url_pattern, text)

def check_url_safety(url):
    api_key = "your_google_safe_browsing_api_key"
    gsb_url = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
    
    payload = {
        "client": {"clientId": "your-app", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }
    try:
        response = requests.post(gsb_url, json=payload, params={"key": api_key})
        response.raise_for_status()
        result = response.json()
        return "matches" in result
    except requests.RequestException as e:
        logger.error(f"Error checking URL safety for {url}: {e}")
        return False

def process_email(email_text: str) -> Dict[str, Any]:
    detected_lang = detect_language(email_text)
    translated_text = email_text if detected_lang == "en" else translate_to_english(email_text, detected_lang)
    cleaned_text = clean_text(translated_text)
    text_vector = vectorizer.transform([cleaned_text]).toarray()
    prediction = float(model.predict(text_vector)[0][0])
    
    urls = extract_urls(email_text)
    malicious_urls = [url for url in urls if check_url_safety(url)]
    
    is_scam = len(malicious_urls) > 0 or prediction > 0.7
    result = {
        "original_text": email_text[:500] + "..." if len(email_text) > 500 else email_text,
        "translated_text": (
            translated_text[:500] + "..." 
            if detected_lang != "en" and len(translated_text) > 500 
            else translated_text if detected_lang != "en" 
            else "N/A"
        ),
        "original_language": detected_lang,
        "prediction": "🚨 Social Engineering Detected" if is_scam else "✅ Normal Message",
        "Risk": "100.00%" if len(malicious_urls) > 0 else f"{round(prediction * 100, 2)}%",
        "urls_found": urls,
        "malicious_urls": malicious_urls
    }
    
    return result

# Data store for dashboard statistics
analysis_data = {
    "total_emails": 0,
    "phishing_count": 0,
    "normal_count": 0,
    "history": []
}

# Create FastAPI app
app = FastAPI()

def get_gmail_service():
    """Function to connect to Gmail API"""
    creds = None

    # Load token if it exists
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    # If no valid token, perform new login
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
        creds = flow.run_local_server(port=0)

        # Save token for future use
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)

def fetch_latest_emails():
    """Fetch latest emails with improved deduplication"""
    logging.info("📩 Fetching latest emails...")

    try:
        # Load previously processed emails
        processed_emails = load_processed_emails()
        
        service = get_gmail_service()
        results = service.users().messages().list(userId="me", maxResults=5).execute()
        messages = results.get("messages", [])

        for msg in messages:
            msg_id = msg["id"]

            # Check if this email has been processed recently
            if msg_id in processed_emails:
                continue  # Skip already processed emails

            # Fetch email details
            msg_detail = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
            
            headers = msg_detail["payload"]["headers"]
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
            snippet = msg_detail.get("snippet", "No Content")

            logging.info(f"📧 Email from: {sender}, Subject: {subject}")
            logging.info(f"✉ Snippet: {snippet}")

            # Analyze the email
            analyze_email(snippet)

            # Save message ID with current timestamp
            processed_emails[msg_id] = datetime.now().isoformat()

        # Save processed emails list
        save_processed_emails(processed_emails)

    except Exception as e:
        logging.error(f"❌ Error fetching emails: {e}")

def analyze_email(email_text):
    """Send email to API for phishing analysis"""
    url = "http://localhost:5001/predict"
    payload = {"email_text": email_text}
    
    try:
        response = requests.post(url, json=payload)
        result = response.json()
        logging.info(f"🚨 Email Analysis Result: {result}")
    except Exception as e:
        logging.error(f"❌ Error analyzing email: {e}")

# Schedule email fetching job
scheduler = BackgroundScheduler()
scheduler.add_job(fetch_latest_emails, "interval", seconds=30)
scheduler.start()

# Templates configuration
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard")
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request, "analysis_data": json.dumps(analysis_data)})

@app.post("/predict")
async def predict_email(request: EmailRequest):
    try:
        email_text = request.email_text.strip()
        if not email_text:
            return JSONResponse(content={"error": "No email text provided"}, status_code=400)

        result = process_email(email_text)

        # Update statistics
        analysis_data["total_emails"] += 1
        if "Social Engineering Detected" in result["prediction"]:
            analysis_data["phishing_count"] += 1
        else:
            analysis_data["normal_count"] += 1

        analysis_data["history"].append(result)
        # Keep only the 1000 most recent entries
        if len(analysis_data["history"]) > 1000:
            analysis_data["history"] = analysis_data["history"][-1000:]

        logger.info(f"Processed email: {result['prediction']}")
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error processing email: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/history")
async def get_history(request: Request):
    return templates.TemplateResponse("history.html", {
        "request": request, 
        "history": analysis_data["history"],
        "analysis_data": json.dumps(analysis_data)
    })

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)