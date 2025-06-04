from sqlalchemy import create_engine, text
from config import get_settings

def add_notification_columns():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE calibration_records 
            ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notification_sent_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS notification_read BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notification_read_date TIMESTAMP;
        """))
        conn.commit()

if __name__ == "__main__":
    add_notification_columns() 