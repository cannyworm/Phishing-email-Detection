# Email Analysis API Documentation

## Overview
This API is designed for analyzing email content and determining whether it contains elements of social engineering or phishing attacks using a machine learning model

This project is part of the 241-202 Machine Learning II.

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
- Renders the home page using Jinja2 templates.

**📤 Response:**
- HTML page

---

### 📊 2. Dashboard
**📍 Endpoint:**
```
GET /dashboard
```
**📝 Description:**
- Displays an interactive dashboard with email classification statistics.

**📤 Response:**
- HTML page containing JSON-based statistical data.

---

### 🔍 3. Predict Email Classification
**📍 Endpoint:**
```
POST /predict
```
**📝 Description:**
- Analyzes email content and predicts if it contains phishing indicators.

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
  "risk": "<percentage risk>",
  "urls_found": ["<extracted URLs>"],
  "malicious_urls": ["<malicious URLs detected>"]
}
```

**❌ Error Responses:**
- `400 Bad Request`: Missing email text in request.
- `500 Internal Server Error`: Unexpected processing failure.

---

## 🔄 Processing Workflow
1. Detects the language of the email text.
2. Translates content into English if necessary.
3. Cleans the text by removing stopwords and special characters.
4. Converts the cleaned text into a TF-IDF vector representation.
5. Applies a deep learning model for classification.
6. Extracts and analyzes URLs for potential threats.
7. Updates classification statistics accordingly.

---

## 📦 Required Dependencies
- `FastAPI` (API framework)
- `pydantic` (data validation)
- `tensorflow` (deep learning model)
- `scikit-learn` (ML preprocessing)
- `nltk` (natural language processing)
- `langdetect` (language detection)
- `deep_translator` (translation utilities)
- `Jinja2` (template rendering)
- `uvicorn` (ASGI server)
- `requests` (HTTP requests handling)

---

## 🔧 Installation Guide
```bash
# Clone the repository
git clone https://github.com/apolloS125/phishing-email-detector.git
cd phishing-email-detector

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify scikit-learn installation
pip show scikit-learn
```

---

## 📂 Project Directory Structure
```
phishing-email-detector/
├── main.py                    # FastAPI main application
├── schemas.py                 # Pydantic models for request/response validation
├── templates/                 # HTML template files
│   ├── index.html             # Home page
│   ├── dashboard.html         # Dashboard page
│   └── history.html           # Analysis history
├── my_models/                 # Machine learning models and preprocessing tools
│   ├── phishing_email_model.h5  # Trained deep learning model
│   └── tfidf_vectorizer.pkl     # Pre-trained TF-IDF vectorizer
└── requirements.txt            # List of required dependencies
```

---

## 🚀 Running the API Server
```sh
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

