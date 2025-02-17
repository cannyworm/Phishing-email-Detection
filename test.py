from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
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
from schemas import EmailRequest, BatchEmailRequest

# ตั้งค่า Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ✅ ตั้งค่าให้ langdetect ให้ผลลัพธ์เดิมสำหรับข้อความเดียวกัน
DetectorFactory.seed = 0

# ✅ ปิด SSL Verification สำหรับ NLTK
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

#โหลด Stopwords (เฉพาะภาษาอังกฤษ)
nltk.download('stopwords')
stop_words = set(stopwords.words('english'))

#โหลดโมเดลและ Vectorizer
model = load_model("my_models/phishing_email_model.h5", compile=False)

with open("my_models/tfidf_vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

#ตรวจสอบเวอร์ชันของ scikit-learn
required_sklearn_version = "1.6.1"
if sklearn.__version__ != required_sklearn_version:
    raise ValueError(f"scikit-learn version mismatch! Required: {required_sklearn_version}, Found: {sklearn.__version__}")

#clean text
def clean_text(text):
    text = str(text).lower()
    text = re.sub(r'\W', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = ' '.join(word for word in text.split() if word not in stop_words)
    return text

#ตรวจจับภาษา
def detect_language(text):
    try:
        return detect(text)
    except:
        return "unknown"

#แปลข้อความเป็นภาษาอังกฤษ
@lru_cache(maxsize=1000)
def translate_to_english(text, source_lang):
    if source_lang == "en":
        return text
    try:
        return GoogleTranslator(source=source_lang, target="en").translate(text)
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text

#Data store for dashboard statistics
analysis_data = {
    "total_emails": 0,
    "phishing_count": 0,
    "normal_count": 0
}

#สร้าง FastAPI app
app = FastAPI()
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

        #ตรวจจับภาษา
        detected_lang = detect_language(email_text)
        translated_text = email_text if detected_lang == "en" else translate_to_english(email_text, detected_lang)
        
        #ทำความสะอาดข้อความ และแปลงเป็นเวกเตอร์
        cleaned_text = clean_text(translated_text)
        text_vector = vectorizer.transform([cleaned_text]).toarray()
        prediction = model.predict(text_vector)[0][0]

        #อัปเดตสถิติ
        analysis_data["total_emails"] += 1
        if prediction > 0.5:
            analysis_data["phishing_count"] += 1
        else:
            analysis_data["normal_count"] += 1

        result = {
            "original_text": email_text,
            "translated_text": translated_text if detected_lang != "en" else "N/A",
            "original_language": detected_lang,
            "prediction": "🚨 Social Engineering Detected" if prediction > 0.5 else "✅ Normal Message",
            "Risk": f"{round(float(prediction) * 100, 2)}%"
        }
        logger.info(f"Processed single email: {result}")
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error processing email: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/batch_predict")
async def batch_predict(request: BatchEmailRequest):
    try:
        results = []
        for email_text in request.emails:
            email_text = email_text.strip()
            if not email_text:
                results.append({"error": "No email text provided"})
                continue

            detected_lang = detect_language(email_text)
            translated_text = email_text if detected_lang == "en" else translate_to_english(email_text, detected_lang)
            cleaned_text = clean_text(translated_text)
            text_vector = vectorizer.transform([cleaned_text]).toarray()
            prediction = model.predict(text_vector)[0][0]

            analysis_data["total_emails"] += 1
            if prediction > 0.5:
                analysis_data["phishing_count"] += 1
            else:
                analysis_data["normal_count"] += 1

            result = {
                "original_text": email_text,
                "translated_text": translated_text if detected_lang != "en" else "N/A",
                "original_language": detected_lang,
                "prediction": "🚨 Social Engineering Detected" if prediction > 0.5 else "✅ Normal Message",
                "Risk": f"{round(float(prediction) * 100, 2)}%"
            }
            results.append(result)
        
        logger.info(f"Processed batch of {len(request.emails)} emails")
        return JSONResponse(content={"results": results})
    
    except Exception as e:
        logger.error(f"Error processing batch emails: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("test:app", host="0.0.0.0", port=5001, reload=True)
