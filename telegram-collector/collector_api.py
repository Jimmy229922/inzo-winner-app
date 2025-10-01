import os
import re
from dotenv import load_dotenv
from telethon.sync import TelegramClient
from telethon.errors import ChannelPrivateError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Load environment variables
load_dotenv()
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

# Initialize FastAPI app and Telegram client
app = FastAPI()
# The session file will be named after the PHONE_NUMBER, e.g., '+1234567890.session'
client = TelegramClient(PHONE_NUMBER, API_ID, API_HASH)

class PostRequest(BaseModel):
    postUrl: str

@app.on_event("startup")
async def startup_event():
    print("Connecting to Telegram...")
    await client.connect()
    if not await client.is_user_authorized():
        raise Exception("User is not authorized. Please run create_session.py again.")
    print("Telegram client connected and authorized.")

@app.on_event("shutdown")
async def shutdown_event():
    await client.disconnect()
    print("Telegram client disconnected.")

@app.post("/collect")
async def collect_answers(request: PostRequest):
    try:
        # Parse channel and message ID from URL
        match = re.search(r't\.me/(c/)?([\w_-]+)/(\d+)', request.postUrl)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid Telegram post URL format.")
        
        is_private_channel = match.group(1) is not None  # Check if 'c/' was present
        channel_identifier = match.group(2)
        message_id = int(match.group(3))

        # --- FIX: Handle private channel IDs ---
        # Telethon expects private channel IDs to be integers, prefixed with -100.
        if is_private_channel and channel_identifier.isdigit():
            channel_entity = int(f"-100{channel_identifier}")
        else:
            channel_entity = channel_identifier
        print(f"Collecting comments for post {message_id} in channel {channel_entity}...")

        collected_answers = []
        async for message in client.iter_messages(channel_entity, reply_to=message_id):
            if message.text and message.sender:
                author_name = f"{message.sender.first_name or ''} {message.sender.last_name or ''}".strip()
                account_id_match = re.search(r'\b\d{4,}\b', message.text)
                account_id = account_id_match.group(0) if account_id_match else None
                collected_answers.append({"author": author_name, "account_id": account_id, "text": message.text})
        
        print(f"Successfully collected {len(collected_answers)} comments.")
        return {"answers": collected_answers}

    except ChannelPrivateError:
        raise HTTPException(status_code=403, detail="Cannot access channel. Make sure you are a member and the channel is not private.")
    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))