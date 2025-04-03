import os
import tempfile
import json
from pathlib import Path

import drawpyo
from drawpyo.diagram import object_from_library as Node, Edge as Edge, TextFormat
from collections import defaultdict, deque

def sort_vertices_by_degree(adj_matrix, n):
    degrees = [sum(row) for row in adj_matrix]
    visited = [False] * n
    result = []

    adjacency_list = defaultdict(list)
    for i in range(n):
        for j in range(n):
            if adj_matrix[i][j]:
                adjacency_list[i].append(j)

    while len(result) < n:
        max_degree = -1
        current_vertex = -1
        for i in range(n):
            if not visited[i] and degrees[i] > max_degree:
                max_degree = degrees[i]
                current_vertex = i

        result.append(current_vertex)
        visited[current_vertex] = True

        queue = deque([current_vertex])
        while queue:
            vertex = queue.popleft()
            neighbors = sorted(adjacency_list[vertex], key=lambda x: degrees[x], reverse=True)
            for neighbor in neighbors:
                if not visited[neighbor]:
                    result.append(neighbor)
                    visited[neighbor] = True
                    queue.append(neighbor)
    return result


class Visualizer:
    """
    Класс для генерации drawio-XML на основе структуры `data` (списка таблиц),
    без использования постоянного файла .drawio на диске.
    В конце `visualize()` возвращает XML-строку.
    """

    def __init__(self, data: list[dict]):
        """
        :param data: список словарей вида:
            [
              {
                "name": "table_name",
                "columns": [ ... ],
                "primary_keys": [ ... ],
                "foreign_keys": [ ... ]
              },
              ...
            ]
        """
        self.file = drawpyo.File()
        self.page = Page(self)
        self.file.add_page(self.page)
        self.data = data

        # Подгружаем библиотеку фигур (mylib.toml) из той же папки
        self.mylib = drawpyo.diagram.import_shape_database(
            Path(__file__).parent / "mylib.toml"
        )

    def visualize(self, translate: bool = False) -> str:
        """
        Основной метод визуализации: обходит self.data, строит сущности/связи
        и в конце сохраняет результат во временный файл .drawio, читая его в xml_str.

        :param translate: (необязательный) – если требуется логика перевода, можно включить.
        :return: Строка XML (.drawio) для дальнейшей передачи на фронтенд.
        """
        self.entities: dict[str, Entity] = {}
        self.relations: dict[str, Relation] = {}

        data = self.data
        blocks_cnt = len(data)
        adj_matrix: list[list[bool]] = [[False]*blocks_cnt for _ in range(blocks_cnt)]
        constraint_entities: dict[str, list[str]] = {}

        # --- Здесь может быть логика translate, если вам нужна. Оставляем заглушку ---
        # if translate:
        #     ... (ваш код)...

        # Распарсили таблицы, создаём объекты Entity/Relation
        entity_names = []
        for entity_index, block in enumerate(data):
            entity_width, entity_height = 200, 60
            entity_name = block.get('name')
            entity_name_ru = block.get('name_ru', entity_name)
            entity_names.append(entity_name)

            # Создаём объект Entity
            self.entities[entity_name] = Entity(entity_name_ru, entity_width, entity_height, self.page)

            # Собираем первичные/внешние ключи
            pks = {}
            for pk in block.get('primary_keys', []):
                for col in pk.get('columns', []):
                    pks[col] = True

            fks = {}
            for fk in block.get('foreign_keys', []):
                self.entities[entity_name].is_dependent = True
                for col in fk.get('columns', []):
                    fks[col] = True

                referring_entity_name = entity_name
                reference_entity_name = fk.get('references', {}).get('table')
                # Ищем индекс таблицы, на которую есть ссылка
                ref_index = -1
                for i, other_block in enumerate(data):
                    if other_block.get('name') == reference_entity_name:
                        ref_index = i
                        break

                constr_name = fk.get('constraint_name', 'fk_unnamed')
                constraint_entities[constr_name] = [referring_entity_name, reference_entity_name]
                self.entities[referring_entity_name].add_constraint(constr_name)
                self.entities[reference_entity_name].add_constraint(constr_name)

                # Заполняем матрицу смежности
                adj_matrix[entity_index][ref_index] = True
                adj_matrix[ref_index][entity_index] = True

                # label_ru, column, references.column
                label = fk.get('label_ru', 'включает')
                self.relations[constr_name] = Relation(
                    label=label,
                    referring_entity_name=referring_entity_name,
                    reference_entity_name=reference_entity_name,
                    reffering_column_name=fk.get('column'),
                    reference_column_name=fk.get('references', {}).get('column'),
                    page=self.page
                )

            # Добавляем колонки
            for column in block.get('columns', []):
                col_name = column.get('name')
                col_name_ru = column.get('name_ru', col_name)
                primary = pks.get(col_name, False)
                foreign = fks.get(col_name, False)
                self.entities[entity_name].add_column(col_name_ru, primary, foreign)

        # Расставляем координаты
        x_interval = 120
        y_interval = 60
        x = 0
        y = 0
        sides_priority = ('bottom', 'right', 'top', 'left')

        order = sort_vertices_by_degree(adj_matrix, blocks_cnt)
        for i in order:
            center_entity_name = entity_names[i]
            center_entity = self.entities.get(center_entity_name)
            if not center_entity:
                continue

            constraints = center_entity.constraints
            if center_entity.object is None:
                center_entity.implement(x, y)

            for constraint in constraints:
                related_list = constraint_entities[constraint]
                # related_list = [referring, reference]
                # Удаляем из списка текущее имя
                other_entity_name = [nm for nm in related_list if nm != center_entity_name][0]
                other_entity = self.entities.get(other_entity_name)
                if not other_entity:
                    continue
                if constraint in other_entity.constraints:
                    other_entity.constraints.remove(constraint)

                # Ищем первую свободную сторону
                side_to_use = None
                for side in sides_priority:
                    if not center_entity.sides[side]:
                        side_to_use = side
                        center_entity.sides[side] = True
                        opposite_side = sides_priority[sides_priority.index(side) - 2]
                        other_entity.sides[opposite_side] = True
                        break
                if not side_to_use:
                    side_to_use = 'right'  # fallback

                match side_to_use:
                    case 'bottom':
                        x = center_entity.x
                        y = center_entity.y + center_entity.height + y_interval
                        entries = (0.5, 1)
                    case 'right':
                        x = center_entity.x + center_entity.width + x_interval
                        y = center_entity.y
                        entries = (1, 0.5)
                    case 'top':
                        x = center_entity.x
                        y = center_entity.y - center_entity.height - y_interval
                        entries = (0.5, 0)
                    case 'left':
                        x = center_entity.x - center_entity.width - x_interval
                        y = center_entity.y
                        entries = (0, 0.5)
                    case _:
                        # default
                        x = center_entity.x + center_entity.width + x_interval
                        y = center_entity.y
                        entries = (1, 0.5)

                if other_entity.object is None:
                    other_entity.implement(x, y)

                from_child = (constraint_entities[constraint].index(center_entity_name) == 0)
                self.relations[constraint].implement(self.entities, entries, from_child)


        return self.file.xml


