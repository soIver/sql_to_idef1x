import drawpyo, json
from drawpyo.diagram import object_from_library as Node, Edge as Edge, TextFormat
from .translation import *

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

class Visualizer():
    def __init__(self, json_data: str):
        self.page = Page(self)
        self.file = drawpyo.File()
        self.file.add_page(self.page)
        self.mylib = drawpyo.diagram.import_shape_database("django_project/mylib.toml")
        self.json_data = json_data

    def visualize(self, translate: bool = False):
        self.entities: dict[str, Entity] = {}
        self.relations: dict[str, Relation] = {}
        data: list[dict] = self.json_data
        blocks_cnt = len(data)
        adj_matrix: list[list[bool]] = [[0 for x in range(blocks_cnt)] for y in range(blocks_cnt)]
        constraint_entities: dict[str, list[str]] = {} # имена отношений по именам ограничений
        data_for_translate: list[dict] = []
        
        if translate:
            # генерация и вставка в исходную структуру названий объектов на русском языке
            for block in data:
                data_for_translate.append({
                    'name': block.get('name'),
                    'name_ru': '',
                    'columns': [],
                    'foreign_keys': []
                })
                for column in block.get('columns'):
                    data_for_translate[-1]['columns'].append({
                        'name': column.get('name'),
                        'name_ru': ''
                    })
                for fk in block.get('foreign_keys'):
                    data_for_translate[-1]['foreign_keys'].append({
                        'reference_table': fk.get('references').get('table'),
                        'label_ru': ''
                    })
                if len(data_for_translate[-1].get('foreign_keys')) == 0:
                    data_for_translate[-1].pop('foreign_keys')

            api_response = get_ru_names_gpt(data_for_translate)
            print(api_response)

            translated_data: list[dict[str, str | list[dict[str, str]]]] = json.loads(api_response)
            # меняем исходные имена на сгенерированные
            for i in range(len(data)):
                data[i]['name_ru'] = translated_data[i].get('name_ru')
                columns = data[i].get('columns')
                columns_ru = translated_data[i].get('columns')
                for j in range(len(columns)):
                    columns[j]['name_ru'] = columns_ru[j].get('name_ru')
                foreign_keys = data[i].get('foreign_keys')
                foreign_keys_ru = translated_data[i].get('foreign_keys')
                for k in range(len(foreign_keys)):
                    foreign_keys[k]['label_ru'] = foreign_keys_ru[k]['label_ru']

        entity_names = []
        for entity_index, block in enumerate(data):
            # создание экземпляра отношения
            entity_width, entity_height = 200, 60
            entity_name = block.get('name')
            entity_name_ru = block.get('name_ru', entity_name)
            entity_names.append(entity_name)
            self.entities[entity_name] = Entity(entity_name_ru, entity_width, entity_height, self.page)

            # учёт первичных и внешних ключей
            pks: dict[str, bool] = {}
            fks: dict[str, bool] = {}
            for pk in block.get('primary_keys'):
                for column in pk.get('columns'):
                    pks[column] = True

            for fk in block.get('foreign_keys'):
                self.entities.get(entity_name).is_dependent = True
                for column in fk.get('columns'):
                    fks[column] = True
                referring_entity_name = entity_name
                reference_entity_name = fk.get('references').get('table')
                i = -1
                for block_ in data:
                    i += 1
                    if block_.get('name') == reference_entity_name:
                        reference_entity_index = i
                        break
                constr_name = fk.get('constraint_name')
                constraint_entities[constr_name] = [referring_entity_name, reference_entity_name]
                self.entities[referring_entity_name].add_constraint(constr_name)
                self.entities[reference_entity_name].add_constraint(constr_name)
                label = fk.get('label_ru', 'включает')

                adj_matrix[entity_index][reference_entity_index] = 1
                adj_matrix[reference_entity_index][entity_index] = 1

                self.relations[constr_name] = Relation(label, referring_entity_name, reference_entity_name, fk.get('column'), fk.get('references').get('column'), self.page)

            # добавление атрибутов в экземпляры отношений
            for column in block.get('columns'):
                col_name = column.get('name')
                col_name_ru = column.get('name_ru', col_name)
                primary = pks.get(col_name, False)
                foreign = fks.get(col_name, False)
                self.entities.get(entity_name).add_column(col_name_ru, primary, foreign)

        # Третий проход: размещаем сущности и создаем связи
        x_interval = 300  # Увеличим интервалы для лучшего распределения
        y_interval = 200
        x = 0
        y = 0
        sides_priority: tuple[str] = ('right', 'left', 'bottom', 'top')  # Приоритет горизонтальных связей
        order = sort_vertices_by_degree(adj_matrix, blocks_cnt)
        
        # Создаем сетку для размещения сущностей
        grid_size = int(len(order) ** 0.5) + 1
        grid = [[None for _ in range(grid_size)] for _ in range(grid_size)]
        current_row = 0
        current_col = 0
        
        # Размещаем первую сущность в центре
        center_row = grid_size // 2
        center_col = grid_size // 2
        center_entity_name = entity_names[order[0]]
        center_entity = self.entities.get(center_entity_name)
        x = center_col * x_interval
        y = center_row * y_interval
        center_entity.implement(x, y)
        grid[center_row][center_col] = center_entity_name
        
        # Функция для поиска ближайшей свободной ячейки
        def find_nearest_free_cell(grid, entity_row, entity_col):
            min_distance = float('inf')
            best_pos = None
            for i in range(len(grid)):
                for j in range(len(grid[0])):
                    if grid[i][j] is None:
                        distance = abs(i - entity_row) + abs(j - entity_col)
                        if distance < min_distance:
                            min_distance = distance
                            best_pos = (i, j)
            return best_pos
        
        # Размещаем остальные сущности
        for i in range(1, len(order)):
            entity_name = entity_names[order[i]]
            entity = self.entities.get(entity_name)
            
            # Находим связанные уже размещенные сущности
            connected_positions = []
            for row in range(grid_size):
                for col in range(grid_size):
                    if grid[row][col] is not None:
                        placed_entity = grid[row][col]
                        if adj_matrix[order[i]][entity_names.index(placed_entity)]:
                            connected_positions.append((row, col))
            
            # Если есть связанные сущности, размещаем рядом с ними
            if connected_positions:
                # Вычисляем среднюю позицию связанных сущностей
                avg_row = sum(pos[0] for pos in connected_positions) / len(connected_positions)
                avg_col = sum(pos[1] for pos in connected_positions) / len(connected_positions)
                # Находим ближайшую свободную ячейку к средней позиции
                pos = find_nearest_free_cell(grid, int(avg_row), int(avg_col))
                if pos:
                    row, col = pos
                    x = col * x_interval
                    y = row * y_interval
                    entity.implement(x, y)
                    grid[row][col] = entity_name
            
            # Если нет связанных сущностей, размещаем в следующей свободной ячейке
            if entity.object is None:
                pos = find_nearest_free_cell(grid, center_row, center_col)
                if pos:
                    row, col = pos
                    x = col * x_interval
                    y = row * y_interval
                    entity.implement(x, y)
                    grid[row][col] = entity_name
        
        # Создаем связи с учетом расположения сущностей
        processed_constraints = set()
        for i in order:
            center_entity_name = entity_names[i]
            center_entity = self.entities.get(center_entity_name)
            constraints = center_entity.constraints.copy()
            
            for constraint in constraints:
                if constraint in processed_constraints:
                    continue
                    
                processed_constraints.add(constraint)
                related_entity_name = constraint_entities[constraint].copy()
                related_entity_name.remove(center_entity_name)
                related_entity_name = related_entity_name[0]
                related_entity = self.entities.get(related_entity_name)
                
                # Определяем лучшую сторону для подключения на основе взаимного расположения
                dx = related_entity.x - center_entity.x
                dy = related_entity.y - center_entity.y
                
                if abs(dx) > abs(dy):
                    # Горизонтальная связь
                    if dx > 0:
                        primary_sides = ['right', 'top', 'bottom', 'left']
                        opposite_sides = ['left', 'top', 'bottom', 'right']
                    else:
                        primary_sides = ['left', 'top', 'bottom', 'right']
                        opposite_sides = ['right', 'top', 'bottom', 'left']
                else:
                    # Вертикальная связь
                    if dy > 0:
                        primary_sides = ['bottom', 'right', 'left', 'top']
                        opposite_sides = ['top', 'right', 'left', 'bottom']
                    else:
                        primary_sides = ['top', 'right', 'left', 'bottom']
                        opposite_sides = ['bottom', 'right', 'left', 'top']
                
                # Пытаемся найти доступные точки подключения
                connection_found = False
                for side, opposite_side in zip(primary_sides, opposite_sides):
                    center_point = center_entity.get_available_connection_point(side)
                    if center_point is None:
                        continue
                        
                    opposite_point = related_entity.get_available_connection_point(opposite_side)
                    if opposite_point is not None:
                        connection_found = True
                        break
                
                if not connection_found:
                    continue
                
                from_child = constraint_entities.get(constraint).index(center_entity_name) == 0
                self.relations.get(constraint).implement(self.entities, (center_point, opposite_point), from_child)
        return self.file.xml

    def export(self):
        pass
        return self.file.xml

