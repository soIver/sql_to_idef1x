import json
import re
from pathlib import Path

import sqlglot
from sqlglot.expressions import Create, ColumnDef, ForeignKey, Alter, Drop, AlterColumn, RenameColumn, AlterRename, \
    AddConstraint, Reference, Constraint, PrimaryKey, PrimaryKeyColumnConstraint, Command

constraint_counter = 1

def split_sql_queries(query):
    """
    Разбивает SQL-запрос на отдельные запросы по разделителю ";".
    Учитывает, что точка с запятой может быть внутри строк или комментариев.
    """
    # Удаляем комментарии (однострочные и многострочные)
    query = re.sub(r'--.*?\n', '', query)  # Однострочные комментарии
    query = re.sub(r'/\*.*?\*/', '', query, flags=re.DOTALL)  # Многострочные комментарии

    # Разбиваем запрос на отдельные выражения по ";"
    queries = []
    current_query = ""
    in_string = False
    string_char = None  # Тип кавычек: ' или "

    for char in query:
        if char in ("'", '"') and not in_string:
            in_string = True
            string_char = char
        elif char == string_char and in_string:
            in_string = False
            string_char = None

        current_query += char

        if char == ";" and not in_string:
            queries.append(current_query.strip())
            current_query = ""

    # Добавляем последний запрос, если он есть
    if current_query.strip():
        queries.append(current_query.strip())

    return queries


def detect_dialect(query):
    """
    Определяет диалект SQL (MySQL, PostgreSQL, SQL Server) путем перебора
    """
    dialects = ["mysql", "postgres", ""]  # список диалектов

    for dialect in dialects:
        try:
            parsed = sqlglot.parse(query, dialect=dialect)
            if parsed and not any(isinstance(stmt, sqlglot.expressions.Command) for stmt in parsed):
                print(f"Detected dialect: {dialect}")
                return dialect
        except Exception as e:

            print(f"failed to parse with dialect {dialect}: {e}")
            continue

    return "postgres"


def generate_constraint_name(table_name, column_name, referenced_table=None, constraint_type="FK", dialect="postgres"):
    global constraint_counter  # Используем глобальную переменную
    table_name = table_name.lower()
    if dialect not in ["postgres", "mysql"]:
        return None

    if isinstance(column_name, list):
        column_name = "_".join(column_name).lower()
    elif isinstance(column_name, str):
        column_name = column_name.lower()


    if dialect == "mysql":
        if constraint_type == "PK":
            return "PRIMARY"
        elif constraint_type == "FK":
            constraint_name = f"{table_name}_ibfk_{constraint_counter}"
            constraint_counter += 1
            return constraint_name
    elif dialect == "postgres":
        if constraint_type == "PK":
            return f"{table_name}_pkey"
        elif constraint_type == "FK":
            return f"{table_name}_{column_name}_fkey"
    else:
        return None


