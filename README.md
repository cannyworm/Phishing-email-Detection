# Email Analysis API Documentation

## 📝 Overview

This API analyzes email text and predicts whether it contains social engineering or phishing content using a machine learning model.

## 🌍 Base URL

```
http://<host>:5001
```

---

## 📌 Endpoints

### 🏠 1. Home Page

**📍 Endpoint:**

```
GET /
```

**📝 Description:**

- Serves the home page using Jinja2 template rendering.

**📤 Response:**

- HTML page

---

### 📊 2. Dashboard

**📍 Endpoint:**

```
GET /dashboard
```

**📝 Description:**

- Displays the analysis dashboard with email classification statistics.

**📤 Response:**

- HTML page with statistics in JSON format.

---

### 🔍 3. Predict Email Classification

**📍 Endpoint:**

```
POST /predict
```

**📝 Description:**

- Predicts whether an email contains phishing content.

**📥 Request Body:**

```json
{
  "email_text": "<email content>"
}
```

**📤 Response:**

```json
{
  "original_text": "<original email content>",
  "translated_text": "<translated text if applicable, else 'N/A'>",
  "original_language": "<detected language>",
  "prediction": "🚨 Social Engineering Detected" OR "✅ Normal Message",
  "Risk": "<percentage risk>",
  "urls_found": ["<extracted URLs>"],
  "malicious_urls": ["<malicious URLs detected>"]
}
```

**❌ Error Responses:**

- `400 Bad Request`: If no email text is provided.
- `500 Internal Server Error`: If an error occurs during processing.

---

## 🔄 Processing Steps

1. Detects the language of the email text.
2. Translates it to English if necessary.
3. Cleans the text by removing special characters and stopwords.
4. Converts the text into a TF-IDF vector.
5. Uses a deep learning model to classify the email.
6. Extracts and checks URLs for potential threats.
7. Updates the analysis statistics.

---

## 📦 Dependencies

- `FastAPI`
- `pydantic`
- `tensorflow`
- `scikit-learn`
- `nltk`
- `langdetect`
- `deep_translator`
- `Jinja2`
- `uvicorn`
- `requests`

---

## 🔧 การติดตั้ง
```bash
# โคลนโปรเจกต์
git clone https://github.com/apolloS125/phishing-email-detector.git
cd phishing-email-detector

# สร้างสภาพแวดล้อมเสมือน
python -m venv venv
source venv/bin/activate  # บน Windows ใช้ venv\Scripts\activate

# ติดตั้งแพ็คเกจที่จำเป็น
pip install -r requirements.txt

# ตรวจสอบเวอร์ชัน scikit-learn
pip show scikit-learn
```

---

## 📂 โครงสร้างไฟล์
```
phishing-email-detector/
├── main.py                    # แอปพลิเคชันหลัก FastAPI
├── schemas.py                 # กำหนดโครงสร้างข้อมูลรับเข้า
├── templates/                 # เทมเพลต HTML
│   ├── index.html             # หน้าหลัก
│   ├── dashboard.html         # หน้าแดชบอร์ด
│   └── history.html           # หน้าประวัติการวิเคราะห์
├── my_models/                 # โมเดลและเครื่องมือ ML
│   ├── phishing_email_model.h5  # โมเดล Deep Learning
│   └── tfidf_vectorizer.pkl     # TF-IDF Vectorizer
└── requirements.txt            # รายการแพ็คเกจที่จำเป็น
```

---

## 🚀 Running the API

```sh
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```