class Page(drawpyo.Page):
    def __init__(self, translator: Visualizer, file=None, **kwargs):
        super().__init__(file, **kwargs)
        self.translator = translator
        
    def add_node(self, node_type: str, text: str, x: int = 0, y: int = 0, width: int = 200, height: int = 30, rounded: bool = False, parent = None):
        node = Node(
        page = self,
        library = self.translator.mylib,
        obj_name = node_type,
        value = text,
        position = (x, y),
        height = height,
        width = width
        )
        if not parent is None:
            node.parent = parent
        node.rounded = rounded
        self.add_object(node)
        return node
    
    def add_edge(self, source: Node, target: Node, label: str, dashed: bool, entries: tuple[tuple[float]]):
        if label:
            edge = Edge(source=source, target=target, label=label, label_position=0, label_offset = 20)
        else:
            edge = Edge(source=source, target=target)
        if dashed:
            edge.pattern = 'dashed_small'
        
        edge.entryX = entries[0][0]
        edge.entryY = entries[0][1]
        edge.exitX = entries[1][0]
        edge.exitY = entries[1][1]
        edge.endArrow = 'oval'
        edge.endFill_target = True
        edge.endSize = 10
        edge.strokeWidth = 2
        edge.startArrow = 'none'
        edge.text_format = TextFormat(bold = True)

        self.add_object(edge)
        return edge

