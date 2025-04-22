import logging, urllib.parse
import io
import datetime
from PIL import Image, PngImagePlugin

logger = logging.getLogger(__name__)

def embed_metadata_to_png(png_blob: bytes, sql_content: str, xml_content: str) -> bytes:
    """
    Встраивает метаданные в PNG файл, переданный как бинарные данные
    
    Args:
        png_blob: Бинарные данные PNG файла (bytes)
        sql_content: SQL-запрос для встраивания
        xml_content: XML-содержимое для встраивания
    
    Returns:
        Бинарные данные PNG файла с внедренными метаданными
    
    Raises:
        ValueError: Если входные данные некорректны
        IOError: Если произошла ошибка обработки изображения
    """
    try:
        logger.info("Начало встраивания метаданных в PNG из blob-данных")
        logger.info(f"Размер PNG данных: {len(png_blob)} байт")
        logger.info(f"Размер SQL: {len(sql_content)} символов")
        logger.info(f"Размер XML: {len(xml_content)} символов")
        
        try:
            # Открываем изображение из blob-данных
            with Image.open(io.BytesIO(png_blob)) as img:
                logger.info(f"Исходное изображение открыто: {img.format}, размер {img.size}")
                
                # Проверяем, что это действительно PNG
                if img.format != 'PNG':
                    raise ValueError("Поддерживаются только PNG файлы")
                
                # Создаем метаданные
                metadata = PngImagePlugin.PngInfo()
                
                # Валидация входных данных
                if not isinstance(sql_content, str):
                    raise ValueError("SQL контент должен быть строкой")
                if not isinstance(xml_content, str):
                    raise ValueError("XML контент должен быть строкой")
                
                if not sql_content.strip():
                    logger.warning("SQL контент пуст или содержит только пробелы")
                if not xml_content.strip():
                    logger.warning("XML контент пуст или содержит только пробелы")
                
                # Кодируем SQL и XML с помощью urllib.parse.quote
                sql_encoded = urllib.parse.quote(sql_content)
                xml_encoded = urllib.parse.quote(xml_content)
                
                # Добавляем закодированные метаданные
                metadata.add_text('sql_query', sql_encoded)
                metadata.add_text('mxfile', xml_encoded)
                
                # Сохраняем в буфер памяти
                output = io.BytesIO()
                img.save(output, 'PNG', pnginfo=metadata)
                output.seek(0)
                logger.info(f"Изображение с метаданными успешно сохранено в буфер")
                
                return output.getvalue()
                
        except Exception as img_error:
            logger.error(f"Ошибка при обработке изображения: {str(img_error)}")
            raise
            
    except Exception as e:
        logger.error(f"Критическая ошибка при встраивании метаданных: {str(e)}")
        raise