import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def check_columns():
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env")
        return

    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        print("Checking columns of 'documents' table...")
        result = await conn.execute(
            text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'documents'
        """)
        )
        columns = [row[0] for row in result.fetchall()]
        print(f"Columns: {columns}")

        if "relative_path" in columns:
            print("SUCCESS: 'relative_path' column exists.")
        else:
            print("FAILURE: 'relative_path' column is MISSING.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_columns())