class Entity():
    def __init__(self, name: str, start_width: int, start_height: int, page: Page):
        self.name = name
        self.page = page
        self.width = start_width
        self.height = start_height
        self.x = 0
        self.y = 0
        self.is_dependent = False
        self.object = None
        self.columns: list[dict[str, str | bool]] = []
        self.constraints: list[str] = []
        self.sides = {
            'left': [],  # список занятых точек слева
            'right': [], # список занятых точек справа
            'top': False, # сверху и снизу оставляем по одной точке
            'bottom': False
        }
        self.connection_points = {
            'left': 0,   # количество доступных точек слева
            'right': 0,  # количество доступных точек справа
            'top': 1,    # по одной точке сверху и снизу
            'bottom': 1
        }

    def add_constraint(self, constraint_name):
        self.constraints.append(constraint_name)

    def add_column(self, col_name: str, primary: bool, foreign: bool):
        self.columns.append({'name': col_name, 'primary': primary, 'foreign': foreign})
        self.height += 30
        self.width = max(self.width, len(col_name) * 7)
        # Увеличиваем количество точек подключения на правой и левой сторонах
        self.connection_points['left'] = len(self.columns)
        self.connection_points['right'] = len(self.columns)

    def get_available_connection_point(self, side: str) -> tuple[float]:
        if side in ['top', 'bottom']:
            if self.sides[side]:
                return None
            self.sides[side] = True
            return (0.5, 1 if side == 'bottom' else 0)
        # Для левой и правой сторон
        available_points = self.connection_points[side]
        used_points = len(self.sides[side])
        
        if used_points >= available_points:
            return None
            
        # Вычисляем позицию точки подключения
        point_index = used_points
        total_points = available_points
        if total_points == 1:
            y_pos = 0.5
        else:
            y_pos = (point_index + 1) / (total_points + 1)
            
        self.sides[side].append(point_index)
        return (1 if side == 'right' else 0, y_pos)

    def implement(self, x: int, y: int):
        self.x = x
        self.y = y
        self.label = self.page.add_node('text', self.name, self.x, self.y, self.width)
        y = 30
        x = 0
        self.object = self.page.add_node('entity', '', x, y, self.width, rounded = self.is_dependent, parent = self.label)
        self.columns.sort(key=lambda x: not x['primary'])
        for column in self.columns:
            name = column.get('name')
            primary = column.get('primary')
            foreign = column.get('foreign')
            if foreign:
                name += ' (FK)'
            if primary:
                name = '&nbsp;' + name
                if self.object.value:
                    name = '<br><br>' + name
                    start_size = int(self.object.__getattribute__('startSize')) + 30
                    self.object._add_and_set_style_attrib('startSize', start_size)
                    y += 30
                    self.object.height += 30
                self.object.value += name
            else:
                self.page.add_node('entity_column', name, x, y, self.width, parent = self.object)
                y += 30
                self.object.height += 30

        # если все атрибуты в составе первичного ключа - добавляем пространство
        if all(column.get('primary') for column in self.columns):
            self.object.height += 30
                
