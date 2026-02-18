from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import httpx
import time
import json
import re
from shlex import quote
from urllib.parse import urlencode

from .db import Base, engine, SessionLocal
from .models import RequestItem, HistoryItem, Environment

app = FastAPI(title="API Toolbox Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_VAR_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def apply_vars(s: Any, vars_: Dict[str, str]) -> Any:
    if not isinstance(s, str):
        return s
    return _VAR_PATTERN.sub(lambda m: str(vars_.get(m.group(1), m.group(0))), s)


class SendRequest(BaseModel):
    method: str
    url: str
    headers: Dict[str, str] = {}
    params: Dict[str, str] = {}
    body: Optional[Any] = None
    environment_id: Optional[int] = None


class SaveRequest(BaseModel):
    name: str
    method: str
    url: str
    headers: Dict[str, str] = {}
    body: Dict[str, Any] = {}


class SaveEnv(BaseModel):
    name: str
    variables: Dict[str, str] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/send")
async def send(req: SendRequest, db: Session = Depends(get_db)):
    start = time.time()
    method = (req.method or "GET").upper()

    vars_ = {}
    if req.environment_id is not None:
        env = db.query(Environment).filter(Environment.id == req.environment_id).first()
        if env:
            try:
                vars_ = json.loads(env.variables or "{}")
            except Exception:
                vars_ = {}

    final_url = apply_vars(req.url, vars_)
    final_headers = {k: apply_vars(v, vars_) for k, v in (req.headers or {}).items()}
    final_params = {k: apply_vars(v, vars_) for k, v in (req.params or {}).items()}

    final_body = req.body
    if isinstance(final_body, dict):
        final_body = json.loads(apply_vars(json.dumps(final_body), vars_))
    elif isinstance(final_body, list):
        final_body = json.loads(apply_vars(json.dumps(final_body), vars_))
    elif isinstance(final_body, str):
        final_body = apply_vars(final_body, vars_)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.request(
            method=method,
            url=final_url,
            headers=final_headers,
            params=final_params,
            json=final_body if final_body is not None else None,
        )

    duration_ms = int((time.time() - start) * 1000)

    content_type = (r.headers.get("content-type", "") or "").lower()
    data = None
    text = None

    if "application/json" in content_type:
        try:
            data = r.json()
        except Exception:
            text = r.text
    else:
        text = r.text

    history = HistoryItem(
        method=method,
        url=final_url,
        status_code=r.status_code,
        duration_ms=duration_ms,
    )
    db.add(history)
    db.commit()

    return {
        "status_code": r.status_code,
        "duration_ms": duration_ms,
        "headers": dict(r.headers),
        "json": data,
        "text": text,
    }


@app.post("/curl")
def generate_curl(payload: dict):
    method = (payload.get("method") or "GET").upper()
    url = payload.get("url") or ""
    headers = payload.get("headers") or {}
    params = payload.get("params") or {}
    body = payload.get("body")

    if params:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{urlencode(params)}"

    parts = [f"curl -X {method} {quote(url)}"]

    for k, v in headers.items():
        parts.append(f"-H {quote(f'{k}: {v}')}")

    if body is not None and method in ["POST", "PUT", "PATCH"]:
        parts.append(f"--data {quote(json.dumps(body))}")

    return {"curl": " \\\n  ".join(parts)}


@app.post("/requests")
def save_request(payload: SaveRequest, db: Session = Depends(get_db)):
    item = RequestItem(
        name=payload.name,
        method=payload.method.upper(),
        url=payload.url,
        headers=json.dumps(payload.headers or {}),
        body=json.dumps(payload.body or {}),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id}


@app.get("/requests")
def list_requests(db: Session = Depends(get_db)):
    items = db.query(RequestItem).order_by(RequestItem.id.desc()).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "method": i.method,
            "url": i.url,
            "headers": json.loads(i.headers or "{}"),
            "body": json.loads(i.body or "{}"),
        }
        for i in items
    ]


@app.get("/history")
def get_history(db: Session = Depends(get_db)):
    items = db.query(HistoryItem).order_by(HistoryItem.id.desc()).limit(50).all()
    return [
        {
            "id": i.id,
            "method": i.method,
            "url": i.url,
            "status_code": i.status_code,
            "duration_ms": i.duration_ms,
        }
        for i in items
    ]


@app.post("/environments")
def create_env(payload: SaveEnv, db: Session = Depends(get_db)):
    env = Environment(
        name=payload.name,
        variables=json.dumps(payload.variables or {}),
    )
    db.add(env)
    db.commit()
    db.refresh(env)
    return {"id": env.id}


@app.get("/environments")
def list_envs(db: Session = Depends(get_db)):
    envs = db.query(Environment).order_by(Environment.id.desc()).all()
    out = []
    for e in envs:
        try:
            vars_ = json.loads(e.variables or "{}")
        except Exception:
            vars_ = {}
        out.append({"id": e.id, "name": e.name, "variables": vars_})
    return out