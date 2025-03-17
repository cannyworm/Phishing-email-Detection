from fastapi import FastAPI, Request, BackgroundTasks
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
from typing import Dict, Any, List
from schemas import EmailRequest
import httpx
import asyncio
import firebase_admin
from firebase_admin import credentials, firestore
import datetime
from fastapi.concurrency import run_in_threadpool

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

# ✅ Pre-compile regex patterns for better performance
URL_PATTERN = re.compile(r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+")
CLEAN_TEXT_PATTERN1 = re.compile(r"\W")
CLEAN_TEXT_PATTERN2 = re.compile(r"\s+")

# ✅ Lazy loading for ML models
model = None
vectorizer = None

def get_model():
    global model
    if model is None:
        logger.info("Loading ML model...")
        model = load_model("my_models/phishing_email_model.h5", compile=False)
    return model

def get_vectorizer():
    global vectorizer
    if vectorizer is None:
        logger.info("Loading vectorizer...")
        with open("my_models/tfidf_vectorizer.pkl", "rb") as f:
            vectorizer = pickle.load(f)
    return vectorizer

# ✅ Check scikit-learn version
required_sklearn_version = "1.6.1"
if sklearn.__version__ != required_sklearn_version:
    logger.warning(
        f"scikit-learn version mismatch! Required: {required_sklearn_version}, Found: {sklearn.__version__}")

# ✅ Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate("mini-phishguard-key.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clean_text(text):
    text = str(text).lower()
    text = CLEAN_TEXT_PATTERN1.sub(" ", text)
    text = CLEAN_TEXT_PATTERN2.sub(" ", text)
    return " ".join(word for word in text.split() if word not in stop_words)

def detect_language(text):
    try:
        # Use only first 500 characters for faster language detection
        sample = text[:500] 
        return detect(sample)
    except Exception as e:
        logger.error(f"Language detection error: {e}")
        return "unknown"

@lru_cache(maxsize=10000)
def translate_to_english(text, source_lang):
    if source_lang == "en" or source_lang == "unknown":
        return text
    try:
        # Limit translation length for performance
        limited_text = text[:5000] if len(text) > 5000 else text
        return GoogleTranslator(source=source_lang, target="en").translate(limited_text)
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text

def extract_urls(text):
    return URL_PATTERN.findall(text)

async def check_url_safety_async(url):
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
        async with httpx.AsyncClient() as client:
            response = await client.post(gsb_url, json=payload, params={"key": api_key})
            response.raise_for_status()
            result = response.json()
            return "matches" in result
    except Exception as e:
        logger.error(f"Error checking URL safety for {url}: {e}")
        return False

async def check_urls_safety_batch(urls):
    if not urls:
        return {}
    
    api_key = "api_key"  # Replace with your API Key
    gsb_url = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
    
    # Create batch of URLs - limit to 500 URLs per request as per API limits
    entries = [{"url": url} for url in urls[:500]]
    payload = {
        "client": {"clientId": "your-app", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": entries
        }
    }
    
    results = {url: False for url in urls}  # Default all URLs as safe
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(gsb_url, json=payload, params={"key": api_key})
            response.raise_for_status()
            result = response.json()
            
            # Mark matched URLs as unsafe
            if "matches" in result:
                for match in result["matches"]:
                    results[match["threat"]["url"]] = True
                    
    except Exception as e:
        logger.error(f"Error checking URLs safety in batch: {e}")
        
    return results

async def process_email_async(email_text: str) -> Dict[str, Any]:
    # Use only the first 5000 characters for processing to improve speed
    processing_text = email_text[:5000] if len(email_text) > 5000 else email_text
    
    # Run language detection
    detected_lang = detect_language(processing_text)
    
    # Translate if needed - run in threadpool since translation library is blocking
    if detected_lang != "en" and detected_lang != "unknown":
        translated_text = await run_in_threadpool(
            lambda: translate_to_english(processing_text, detected_lang)
        )
    else:
        translated_text = processing_text
    
    # Clean and vectorize text - run in threadpool for performance
    cleaned_text = await run_in_threadpool(lambda: clean_text(translated_text))
    
    # Load models only when needed
    model_instance = get_model()
    vectorizer_instance = get_vectorizer()
    
    # Vectorize and predict
    text_vector = await run_in_threadpool(
        lambda: vectorizer_instance.transform([cleaned_text]).toarray()
    )
    prediction = float((await run_in_threadpool(
        lambda: model_instance.predict(text_vector)
    ))[0][0])
    
    # Extract and check URLs
    urls = extract_urls(email_text)
    
    # Use batch URL check for better performance
    url_safety_results = await check_urls_safety_batch(urls)
    malicious_urls = [url for url, is_malicious in url_safety_results.items() if is_malicious]
    
    # Determine Scam Status
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

async def save_to_firestore_async(email_result: dict):
    try:
        await run_in_threadpool(
            lambda: db.collection("email_analysis").add(email_result)
        )
        logger.info(f"Stored result in Firestore: {email_result['prediction']}")
    except Exception as e:
        logger.error(f"Error storing result in Firestore: {e}")

async def batch_save_to_firestore(email_results: List[dict]):
    try:
        def _batch_save():
            batch = db.batch()
            for result in email_results:
                doc_ref = db.collection("email_analysis").document()
                batch.set(doc_ref, result)
            batch.commit()
        
        await run_in_threadpool(_batch_save)
        logger.info(f"Batch stored {len(email_results)} results in Firestore")
    except Exception as e:
        logger.error(f"Error batch storing results in Firestore: {e}")

@lru_cache(maxsize=10)
def get_analytics_data(max_age_seconds=60):  # Cache expires after 60 seconds
    try:
        # Get timestamp for caching
        timestamp = int(datetime.datetime.utcnow().timestamp() / max_age_seconds)
        
        # Function to retrieve from Firestore
        def _get_data():
            # First check if we have a summary document
            summary_ref = db.collection("analytics").document("summary")
            summary_doc = summary_ref.get()
            
            if summary_doc.exists:
                summary_data = summary_doc.to_dict()
                # If summary is recent enough, use it
                if (datetime.datetime.utcnow() - 
                    datetime.datetime.fromisoformat(summary_data.get("last_updated"))).total_seconds() < 3600:
                    
                    # Get only the most recent history items
                    history_query = db.collection("email_analysis").order_by(
                        "timestamp", direction=firestore.Query.DESCENDING).limit(50).stream()
                    history = [doc.to_dict() for doc in history_query]
                    summary_data["history"] = history
                    return summary_data
            
            # Otherwise calculate from scratch (fallback)
            email_analysis = db.collection("email_analysis").order_by(
                "timestamp", direction=firestore.Query.DESCENDING).limit(1000).stream()
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
            
            # Create summary data
            summary_data = {
                "total_emails": total_emails,
                "normal_count": normal_count,
                "phishing_count": phishing_count,
                "today_count": today_count,
                "normal_percentage": normal_percentage,
                "phishing_percentage": phishing_percentage,
                "last_updated": datetime.datetime.utcnow().isoformat(),
                "history": history[:50]  # Only return the 50 most recent items
            }
            
            # Store summary for future use
            db.collection("analytics").document("summary").set({
                k: v for k, v in summary_data.items() if k != "history"
            })
            
            return summary_data
        
        return _get_data()
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

async def update_analytics_summary_async():
    """Background task to update analytics summary"""
    try:
        # Clear cache to force recalculation
        get_analytics_data.cache_clear()
        
        # Get fresh data
        _ = get_analytics_data(max_age_seconds=1)
        logger.info("Analytics summary updated")
    except Exception as e:
        logger.error(f"Error updating analytics summary: {e}")

# FastAPI App Initialization
app = FastAPI(title="PhishGuard API", 
              description="API for detecting phishing emails",
              version="2.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.on_event("startup")
async def startup_event():
    # Warm up cache by pre-loading models (but don't block startup)
    asyncio.create_task(run_in_threadpool(get_model))
    asyncio.create_task(run_in_threadpool(get_vectorizer))
    logger.info("API started - preloading models in background")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    # Get analytics data for the dashboard (cached)
    analysis_data = get_analytics_data()
    
    # Convert analysis_data to JSON for the template
    analysis_json = json.dumps(analysis_data)
    
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "analysis_data": analysis_json}
    )

@app.post("/predict")
async def predict_email(request: EmailRequest, background_tasks: BackgroundTasks):
    try:
        email_text = request.email_text.strip()
        if not email_text:
            return JSONResponse(content={"error": "No email text provided"}, status_code=400)
        
        # Process email asynchronously
        result = await process_email_async(email_text)
        
        # Save to Firestore in background task
        background_tasks.add_task(save_to_firestore_async, result)
        
        # Schedule analytics update in background
        background_tasks.add_task(update_analytics_summary_async)
        
        logger.info(f"Processed email: {result['prediction']}")
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error processing email: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/history", response_class=HTMLResponse)
async def get_history(request: Request ,limit: int = 50):
    try:
        data = get_analytics_data()
        return templates.TemplateResponse("history.html", {"request": request, "history": data["history"][:limit]})
    except Exception as e:
        logger.error(f"Error fetching email history: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("API shutting down")

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=5001, 
        workers=4,           
        loop="uvloop",       
        http="httptools", 
        log_level="info",
        reload=True
    )