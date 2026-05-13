from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal


async def get_db() -> AsyncSession:  # ty:ignore[invalid-return-type]
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
