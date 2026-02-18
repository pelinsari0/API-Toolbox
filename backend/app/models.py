from sqlalchemy import Column, Integer, String, Text
from .db import Base

class RequestItem(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    method = Column(String, nullable=False)
    url = Column(String, nullable=False)
    headers = Column(Text)
    body = Column(Text)

class HistoryItem(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    method = Column(String, nullable=False)
    url = Column(String, nullable=False)
    status_code = Column(Integer)
    duration_ms = Column(Integer)

class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    variables = Column(Text, nullable=False)  # JSON string