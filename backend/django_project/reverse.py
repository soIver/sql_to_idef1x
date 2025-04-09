import urllib.parse
from PIL import Image
import logging

logger = logging.getLogger(__name__)

def extract_sql_from_png(image_path):
    try:
        logger.info(f"Извлечение SQL из PNG файла: {image_path}")
        image = Image.open(image_path)
        meta = image.info
        
        sql_encoded = meta.get("sql_query", "")
        if sql_encoded:
            sql_query = urllib.parse.unquote(sql_encoded)
            logger.info(f"SQL успешно извлечен из PNG")
            return sql_query
            
        logger.warning("SQL не найден в метаданных PNG файла")
        return ""
        
    except Exception as e:
        logger.error(f"Ошибка при извлечении SQL из PNG: {str(e)}")
        raise