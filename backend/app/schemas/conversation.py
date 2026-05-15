from datetime import datetime
from pydantic import BaseModel, Field


class ConversationBase(BaseModel):
    title: str = Field(default="New Conversation")


class ConversationCreate(ConversationBase):
    workspace_id: int


class ConversationUpdate(BaseModel):
    title: str


class ConversationRead(ConversationBase):
    id: int
    workspace_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