class Page(drawpyo.Page):
    def __init__(self, translator: Visualizer, file=None, **kwargs):
        super().__init__(file, **kwargs)
        self.translator = translator

    def add_node(
        self, node_type: str, text: str,
        x: int = 0, y: int = 0,
        width: int = 200, height: int = 30,
        rounded: bool = False, parent=None
    ):
        node = Node(
            page=self,
            library=self.translator.mylib,
            obj_name=node_type,
            value=text,
            position=(x, y),
            height=height,
            width=width
        )
        if parent is not None:
            node.parent = parent
        node.rounded = rounded
        self.add_object(node)
        return node

    def add_edge(
        self, source: Node, target: Node,
        label: str, dashed: bool, entries: tuple[float]
    ):
        if label:
            edge = Edge(source=source, target=target, label=label, label_position=0, label_offset=20)
        else:
            edge = Edge(source=source, target=target)

        if dashed:
            edge.pattern = 'dashed_small'

        edge.entryX = entries[0]
        edge.entryY = entries[1]
        edge.endArrow = 'oval'
        edge.endFill_target = True
        edge.endSize = 10
        edge.strokeWidth = 2
        edge.startArrow = 'none'
        edge.text_format = TextFormat(bold=True)

        self.add_object(edge)
        return edge


class Entity:
    def __init__(self, name: str, start_width: int, start_height: int, page: Page):
        self.name = name
        self.page = page
        self.width = start_width
        self.height = start_height
        self.x = 0
        self.y = 0
        self.is_dependent = False
        self.object = None
        self.columns: list[dict[str, bool | str]] = []
        self.constraints: list[str] = []
        # Признаки занятости сторон (чтобы не накладывать связи друг на друга):
        self.sides = {'left': False, 'right': False, 'top': False, 'bottom': False}

    def add_constraint(self, constraint_name: str):
        self.constraints.append(constraint_name)

    def add_column(self, col_name: str, primary: bool, foreign: bool):
        self.columns.append({'name': col_name, 'primary': primary, 'foreign': foreign})
        self.height += 30
        self.width = max(self.width, len(col_name) * 7)

    def implement(self, x: int, y: int):
        self.x = x
        self.y = y
        # Верхний "текстовый" узел (имя сущности)
        self.label = self.page.add_node('text', self.name, self.x, self.y, self.width)
        # Область, где колонки
        y_offset = 30
        x_offset = 0
        self.object = self.page.add_node(
            'entity', '',
            x_offset, y_offset,
            self.width,
            rounded=self.is_dependent,
            parent=self.label
        )

        # Сортируем колонки так, чтобы PrimaryKey шли первыми
        self.columns.sort(key=lambda c: not c['primary'])

        cur_y = y_offset
        for column in self.columns:
            col_text = column['name']
            if column['foreign']:
                col_text += ' (FK)'

            if column['primary']:
                # Первичный ключ пишем в "title" (self.object.value) через <br>
                if self.object.value:
                    col_text = '<br><br>' + col_text
                    start_size = int(self.object._getattribute__('startSize')) + 30
                    self.object._add_and_set_style_attrib('startSize', start_size)
                    cur_y += 30
                    self.object.height += 30
                self.object.value += col_text
            else:
                # Обычная колонка
                cur_y += 30
                self.object.height += 30
                self.page.add_node('entity_column', col_text, x_offset, cur_y, self.width, parent=self.object)

        # Если все колонки оказались первичными, дополнительно увеличим высоту (пример)
        if all(c['primary'] for c in self.columns):
            self.object.height += 30


