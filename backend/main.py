from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, gage
from routers import calibration
from routers import issue_log
from routers import label
from routers import calibration_measurements
from routers import reports
from database import init_db, init_async_db
from config import get_settings
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="Gage Calibration System API",
    description="API for managing gage calibration and inventory",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(gage.router, prefix="/api", tags=["Gage Inventory"])
app.include_router(calibration.router, prefix="/api", tags=["Calibration Records"])
app.include_router(issue_log.router, tags=["Issue Logs"])
app.include_router(label.router, prefix="/api", tags=["Labels"])
app.include_router(calibration_measurements.router, prefix="/api", tags=["Calibration Measurements"])
app.include_router(reports.router, prefix="/api", tags=["Reports"])

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Initialize both sync and async databases
        init_db()
        await init_async_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise

@app.get("/")
async def root():
    return {
        "message": "Welcome to Gage Calibration System API",
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=5005,
        reload=True,
        workers=4
    )

#uvicorn main:app --reload --host 127.0.0.1 --port 5005                                                                                                                            