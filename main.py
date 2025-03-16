from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
import re
import pickle
import ssl
import nltk
from nltk.corpus import stopwords
from tensorflow.keras.models import load_model
import sklearn
import json
import logging
from functools import lru_cache
from langdetect import detect, DetectorFactory
from deep_translator import GoogleTranslator
from typing import Dict, Any
from schemas import EmailRequest
import requests
import firebase_admin
from firebase_admin import credentials, firestore
import datetime

# ✅ Logging Configuration
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ✅ Ensure langdetect returns the same result for the same text
DetectorFactory.seed = 0

# ✅ Disable SSL Verification for NLTK
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# ✅ Download stopwords (English only)
nltk.download("stopwords", quiet=True)
stop_words = set(stopwords.words("english"))

# ✅ Load Model & Vectorizer
model = load_model("my_models/phishing_email_model.h5", compile=False)
with open("my_models/tfidf_vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# ✅ Check scikit-learn version
required_sklearn_version = "1.6.1"
if sklearn.__version__ != required_sklearn_version:
    logger.warning(
        f"scikit-learn version mismatch! Required: {required_sklearn_version}, Found: {sklearn.__version__}")

# ✅ Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate(
        "mini-phishguard-key.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()


def clean_text(text):
    text = str(text).lower()
    text = re.sub(r"\W", " ", text)
    text = re.sub(r"\s+", " ", text)
    return " ".join(word for word in text.split() if word not in stop_words)


def detect_language(text):
    try:
        return detect(text[:1000])  # Use only the first 1000 characters
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
    api_key = "api_key"  # Replace with your API Key
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
        response = requests.post(
            gsb_url, json=payload, params={"key": api_key})
        response.raise_for_status()
        result = response.json()
        return "matches" in result
    except requests.RequestException as e:
        logger.error(f"Error checking URL safety for {url}: {e}")
        return False

def process_email(email_text: str) -> Dict[str, Any]:
    detected_lang = detect_language(email_text)
    translated_text = email_text if detected_lang == "en" else translate_to_english(
        email_text, detected_lang)
    cleaned_text = clean_text(translated_text)
    text_vector = vectorizer.transform([cleaned_text]).toarray()
    prediction = float(model.predict(text_vector)[0][0])

    urls = extract_urls(email_text)
    malicious_urls = [url for url in urls if check_url_safety(url)]

    #Determine Scam Status
    is_scam = len(malicious_urls) > 0 or prediction > 0.7

    result = {
        "original_text": email_text[:100] + "..." if len(email_text) > 100 else email_text,
        "translated_text": translated_text if detected_lang != "en" else "N/A",
        "original_language": detected_lang,
        "prediction": "🚨 Social Engineering Detected" if is_scam else "✅ Normal Message",
        "Risk": f"{round(prediction * 100, 2)}%",
        "urls_found": urls,
        "malicious_urls": malicious_urls,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    return result

def save_to_firestore(email_result: dict):
    try:
        db.collection("email_analysis").add(email_result)
        logger.info(f"Stored result in Firestore: {email_result}")
    except Exception as e:
        logger.error(f"Error storing result in Firestore: {e}")

def get_analytics_data():
    try:
        email_analysis = db.collection("email_analysis").order_by(
            "timestamp", direction=firestore.Query.DESCENDING).stream()
        history = [doc.to_dict() for doc in email_analysis]

        # Count metrics
        total_emails = len(history)
        phishing_count = sum(
            1 for entry in history if "Social Engineering Detected" in entry.get("prediction", ""))
        normal_count = total_emails - phishing_count

        today = datetime.datetime.utcnow().date()
        today_count = sum(1 for entry in history if 
                          "timestamp" in entry and 
                          datetime.datetime.fromisoformat(entry["timestamp"]).date() == today)

        if total_emails > 0:
            normal_percentage = round((normal_count / total_emails) * 100, 2)
            phishing_percentage = round((phishing_count / total_emails) * 100, 2)
        else:
            normal_percentage = 0.0
            phishing_percentage = 0.0

        return {
            "total_emails": total_emails,
            "normal_count": normal_count,
            "phishing_count": phishing_count,
            "today_count": today_count,
            "normal_percentage": normal_percentage,
            "phishing_percentage": phishing_percentage,
            "history": history
        }
    except Exception as e:
        logger.error(f"Error getting analytics data: {e}")
        return {
            "total_emails": 0,
            "normal_count": 0,
            "phishing_count": 0,
            "today_count": 0,
            "normal_percentage": 0.0,
            "phishing_percentage": 0.0,
            "history": []
        }

# FastAPI App Initialization
app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard")
async def dashboard(request: Request):
    # Get analytics data for the dashboard
    analysis_data = get_analytics_data()

    # Convert analysis_data to JSON for the template
    analysis_json = json.dumps(analysis_data)

    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "analysis_data": analysis_json}
    )

@app.post("/predict")
async def predict_email(request: EmailRequest):
    try:
        email_text = request.email_text.strip()
        if not email_text:
            return JSONResponse(content={"error": "No email text provided"}, status_code=400)

        result = process_email(email_text)
        save_to_firestore(result)

        logger.info(f"Processed email: {result['prediction']}")
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error processing email: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/history")
async def get_history(request: Request):
    try:
        # Get analytics data with history
        data = get_analytics_data()
        return templates.TemplateResponse("history.html", {"request": request, "history": data["history"]})
    except Exception as e:
        logger.error(f"Error fetching email history: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)