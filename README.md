# API Toolbox

A modern, lightweight API testing tool inspired by Postman, built with **FastAPI** and **React (Vite)**.

API Toolbox allows developers to quickly test HTTP APIs, manage environments, save requests, inspect responses, and generate cURL commands — all in a clean local application with SQLite persistence.

---

## ✨ Features

### 🚀 Request Builder
- Send HTTP requests (GET, POST, PUT, PATCH, DELETE)
- URL input with environment variable support
- JSON request body editor
- Key–value editors for:
  - Headers
  - Query Parameters

### 🌍 Environments
- Create reusable environments (Dev / Prod / Testing)
- Use variables like:

- Automatic variable replacement in URL, headers, and body.

### 🧾 Saved Requests
- Save commonly used API requests
- Reload saved requests instantly
- Local persistence using SQLite

### 📜 Request History
- Automatic logging of sent requests
- Includes:
  - Method
  - URL
  - Status code
  - Response time (ms)

### 🔧 cURL Generator
- Generate cURL command from current request
- One-click copy to clipboard

### 💾 Export / Import
- Export environments and saved requests as JSON
- Import data to restore workspace on another machine

---

## 🧱 Tech Stack

### Backend
- FastAPI
- httpx (async HTTP client)
- SQLAlchemy
- SQLite

### Frontend
- React
- Vite
- Axios

---

## 🗂️ Project Structure