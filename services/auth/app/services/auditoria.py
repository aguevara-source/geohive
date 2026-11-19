from sqlalchemy import Connection, text


def registrar(db: Connection, evento: str, *, usuario_id=None, email: str | None = None, ip: str | None = None):
    db.execute(
        text("INSERT INTO auditoria (usuario_id, email, evento, ip) VALUES (:u, :e, :ev, :ip)"),
        {"u": usuario_id, "e": email, "ev": evento, "ip": ip},
    )
