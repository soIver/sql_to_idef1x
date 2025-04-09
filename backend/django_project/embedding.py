import tempfile
import logging
from PIL import Image, PngImagePlugin

logger = logging.getLogger(__name__)

def embed_metadata_to_png(png_path, sql_content, xml_content):
    try:
        logger.info(f"Начало встраивания метаданных в файл {png_path}")
        logger.info(f"Размер SQL: {len(sql_content)} символов")
        logger.info(f"Размер XML: {len(xml_content)} символов")
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_path = temp_file.name
        temp_file.close()
        
        logger.info(f"Создан временный файл: {temp_path}")
        
        try:
            with Image.open(png_path) as img:
                logger.info(f"Исходное изображение открыто: {img.format}, размер {img.size}")
                
                metadata = PngImagePlugin.PngInfo()
                
                if not sql_content:
                    logger.warning("SQL контент пуст")
                if not xml_content:
                    logger.warning("XML контент пуст")
                    
                logger.info(f"SQL контент: {sql_content[:100]}")
                logger.info(f"XML контент: {xml_content[:100]}")
                
                metadata.add_text('sql_query', sql_content)
                metadata.add_text('mxfile', xml_content)
                
                img.save(temp_path, 'PNG', pnginfo=metadata)
                logger.info(f"Изображение с метаданными сохранено в {temp_path}")
                
        except Exception as img_error:
            logger.error(f"Ошибка при обработке изображения: {str(img_error)}")
            raise
            
        return temp_path
    except Exception as e:
        logger.error(f"Ошибка при встраивании метаданных: {str(e)}")
        raise 