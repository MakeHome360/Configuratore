"""Round 80 — Bug critici utente:
1. Computo arricchisce nome/categoria da voci_backoffice quando mancano.
2. listini_items si salva e si rilegge correttamente nel pacchetto.
"""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_computo_enriches_missing_name_from_voci_backoffice():
    """Simula scenario UTENTE: preventivo con items che hanno voce_id ma name vuoto.
    Il computo deve arricchire da voci_backoffice."""
    s = _login()
    voci = s.get(f"{BASE_URL}/api/voci-backoffice").json()
    if not voci:
        return  # no catalog, skip
    vb = voci[0]
    vid = vb["id"]
    # Crea preventivo con item senza name/category ma con voce_id valido
    pid = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": "Test Enrich Round 80"},
        "mq": 50,
        "composite_selections": [
            # Volutamente SENZA name/category, solo voce_id e qty/price
            {"voce_id": vid, "qty": 5, "price": 100},
            # Una voce con qty/price ma senza voce_id valido
            {"voce_id": "non-esiste-12345", "name": "Bla", "qty": 2, "price": 50},
        ],
        "infissi_extras": [],
        "sicurezza_pct": 3, "direzione_lavori_pct": 5,
        "sconto_eur": 0, "iva_pct": 10,
        "totale_iva_incl": 600, "totale_iva_escl": 550,
    }).json()["id"]
    cid = s.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid, "cliente": {"nome": "Test"}}).json()["id"]
    r = s.post(f"{BASE_URL}/api/commesse/{cid}/workflow/computo")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    # Il primo item DEVE avere il nome del voce_backoffice (NON "Voce composite" o "—")
    enriched = next(it for it in items if it["voce_id"] == vid)
    assert enriched["name"] == vb["name"], f"name non arricchito: '{enriched['name']}' vs atteso '{vb['name']}'"
    assert enriched.get("category") == vb.get("category", ""), f"category non arricchita"


def test_package_listini_items_persistence():
    """listini_items deve essere salvato e riletto correttamente."""
    s = _login()
    # Snapshot iniziale
    pkg_before = next(p for p in s.get(f"{BASE_URL}/api/packages").json() if p["id"] == "pkg-basic")
    initial = pkg_before.get("listini_items") or []
    try:
        # PUT con 3 listini
        s.put(f"{BASE_URL}/api/packages/pkg-basic", json={
            "listini_items": [
                {"id": "PA", "listino_id": "L1", "nome": "Prod A", "prezzo_rivendita": 100, "qty": 1, "modificabile_dal_venditore": True},
                {"id": "PB", "listino_id": "L1", "nome": "Prod B", "prezzo_rivendita": 50, "qty": 5, "modificabile_dal_venditore": False},
                {"id": "PC", "listino_id": "L2", "nome": "Prod C", "prezzo_rivendita": 200, "qty": 2, "modificabile_dal_venditore": True},
            ],
        })
        # GET e verifica
        pkg_after = next(p for p in s.get(f"{BASE_URL}/api/packages").json() if p["id"] == "pkg-basic")
        items = pkg_after.get("listini_items") or []
        assert len(items) == 3
        ids = sorted([x["id"] for x in items])
        assert ids == ["PA", "PB", "PC"]
        qty_a = next(x for x in items if x["id"] == "PA")["qty"]
        assert qty_a == 1
        mod_b = next(x for x in items if x["id"] == "PB")["modificabile_dal_venditore"]
        assert mod_b is False
    finally:
        # Ripristina stato iniziale
        s.put(f"{BASE_URL}/api/packages/pkg-basic", json={"listini_items": initial})


def test_marginalita_returns_required_fields():
    """Il widget non deve crashare: backend deve sempre restituire costi_fissi_breakdown."""
    s = _login()
    r = s.post(f"{BASE_URL}/api/marginalita/calcola", json={
        "totale_iva_escl": 10000, "costi_diretti": 5000, "ruolo_venditore": "semplice",
    })
    assert r.status_code == 200
    d = r.json()
    assert "costi_fissi_breakdown" in d
    assert isinstance(d["costi_fissi_breakdown"], list)
    assert "margine_pct" in d
    assert "provvigione_venditore" in d
    assert "utile_netto" in d
