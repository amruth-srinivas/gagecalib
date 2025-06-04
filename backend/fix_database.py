import psycopg2
from config import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_database():
    settings = get_settings()
    try:
        # Connect to the database
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()
        
        # Read and execute the SQL script
        with open('fix_database.sql', 'r') as file:
            sql_script = file.read()
            cur.execute(sql_script)
        
        # Commit the changes
        conn.commit()
        logger.info("Database structure updated successfully")
        
    except Exception as e:
        logger.error(f"Error fixing database: {str(e)}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    fix_database() 