class Relation:
    def __init__(
        self,
        label: str,
        referring_entity_name: str,
        reference_entity_name: str,
        reffering_column_name: str,
        reference_column_name: str,
        page: Page
    ):
        self.referring_entity_name = referring_entity_name
        self.reference_entity_name = reference_entity_name
        self.referring_column_name = reffering_column_name
        self.reference_column_name = reference_column_name
        self.page = page
        self.label = label

    def implement(self, entities: dict[str, Entity], entries: tuple[float, float], from_child: bool):
        """
        :param from_child: True, если текущая (center_entity) – child, иначе parent
        """
        if from_child:
            reference_obj = entities[self.referring_entity_name].object
            referring_ent = entities[self.reference_entity_name]
        else:
            reference_obj = entities[self.reference_entity_name].object
            referring_ent = entities[self.referring_entity_name]

        # Если связь снизу (0.5, 1), возможно хотим крепить её к label
        if entries == (0.5, 1):
            referring_obj = referring_ent.label
        else:
            referring_obj = referring_ent.object

        # Определяем, dashed ли связь
        dashed = True
        not_dashed_cnt = 0

        for col in entities[self.referring_entity_name].columns:
            if col['name'] == self.referring_column_name:
                not_dashed_cnt += 1
                break
        for col in entities[self.reference_entity_name].columns:
            if col['name'] == self.referring_column_name:
                not_dashed_cnt += 1
                break

        if not_dashed_cnt == 2:
            dashed = False

        # Добавляем линию
        self.object = self.page.add_edge(
            source=referring_obj,
            target=reference_obj,
            label=self.label,
            dashed=dashed,
            entries=entries
        )
