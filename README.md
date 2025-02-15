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
  "Risk": "<percentage risk>"
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
6. Updates the analysis statistics.

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

---

## 🚀 Running the API

```sh
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```