from flask import Blueprint, jsonify, g

from app.models import Produto, Mercado
from app.auth.utils import login_obrigatorio

bp = Blueprint("catalogo", __name__, url_prefix="/api")


@bp.get("/produtos")
@login_obrigatorio()
def listar_produtos():
    produtos = Produto.query.filter_by(empresa_id=g.empresa_id).order_by(Produto.descricao).all()
    return jsonify(
        [
            {
                "codigoEAN": p.codigo_ean,
                "descricao": p.descricao,
                "marca": p.marca,
                "categoria": p.categoria,
                "unidade": p.unidade,
                "validadeMediaDias": p.validade_media_dias,
            }
            for p in produtos
        ]
    )


@bp.get("/mercados")
@login_obrigatorio()
def listar_mercados():
    mercados = Mercado.query.filter_by(empresa_id=g.empresa_id).order_by(Mercado.nome).all()
    return jsonify(
        [
            {
                "id": m.slug,
                "nome": m.nome,
                "endereco": {
                    "rua": m.endereco_rua,
                    "bairro": m.endereco_bairro,
                    "cidade": m.endereco_cidade,
                    "estado": m.endereco_estado,
                },
            }
            for m in mercados
        ]
    )
