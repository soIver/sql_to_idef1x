import requests, time, json
from decouple import config
from googletrans import Translator

gpt_key = config('GPT_KEY')

def get_ru_names_gpt(data: str) -> str:
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
    message = response.json().get('message')
    return message[7:-4]

def translate(data):
    translator = Translator()
    translated_data = []
    
    for item in data:
        name_ru = translator.translate(item['name'], src='en', dest='ru').text
        
        columns_ru = []
        for column in item['columns']:
            col_name_ru = translator.translate(column['name'], src='en', dest='ru').text
            columns_ru.append({'name': column['name'], 'name_ru': col_name_ru})
        
        foreign_keys_ru = []
        if 'foreign_keys' in item:
            for fk in item['foreign_keys']:
                label_text = f"{item['name']} to {fk['reference_table']}"
                label_ru = translator.translate(label_text, src='en', dest='ru').text
                foreign_keys_ru.append({
                    'reference_table': fk['reference_table'],
                    'label_ru': label_ru
                })
        
        translated_item = {
            'name': item['name'],
            'name_ru': name_ru,
            'columns': columns_ru
        }
        
        if foreign_keys_ru:
            translated_item['foreign_keys'] = foreign_keys_ru
            
        translated_data.append(translated_item)
    
    return {'message': json.dumps(translated_data, ensure_ascii=False)}