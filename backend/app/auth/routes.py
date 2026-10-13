from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db
from app.models import Usuario, Empresa
from app.auth.utils import gerar_token, login_obrigatorio

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    dados = request.get_json(silent=True) or {}
    nome = (dados.get("nome") or "").strip()
    senha = dados.get("senha") or ""

    if not nome or not senha:
        return jsonify({"erro": "Informe nome e senha."}), 400

    usuario = Usuario.query.filter_by(nome=nome).first()
    if not usuario or not check_password_hash(usuario.senha_hash, senha):
        return jsonify({"erro": "Nome ou senha incorretos."}), 401

    token = gerar_token(usuario)
    return jsonify({
        "token": token,
        "usuario": {"id": usuario.id, "nome": usuario.nome, "perfil": usuario.perfil, "empresaId": usuario.empresa_id},
    })


@bp.get("/me")
@login_obrigatorio()
def me():
    usuario = Usuario.query.get_or_404(g.usuario_id)
    return jsonify({"id": usuario.id, "nome": usuario.nome, "perfil": usuario.perfil, "empresaId": usuario.empresa_id})


@bp.post("/usuarios")
@login_obrigatorio(perfis=["admin"])
def criar_usuario():
    """Só um admin pode criar outro usuário/operador — RBAC básico. O
    primeiro usuário admin de cada empresa é criado pelo `seed.py`, não por
    essa rota (evita o problema de 'ovo e galinha' de precisar de um admin
    pra criar o primeiro admin)."""
    dados = request.get_json(silent=True) or {}
    nome = (dados.get("nome") or "").strip()
    senha = dados.get("senha") or ""
    perfil = dados.get("perfil", "operador")

    if not nome or not senha:
        return jsonify({"erro": "Informe nome e senha."}), 400
    if perfil not in ("admin", "operador"):
        return jsonify({"erro": "Perfil deve ser 'admin' ou 'operador'."}), 400

    if Usuario.query.filter_by(empresa_id=g.empresa_id, nome=nome).first():
        return jsonify({"erro": "Já existe um usuário com esse nome nessa empresa."}), 409

    usuario = Usuario(empresa_id=g.empresa_id, nome=nome, perfil=perfil, senha_hash=generate_password_hash(senha))
    db.session.add(usuario)
    db.session.commit()

    return jsonify({"id": usuario.id, "nome": usuario.nome, "perfil": usuario.perfil}), 201
