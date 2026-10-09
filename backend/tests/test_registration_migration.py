from sqlalchemy import create_engine, inspect, text
from app.database import upgrade_registration_columns


def test_existing_registrations_are_preserved_when_intake_columns_are_added():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE registrations (id TEXT PRIMARY KEY, name TEXT NOT NULL, sports TEXT NOT NULL)"))
        connection.execute(text("INSERT INTO registrations VALUES ('existing', 'Existing player', '[\"Football\"]')"))
        upgrade_registration_columns(connection)
        upgrade_registration_columns(connection)
        columns = {column["name"] for column in inspect(connection).get_columns("registrations")}
        assert {"age", "gender", "region", "played_before", "volunteer_department", "volunteer_rationale"} <= columns
        row = connection.execute(text("SELECT * FROM registrations")).mappings().one()
        assert row["name"] == "Existing player" and row["sports"] == '["Football"]'
        assert row["age"] is None and row["volunteer_department"] is None
        assert row["played_before"] is None
    engine.dispose()
