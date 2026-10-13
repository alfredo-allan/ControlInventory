# App factory — padrão Flask recomendado (em vez de `app = Flask(__name__)`
# solto num módulo), porque facilita testar com configs diferentes e evita
# import circular entre extensões/models/blueprints.

from flask import Flask

from app.config import get_config
from app.extensions import db, migrate, cors


def create_app(config_class=None):
    app = Flask(__name__)
    app.config.from_object(config_class or get_config())

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Import dos models aqui dentro (não no topo do arquivo) é necessário
    # pro Flask-Migrate enxergar as tabelas na hora de gerar migrações.
    from app import models  # noqa: F401

    from app.auth.routes import bp as auth_bp
    from app.sync.routes import bp as sync_bp
    from app.catalogo.routes import bp as catalogo_bp
    from app.estoque.routes import bp as estoque_bp
    from app.metricas.routes import bp as metricas_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(sync_bp)
    app.register_blueprint(catalogo_bp)
    app.register_blueprint(estoque_bp)
    app.register_blueprint(metricas_bp)

    return app
