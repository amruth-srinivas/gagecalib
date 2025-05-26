from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, gage
from routers import calibration
from routers import issue_log
from routers import label
from routers import calibration_measurements
from database import init_db, init_async_db
from config import get_settings

settings = get_settings()

app = FastAPI(
    title="Gage Calibration System API",
    description="API for managing gage calibration and inventory",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(gage.router, prefix="/api", tags=["Gage Inventory"])
app.include_router(calibration.router, prefix="/api", tags=["Calibration Records"])
app.include_router(issue_log.router, tags=["Issue Logs"])
app.include_router(label.router, prefix="/api", tags=["Labels"])
app.include_router(calibration_measurements.router, prefix="/api", tags=["Calibration Measurements"])

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    # Initialize both sync and async databases
    init_db()
    await init_async_db()

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