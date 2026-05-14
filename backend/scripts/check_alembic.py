import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def check_alembic_version():
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env")
        return

    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        print("Checking alembic_version...")
        try:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            versions = [row[0] for row in result.fetchall()]
            print(f"Current version(s): {versions}")
        except Exception as e:
            print(f"Error checking alembic_version: {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_alembic_version())