def parse_sql(query, tables_data):
    """
    parses the SQL query and extracts relevant information for IDEF1X
    """
    try:
        dialect = detect_dialect(query)
        parsed_queries = sqlglot.parse(query, dialect=dialect)
        if not parsed_queries:
            print("Warning: No queries were parsed. Check your SQL syntax.")
            return []

        for parsed in parsed_queries:
            print(f"parsed object: {parsed}")  # отладка

            if isinstance(parsed, Create):
                table_name = parsed.this.this.name if parsed.this and parsed.this.this else "<unknown>"

                # Проверка существования таблицы
                if any(table["name"] == table_name for table in tables_data):
                    print(f"Table {table_name} already exists. Skipping creation.")
                    continue

                table_info = {"name": table_name, "columns": [], "primary_keys": [], "foreign_keys": []}
                parsed_expressions = parsed.args.get("expressions", [])
                if not parsed_expressions:
                    parsed_expressions = parsed.this.args.get("expressions", [])

                for expression in parsed_expressions:
                    if isinstance(expression, ColumnDef):
                        # Извлечение данных о колонке
                        column_name = expression.this.name
                        if any(col["name"] == column_name for col in table_info["columns"]):
                            print(f"Column {column_name} already exists in table {table_name}. Skipping creation.")
                            continue

                        column_type = expression.kind.sql()
                        constraints = expression.constraints
                        for constraint in constraints:
                            if isinstance(constraint.kind, PrimaryKeyColumnConstraint):
                                # Обработка первичного ключа на уровне колонки
                                constraint_name = generate_constraint_name(table_name, column_name, None, "PK", dialect)
                                pk_info = {
                                    "columns": [column_name],
                                    "constraint_name": constraint_name
                                }
                                # Проверяем, существует ли уже такой первичный ключ
                                if not any(pk["columns"] == pk_info["columns"] for pk in table_info["primary_keys"]):
                                    table_info["primary_keys"].append(pk_info)
                            elif isinstance(constraint.kind, Reference):
                                # Обработка внешнего ключа на уровне колонки
                                reference = constraint.kind.this

                                if reference and reference.this and reference.expressions:
                                    check_cascade_delete = constraint.kind.args.get("options")
                                    referenced_table = reference.this.this.name if reference.this.this else "<unknown>"
                                    referenced_table_exists = any(
                                        table["name"] == referenced_table for table in tables_data)
                                    if not referenced_table_exists:
                                        print(
                                            f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                        continue
                                    referenced_column = reference.expressions[
                                        0].name if reference.expressions else "<unknown>"
                                    constraint_name = generate_constraint_name(table_name, column_name,
                                                                               referenced_table, "FK", dialect)
                                    cascade_del = True if "ON DELETE CASCADE" in check_cascade_delete else False
                                    fk_info = {
                                        "columns": [column_name],
                                        "references": {
                                            "table": referenced_table,
                                            "columns": [referenced_column]
                                        },
                                        "constraint_name": constraint_name,
                                        "cascade": cascade_del
                                    }
                                    # Проверяем, существует ли уже такой внешний ключ
                                    referenced_table_info = next(
                                        (table for table in tables_data if table["name"] == referenced_table), None)

                                    referenced_column_types = {col["name"]: col["type"] for col in
                                                               referenced_table_info["columns"]}
                                    ref_column_type = referenced_column_types.get(referenced_column)

                                    if column_type != ref_column_type:
                                        print(
                                            f"Cannot add FOREIGN KEY: type mismatch between {table_name}.{column_name} ({column_type}) "
                                            f"and {referenced_table}.{referenced_column} ({ref_column_type}).")
                                        continue
                                    if not any(
                                            fk["columns"] == fk_info["columns"] for fk in table_info["foreign_keys"]):
                                        table_info["foreign_keys"].append(fk_info)

                        column_info = {
                            "name": column_name,
                            "type": column_type,
                            "constraints": [constraint.sql() for constraint in constraints],
                        }
                        table_info["columns"].append(column_info)

                    elif isinstance(expression, Constraint):
                        # Обработка ограничений (PRIMARY KEY, FOREIGN KEY и т.д.)
                        if hasattr(expression, "expressions"):
                            if isinstance(expression.expressions[0], PrimaryKey):
                                # Обработка составного первичного ключа
                                columns = [expr.name for expr in expression.expressions]
                                constraint_name = expression.name or generate_constraint_name(table_name, None, None,
                                                                                              "PK", dialect)
                                pk_info = {
                                    "columns": columns,
                                    "constraint_name": constraint_name
                                }
                                # Проверяем, существуют ли все столбцы для первичного ключа
                                missing_columns = [col for col in columns if
                                                   col not in [c["name"] for c in table_info["columns"]]]
                                if missing_columns:
                                    print(
                                        f"Cannot add PRIMARY KEY: columns {missing_columns} do not exist in table {table_name}.")
                                    continue
                                # Проверяем, существует ли уже такой первичный ключ
                                if not any(pk["columns"] == pk_info["columns"] for pk in table_info["primary_keys"]):
                                    table_info["primary_keys"].append(pk_info)

                            elif isinstance(expression.expressions[0], ForeignKey):
                                # Обработка составного внешнего ключа
                                fk = expression.expressions[0]
                                fk_columns = [expr.name for expr in fk.expressions]
                                reference = fk.args.get("reference")

                                if reference and reference.this and reference.this.expressions:
                                    check_cascade_delete = reference.args.get("options")
                                    referenced_table = reference.this.this.name if reference.this.this else "<unknown>"
                                    referenced_table_exists = any(
                                        table["name"] == referenced_table for table in tables_data)
                                    if not referenced_table_exists:
                                        print(
                                            f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                        continue
                                    referenced_columns = [expr.name for expr in reference.this.expressions]
                                    constraint_name = expression.alias_or_name or generate_constraint_name(table_name,fk_columns,
                                                                                                           referenced_table,
                                                                                                           "FK",
                                                                                                           dialect)
                                    cascade_del = True if "ON DELETE CASCADE" in check_cascade_delete else False
                                    fk_info = {
                                        "columns": fk_columns,
                                        "references": {
                                            "table": referenced_table,
                                            "columns": referenced_columns
                                        },
                                        "constraint_name": constraint_name,
                                        "cascade": cascade_del
                                    }
                                    # Проверяем, существуют ли все столбцы для внешнего ключа
                                    missing_columns = [col for col in fk_columns if
                                                       col not in [c["name"] for c in table_info["columns"]]]
                                    if missing_columns:
                                        print(
                                            f"Cannot add FOREIGN KEY: columns {missing_columns} do not exist in table {table_name}.")
                                        continue
                                    # Проверяем, существует ли таблица, на которую ссылается внешний ключ
                                    referenced_table_exists = any(
                                        table["name"] == referenced_table for table in tables_data)
                                    if not referenced_table_exists:
                                        print(
                                            f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                        continue
                                    # Проверяем, существуют ли все столбцы в referenced_table
                                    referenced_table_info = next(
                                        (table for table in tables_data if table["name"] == referenced_table), None)
                                    missing_referenced_columns = [col for col in referenced_columns if
                                                                  col not in [c["name"] for c in
                                                                              referenced_table_info["columns"]]]
                                    if missing_referenced_columns:
                                        print(
                                            f"Cannot add FOREIGN KEY: columns {missing_referenced_columns} do not exist in referenced table {referenced_table}.")
                                        continue
                                    # Проверяем, существует ли уже такой внешний ключ
                                    column_types = {col["name"]: col["type"] for col in table_info["columns"]}
                                    referenced_column_types = {col["name"]: col["type"] for col in
                                                               referenced_table_info["columns"]}

                                    type_mismatches = [
                                        (fk_col, ref_col) for fk_col, ref_col in zip(fk_columns, referenced_columns)
                                        if column_types.get(fk_col) != referenced_column_types.get(ref_col)
                                    ]

                                    if type_mismatches:
                                        print(
                                            f"Cannot add FOREIGN KEY: type mismatch between columns {type_mismatches} in {table_name} and {referenced_table}.")
                                        continue
                                    if not any(
                                            fk["columns"] == fk_info["columns"] for fk in table_info["foreign_keys"]):
                                        table_info["foreign_keys"].append(fk_info)

                    elif isinstance(expression, PrimaryKey):
                        # Обработка отдельного PrimaryKey, если он не входит в ColumnDef или Constraint
                        columns = [expr.name for expr in expression.expressions]
                        constraint_name = generate_constraint_name(table_name, None, None, "PK", dialect)
                        pk_info = {
                            "columns": columns,
                            "constraint_name": constraint_name
                        }
                        # Проверяем, существуют ли все столбцы для первичного ключа
                        missing_columns = [col for col in columns if
                                           col not in [c["name"] for c in table_info["columns"]]]
                        if missing_columns:
                            print(
                                f"Cannot add PRIMARY KEY: columns {missing_columns} do not exist in table {table_name}.")
                            continue
                        # Проверяем, существует ли уже такой первичный ключ
                        if not any(pk["columns"] == pk_info["columns"] for pk in table_info["primary_keys"]):
                            table_info["primary_keys"].append(pk_info)

                    elif isinstance(expression, ForeignKey):
                        # Обработка отдельного ForeignKey, если он не входит в ColumnDef или Constraint
                        fk_columns = [expr.name for expr in expression.expressions]
                        reference = expression.args.get("reference")
                        if reference and reference.this and reference.this.expressions:
                            check_cascade_delete = reference.args.get("options")
                            referenced_table = reference.this.this.name if reference.this.this else "<unknown>"
                            referenced_table_exists = any(
                                table["name"] == referenced_table for table in tables_data)
                            if not referenced_table_exists:
                                print(
                                    f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                continue
                            referenced_columns = [expr.name for expr in reference.this.expressions]
                            constraint_name = generate_constraint_name(table_name,fk_columns,referenced_table,"FK",dialect)
                            cascade_del = True if "ON DELETE CASCADE" in check_cascade_delete else False
                            fk_info = {
                                "columns": fk_columns,
                                "references": {
                                    "table": referenced_table,
                                    "columns": referenced_columns
                                },
                                "constraint_name": constraint_name,
                                "cascade": cascade_del
                            }

                            # Проверяем, существуют ли все столбцы для внешнего ключа
                            missing_columns = [col for col in fk_columns if
                                               col not in [c["name"] for c in table_info["columns"]]]
                            if missing_columns:
                                print(
                                    f"Cannot add FOREIGN KEY: columns {missing_columns} do not exist in table {table_name}.")
                                continue
                            # Проверяем, существует ли таблица, на которую ссылается внешний ключ
                            referenced_table_exists = any(
                                table["name"] == referenced_table for table in tables_data)
                            if not referenced_table_exists:
                                print(
                                    f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                continue
                            # Проверяем, существуют ли все столбцы в referenced_table
                            referenced_table_info = next(
                                (table for table in tables_data if table["name"] == referenced_table), None)
                            missing_referenced_columns = [col for col in referenced_columns if
                                                          col not in [c["name"] for c in
                                                                      referenced_table_info["columns"]]]
                            if missing_referenced_columns:
                                print(
                                    f"Cannot add FOREIGN KEY: columns {missing_referenced_columns} do not exist in referenced table {referenced_table}.")
                                continue
                            type_mismatches = []
                            for fk_col, ref_col in zip(fk_columns, referenced_columns):
                                fk_col_type = next(
                                    (col["type"] for col in table_info["columns"] if col["name"] == fk_col), None)
                                ref_col_type = next(
                                    (col["type"] for col in referenced_table_info["columns"] if col["name"] == ref_col),
                                    None)
                                if fk_col_type and ref_col_type and fk_col_type != ref_col_type:
                                    type_mismatches.append((fk_col, fk_col_type, ref_col, ref_col_type))

                            if type_mismatches:
                                print(f"Cannot add FOREIGN KEY: data type mismatch in columns: {type_mismatches}")
                                continue

                            if not any(
                                    fk["columns"] == fk_info["columns"] for fk in table_info["foreign_keys"]):
                                table_info["foreign_keys"].append(fk_info)


                tables_data.append(table_info)

            elif isinstance(parsed, Alter):
                # Обработка ALTER TABLE
                table_name = parsed.this.name
                existing_table = next((table for table in tables_data if table["name"] == table_name), None)
                if not existing_table:
                    print(f"Table {table_name} does not exist. Skipping ALTER TABLE.")
                    continue
                for action in parsed.actions:
                    if isinstance(action, AddConstraint):

                        constraint = action.expressions[0]
                        if isinstance(constraint.expressions[0], PrimaryKey):
                            if existing_table["primary_keys"]:
                                print(f"Cannot add PRIMARY KEY: table {table_name} already has a primary key.")
                                continue
                            # Обработка составного первичного ключа
                            columns = [getattr(expr, "alias_or_name", None)
                                       for inner_expr in constraint.args.get("expressions", [])
                                       for expr in inner_expr.args.get("expressions", [])
                                       if hasattr(expr, "alias_or_name")]
                            # Проверяем, существуют ли все столбцы для первичного ключа
                            missing_columns = [col for col in columns if
                                               col not in [c["name"] for c in existing_table["columns"]]]
                            if missing_columns:
                                print(
                                    f"Cannot add PRIMARY KEY: columns {missing_columns} do not exist in table {table_name}.")
                                continue
                            constraint_name = constraint.alias_or_name or generate_constraint_name(table_name, None,
                                                                                                   None, "PK", dialect)
                            pk_info = {
                                "columns": columns,
                                "constraint_name": constraint_name
                            }
                            # Проверяем, существует ли уже такой первичный ключ
                            if not any(pk["columns"] == pk_info["columns"] for pk in existing_table["primary_keys"]):
                                existing_table["primary_keys"].append(pk_info)
                        elif isinstance(constraint.expressions[0], ForeignKey):
                            # Обработка составного внешнего ключа
                            fk = constraint.expressions[0]
                            fk_columns = [expr.name for expr in fk.expressions]
                            # Проверяем, существуют ли все столбцы для внешнего ключа
                            missing_columns = [col for col in fk_columns if
                                               col not in [c["name"] for c in existing_table["columns"]]]
                            if missing_columns:
                                print(
                                    f"Cannot add FOREIGN KEY: columns {missing_columns} do not exist in table {table_name}.")
                                continue
                            reference = fk.args.get("reference")
                            check_cascade_delete = reference.args.get("options")
                            if reference and reference.this and reference.this.expressions:
                                referenced_table = reference.this.this.name if reference.this.this else "<unknown>"
                                referenced_table_exists = any(
                                    table["name"] == referenced_table for table in tables_data)
                                if not referenced_table_exists:
                                    print(
                                        f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                    continue
                                referenced_columns = [expr.name for expr in reference.this.expressions]
                                # Проверяем, существует ли таблица, на которую ссылается внешний ключ
                                referenced_table_exists = any(
                                    table["name"] == referenced_table for table in tables_data)
                                if not referenced_table_exists:
                                    print(
                                        f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                    continue
                                # Проверяем, существуют ли все столбцы в referenced_table
                                referenced_table_info = next(
                                    (table for table in tables_data if table["name"] == referenced_table), None)
                                missing_referenced_columns = [col for col in referenced_columns if
                                                              col not in [c["name"] for c in
                                                                          referenced_table_info["columns"]]]
                                if missing_referenced_columns:
                                    print(
                                        f"Cannot add FOREIGN KEY: columns {missing_referenced_columns} do not exist in referenced table {referenced_table}.")
                                    continue
                                constraint_name = constraint.alias_or_name or generate_constraint_name(table_name,fk_columns,
                                                                                                           referenced_table,
                                                                                                           "FK",
                                                                                                           dialect)
                                cascade_del = True if "ON DELETE CASCADE" in check_cascade_delete else False
                                fk_info = {
                                    "columns": fk_columns,
                                    "references": {
                                        "table": referenced_table,
                                        "columns": referenced_columns
                                    },
                                    "constraint_name": constraint_name,
                                    "cascade": cascade_del
                                }
                                # Проверяем, существует ли уже такой внешний ключ
                                type_mismatches = []
                                for fk_col, ref_col in zip(fk_columns, referenced_columns):
                                    fk_col_type = next(
                                        (col["type"] for col in existing_table["columns"] if col["name"] == fk_col),
                                        None)
                                    ref_col_type = next((col["type"] for col in referenced_table_info["columns"] if
                                                         col["name"] == ref_col), None)
                                    if fk_col_type and ref_col_type and fk_col_type != ref_col_type:
                                        type_mismatches.append((fk_col, fk_col_type, ref_col, ref_col_type))

                                if type_mismatches:
                                    print(f"Cannot add FOREIGN KEY: data type mismatch in columns: {type_mismatches}")
                                    continue
                                if not any(fk["columns"] == fk_info["columns"] for fk in existing_table["foreign_keys"]):
                                    existing_table["foreign_keys"].append(fk_info)


                    elif isinstance(action, ColumnDef):
                        # Обработка ADD COLUMN
                        column_name = action.this.name
                        if any(col["name"] == column_name for col in existing_table["columns"]):
                            print(f"Column {column_name} already exists in table {table_name}. Skipping addition.")
                            continue
                        column_info = {
                            "name": column_name,
                            "type": action.kind.sql(),
                            "constraints": [constraint.sql() for constraint in action.constraints],
                        }
                        existing_table["columns"].append(column_info)
                        # Обработка ограничений для новой колонки
                        for constraint in action.constraints:
                            if isinstance(constraint.kind, PrimaryKeyColumnConstraint):
                                # Обработка PRIMARY KEY
                                constraint_name = generate_constraint_name(table_name, column_name, None, "PK", dialect)
                                pk_info = {
                                    "columns": [column_name],
                                    "constraint_name": constraint_name
                                }
                                if not any(
                                        pk["columns"] == pk_info["columns"] for pk in existing_table["primary_keys"]):
                                    existing_table["primary_keys"].append(pk_info)

                            elif isinstance(constraint.kind, Reference):
                                # Обработка FOREIGN KEY
                                reference = constraint.kind.this
                                if reference and reference.this and reference.expressions:
                                    check_cascade_delete = constraint.kind.args.get("options")
                                    referenced_table = reference.this.this.name if reference.this.this else "<unknown>"
                                    referenced_table_exists = any(
                                        table["name"] == referenced_table for table in tables_data)
                                    if not referenced_table_exists:
                                        print(
                                            f"Cannot add FOREIGN KEY: referenced table {referenced_table} does not exist.")
                                        continue
                                    referenced_column = reference.expressions[
                                        0].name if reference.expressions else "<unknown>"
                                    constraint_name = generate_constraint_name(table_name, column_name, referenced_table,
                                                                                                           "FK",
                                                                                                           dialect)
                                    cascade_del = True if "ON DELETE CASCADE" in check_cascade_delete else False
                                    fk_info = {
                                        "columns": [column_name],
                                        "references": {
                                            "table": referenced_table,
                                            "columns": [referenced_column]
                                        },
                                        "constraint_name": constraint_name,
                                        "cascade": cascade_del
                                    }

                                    if not any(fk["columns"] == fk_info["columns"] for fk in
                                               existing_table["foreign_keys"]):
                                        existing_table["foreign_keys"].append(fk_info)


                    elif isinstance(action, Command):
                        if hasattr(action, "alias_or_name") and action.alias_or_name.lower()=="drop":
                            if action.args.get("expression") and action.args.get("expression") == " PRIMARY KEY":
                                if existing_table["primary_keys"]:
                                    for pk in existing_table["primary_keys"]:
                                        if pk.get("constraint_name") == "PRIMARY":
                                            existing_table["primary_keys"] = []
                                            print(f"Primary key dropped from table {table_name}.")
                                            break
                                    else:
                                        print(f"Table {table_name} has no primary key with constraint_name 'PRIMARY'.")
                                else:
                                    print(f"Table {table_name} has no primary key to drop.")

                    elif isinstance(action, Drop):
                        # Обработка DROP COLUMN и DROP CONSTRAINT
                        if action.kind == "COLUMN":
                            # Обработка DROP COLUMN
                            column_name = None
                            if action.expressions:
                                column_name = action.expressions[0].name
                            elif hasattr(action, "this") and hasattr(action.this, "name"):
                                column_name = action.this.name
                            if column_name:
                                # Проверяем, существует ли столбец
                                if not any(col["name"] == column_name for col in existing_table["columns"]):
                                    print(
                                        f"Column {column_name} does not exist in table {table_name}. Skipping DROP COLUMN.")
                                    continue
                                # Удаляем колонку из таблицы
                                existing_table["columns"] = [col for col in existing_table["columns"] if
                                                             col["name"] != column_name]
                                # Удаляем связанные первичные ключи (поддержка составных ключей)
                                existing_table["primary_keys"] = [
                                    pk for pk in existing_table["primary_keys"] if column_name not in pk["columns"]
                                ]
                                # Удаляем связанные внешние ключи (поддержка составных ключей)
                                existing_table["foreign_keys"] = [
                                    fk for fk in existing_table["foreign_keys"] if column_name not in fk["columns"]
                                ]
                                # Удаляем ссылки на эту колонку в других таблицах
                                for table in tables_data:
                                    table["foreign_keys"] = [
                                        fk for fk in table["foreign_keys"]
                                        if not (fk["references"]["table"] == table_name and column_name in
                                                fk["references"]["columns"])
                                    ]


                        elif action.kind in ["CONSTRAINT", "FOREIGN KEY", "PRIMARY KEY"]:
                            # Обработка DROP CONSTRAINT
                            constraint_name = None
                            if action.expressions:
                                constraint_name = action.expressions[0].name
                            elif hasattr(action, "this") and hasattr(action.this, "name"):
                                constraint_name = action.this.name
                            if constraint_name:
                                # Проверяем, существует ли ограничение
                                if not any(
                                        fk.get("constraint_name") == constraint_name for fk in
                                        existing_table["foreign_keys"]
                                ) and not any(
                                    pk.get("constraint_name") == constraint_name for pk in
                                    existing_table["primary_keys"]
                                ):
                                    print(
                                        f"Constraint {constraint_name} does not exist in table {table_name}. Skipping DROP CONSTRAINT.")
                                    continue
                                # Удаляем внешний ключ
                                existing_table["foreign_keys"] = [
                                    fk for fk in existing_table["foreign_keys"] if
                                    fk.get("constraint_name") != constraint_name
                                ]
                                # Удаляем первичный ключ, если имя ограничения соответствует
                                existing_table["primary_keys"] = [
                                    pk for pk in existing_table["primary_keys"] if
                                    pk.get("constraint_name") != constraint_name
                                ]

                    elif isinstance(action, RenameColumn):
                        # Обработка RENAME COLUMN
                        old_column_name = action.this.name
                        new_column_name = action.args["to"].name
                        if not any(column["name"] == old_column_name for column in existing_table["columns"]):
                            print(
                                f"Column {old_column_name} does not exist in table {table_name}. Skipping RENAME COLUMN.")
                            continue

                        # Переименовываем колонку в таблице
                        for column in existing_table["columns"]:
                            if column["name"] == old_column_name:
                                column["name"] = new_column_name
                        # Обновляем первичные ключи
                        for pk in existing_table["primary_keys"]:
                            if old_column_name in pk["columns"]:
                                pk["columns"] = [new_column_name if col == old_column_name else col for col in
                                                 pk["columns"]]
                        # Обновляем внешние ключи
                        for fk in existing_table["foreign_keys"]:
                            if old_column_name in fk["columns"]:
                                fk["columns"] = [new_column_name if col == old_column_name else col for col in
                                                 fk["columns"]]
                        # Обновляем ссылки в других таблицах
                        for table in tables_data:
                            for fk in table["foreign_keys"]:
                                if fk["references"]["table"] == table_name and old_column_name in fk["references"][
                                    "columns"]:
                                    fk["references"]["columns"] = [new_column_name if col == old_column_name else col
                                                                   for col in fk["references"]["columns"]]


                    elif isinstance(action, AlterRename):
                        # Обработка RENAME TABLE
                        new_table_name = action.this.name
                        # Переименовываем таблицу
                        existing_table["name"] = new_table_name
                        # Обновляем ссылки на таблицу в других таблицах
                        for table in tables_data:
                            for fk in table["foreign_keys"]:
                                if fk["references"]["table"] == table_name:
                                    fk["references"]["table"] = new_table_name


            elif isinstance(parsed, Drop):
                if isinstance(parsed.this, sqlglot.expressions.Table):
                    # перехват DROP TABLE
                    table_name = parsed.this.name
                    table_exists = any(table["name"] == table_name for table in tables_data)
                    if not table_exists:
                        print(f"Table {table_name} does not exist.")
                        continue
                    print(f"processing DROP TABLE: {table_name}")  # отладка
                    # Проверка наличия ссылок на таблицу
                    has_references = False
                    has_cascade = False
                    check_cascade_set = set()
                    for table in tables_data:
                        for fk in table["foreign_keys"]:
                            if fk["references"]["table"] == table_name:
                                has_references = True
                                if fk.get("cascade", False):
                                    check_cascade_set.add(True)
                                else:
                                    check_cascade_set.add(False)

                    # Если есть ссылки и ни одна из них не имеет ON DELETE CASCADE, отменяем удаление
                    if has_references and not (len(check_cascade_set)==1 and list(check_cascade_set)[0]==True):
                        print(
                            f"Cannot drop table {table_name}: it is referenced by other tables and no ON DELETE CASCADE is set.")
                        continue
                    # Удаляем таблицу из данных
                    tables_data = [table for table in tables_data if table["name"] != table_name]
                    # Удаление всех внешних ключей, ссылающихся на удаляемую таблицу
                    for table in tables_data:
                        initial_fk_count = len(table["foreign_keys"])
                        # Остаются только те внешние ключи, что НЕ ссылаются на удаляемую таблицу
                        table["foreign_keys"] = [
                            fk for fk in table["foreign_keys"]
                            if fk["references"]["table"] != table_name
                        ]
                        # Отладка
                        if len(table["foreign_keys"]) < initial_fk_count:
                            print(f"Removed foreign key references to {table_name} in table {table['name']}")

        return tables_data

    except Exception as e:
        print(f"Error during parsing: {e}")
        return []

from pathlib import Path
import json
import logging
import os

logger = logging.getLogger(__name__)

def sql_to_json_data(sql_query: str) -> list[dict]:
    tables_data = []
    queries = split_sql_queries(sql_query)

    for q in queries:
        tables_data = parse_sql(q, tables_data)

    # Возвращаем список таблиц
    return tables_data