class Relation():
    def __init__(self, label: str, referring_entity_name: str, reference_entity_name: str, reffering_column_name: str, reference_column_name: str, page: Page):
        self.referring_entity_name = referring_entity_name
        self.reference_entity_name = reference_entity_name
        self.referring_column_name = reffering_column_name
        self.reference_column_name = reference_column_name
        self.page = page
        self.label = label

    def implement(self, entities: dict[str, Entity], connection_points: tuple[tuple[float]], from_child: bool):
        # Определяем, какая сущность является зависимой (child)
        child_entity = entities.get(self.referring_entity_name)  # referring_entity_name всегда зависимая
        parent_entity = entities.get(self.reference_entity_name)  # reference_entity_name всегда независимая
        
        # Определяем относительное положение сущностей
        dx = parent_entity.x - child_entity.x
        dy = parent_entity.y - child_entity.y
        
        # Определяем новые точки подключения на основе относительного положения
        if abs(dx) > abs(dy):
            # Горизонтальное расположение
            if dx > 0:
                # Родитель справа от ребенка
                child_point = child_entity.get_available_connection_point('right')
                parent_point = parent_entity.get_available_connection_point('left')
            else:
                # Родитель слева от ребенка
                child_point = child_entity.get_available_connection_point('right')
                parent_point = parent_entity.get_available_connection_point('left')
        else:
            # Вертикальное расположение
            if dy > 0:
                # Родитель ниже ребенка
                child_point = child_entity.get_available_connection_point('bottom')
                parent_point = parent_entity.get_available_connection_point('top')
            else:
                # Родитель выше ребенка
                child_point = child_entity.get_available_connection_point('top')
                parent_point = parent_entity.get_available_connection_point('bottom')
        
        # Если не удалось получить точки подключения, используем исходные
        if child_point is None or parent_point is None:
            child_point = connection_points[0]
            parent_point = connection_points[1]
        
        # Определяем, должна ли связь быть пунктирной
        dashed = True
        for column in child_entity.columns:
            if column.get('name') == self.referring_column_name and column.get('primary'):
                dashed = False
                break
        
        # Создаем связь от зависимой сущности к независимой
        self.object = self.page.add_edge(parent_entity.object, child_entity.object, self.label, dashed, (parent_point, child_point))