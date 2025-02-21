from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
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
from typing import List, Dict, Any
from pydantic import BaseModel, Field

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

# โหลด Stopwords (เฉพาะภาษาอังกฤษ)
nltk.download('stopwords', quiet=True)
stop_words = set(stopwords.words('english'))

# โหลดโมเดลและ Vectorizer
model = load_model("my_models/phishing_email_model.h5", compile=False)
with open("my_models/tfidf_vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# ตรวจสอบเวอร์ชันของ scikit-learn
required_sklearn_version = "1.6.1"
if sklearn.__version__ != required_sklearn_version:
    logger.warning(f"scikit-learn version mismatch! Required: {required_sklearn_version}, Found: {sklearn.__version__}")

# Models
class EmailRequest(BaseModel):
    email_text: str = Field(..., description="อีเมลที่ต้องการตรวจสอบ")

class BatchEmailRequest(BaseModel):
    emails: List[str] = Field(..., description="รายการอีเมลที่ต้องการตรวจสอบ")

# clean text
def clean_text(text):
    text = str(text).lower()
    text = re.sub(r'\W', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = ' '.join(word for word in text.split() if word not in stop_words)
    return text

# ตรวจจับภาษา
def detect_language(text):
    try:
        return detect(text[:1000])  # ใช้แค่ 1000 ตัวอักษรแรกเพื่อความเร็ว
    except:
        return "unknown"

# แปลข้อความเป็นภาษาอังกฤษ
@lru_cache(maxsize=1000)
def translate_to_english(text, source_lang):
    if source_lang == "en" or source_lang == "unknown":
        return text
    try:
        # จำกัดขนาดข้อความสำหรับการแปล
        limited_text = text[:5000] if len(text) > 5000 else text
        return GoogleTranslator(source=source_lang, target="en").translate(limited_text)
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text

# Process a single email
def process_email(email_text: str) -> Dict[str, Any]:
    detected_lang = detect_language(email_text)
    translated_text = email_text if detected_lang == "en" else translate_to_english(email_text, detected_lang)
    cleaned_text = clean_text(translated_text)
    text_vector = vectorizer.transform([cleaned_text]).toarray()
    prediction = float(model.predict(text_vector)[0][0])
    
    result = {
        "original_text": email_text[:500] + "..." if len(email_text) > 500 else email_text,
        "translated_text": translated_text[:500] + "..." if detected_lang != "en" and len(translated_text) > 500 else translated_text if detected_lang != "en" else "N/A",
        "original_language": detected_lang,
        "prediction": "🚨 Social Engineering Detected" if prediction > 0.7 else "✅ Normal Message",
        "Risk": f"{round(prediction * 100, 2)}%"
    }
    
    return result

# Data store for dashboard statistics
analysis_data = {
    "total_emails": 0,
    "phishing_count": 0,
    "normal_count": 0,
    "history": []
}

# สร้าง FastAPI app
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

        result = process_email(email_text)

        # อัปเดตสถิติ
        analysis_data["total_emails"] += 1
        if "Social Engineering Detected" in result["prediction"]:
            analysis_data["phishing_count"] += 1
        else:
            analysis_data["normal_count"] += 1

        analysis_data["history"].append(result)
        # เก็บแค่ 1000 รายการล่าสุด
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