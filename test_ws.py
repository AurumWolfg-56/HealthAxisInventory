import asyncio
import websockets

async def test():
    try:
        async with websockets.connect(
            'ws://127.0.0.1:8765/v1/audio/transcriptions/stream',
            additional_headers={'Origin': 'https://healthaxis.hostinger.app'}
        ) as ws:
            print('Connected!')
    except Exception as e:
        print(f"Failed: {e}")

asyncio.run(test())
