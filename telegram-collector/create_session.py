import os
from dotenv import load_dotenv
from telethon.sync import TelegramClient

load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

# سيتم إنشاء ملف باسم phone_number.session
client = TelegramClient(PHONE_NUMBER, API_ID, API_HASH)

async def main():
    await client.start(PHONE_NUMBER)
    print("Session file created successfully!")
    me = await client.get_me()
    print(f"Logged in as: {me.first_name}")

if __name__ == "__main__":
    with client:
        client.loop.run_until_complete(main())