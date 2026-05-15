import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()


async def create_db():
    # Parse the database URL to get the base connection (to 'postgres' db)
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    # Example: postgresql+asyncpg://postgres:namlepaylak@localhost:5433/prismrag
    # We need to connect to 'postgres' to create 'prismrag'
    base_url = db_url.rsplit("/", 1)[0] + "/postgres"
    db_name = db_url.rsplit("/", 1)[1]

    print(f"Connecting to {base_url} to create database '{db_name}'...")

    # Use asyncpg directly for CREATE DATABASE as it can't be run in a transaction
    conn_params = base_url.replace("postgresql+asyncpg://", "")
    user_pass, host_port_db = conn_params.split("@")
    user, password = user_pass.split(":")
    host_port, _ = host_port_db.split("/")
    host, port = host_port.split(":")

    try:
        conn = await asyncpg.connect(
            user=user, password=password, host=host, port=int(port), database="postgres"
        )
        try:
            await conn.execute(f"CREATE DATABASE {db_name}")
            print(f"Database '{db_name}' created successfully.")
        except asyncpg.exceptions.DuplicateDatabaseError:
            print(f"Database '{db_name}' already exists.")
        finally:
            await conn.close()
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(create_db())
