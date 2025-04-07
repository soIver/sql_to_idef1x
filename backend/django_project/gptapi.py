import requests, time
from decouple import config

gpt_key = config('GPT_KEY')

def get_ru_names(data: str) -> str:
    current_time = time.strftime("%Y%m%d-%H%M%S")
    url = 'https://gptunnel.ru/v1/assistant/chat'
    headers = {
        'Authorization': str(gpt_key)
    }
    data = {
        'chatId': f'translate-{current_time}',
        'assistantCode': 'ideftranslator',
        'message': f'{data}'
    }
    response = requests.post(headers=headers, url=url, data=data)
    return response.json()