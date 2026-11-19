import datetime as dt, hashlib, hmac, os, secrets
import jwt
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///./circuit.db"), pool_pre_ping=True)
Session = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True); email = Column(String, unique=True, index=True); pw = Column(String)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True); user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String); circuit = Column(JSON); updated = Column(DateTime, default=dt.datetime.utcnow)

def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    return salt + "$" + hashlib.scrypt(pw.encode(), salt=salt.encode(), n=2**14, r=8, p=1).hex()

def check_pw(pw, stored):
    return hmac.compare_digest(hash_pw(pw, stored.split("$")[0]), stored)

def make_token(uid): return jwt.encode({"sub": str(uid), "exp": dt.datetime.utcnow() + dt.timedelta(days=7)}, SECRET, algorithm="HS256")
def read_token(t): return int(jwt.decode(t, SECRET, algorithms=["HS256"])["sub"])

def get_db():
    db = Session()
    try: yield db
    finally: db.close()
