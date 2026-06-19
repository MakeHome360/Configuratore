"""Tests for Round 88 P0 fixes:
1. Modificare un preventivo PUT /api/preventivi/{id} sincronizza la commessa collegata (totale + computo_metrico).
2. Listini Fornitori: la `subcategoria_effettiva` è auto-rilevata e usata nel filtro categoria del picker.
3. Infissi nel preventivo: load/save di infissi_extras con misure/accessori modificati.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_01_subcategoria_detection_via_api(H):
    """La porta Matriz (interna) non deve apparire sotto porte_blindate nel picker."""
    # Crea un listino "porte_blindate" e aggiungi una "Porta Matriz" che è in realtà interna
    listino = requests.post(f"{API}/fornitori-listini", json={
        "fornitore_nome": "TEST Garofoli",
        "categoria": "porte_blindate",
        "nome": "Test R88 listino blindate",
        "ricarico_default": 1.8,
    }, headers=H, timeout=10).json()
    assert listino.get("id")
    lid = listino["id"]
    try:
        # Aggiungi prodotto "Porta Matriz" — è interna
        prod = requests.post(f"{API}/fornitori-listini/{lid}/prodotti", json={
            "nome": "Porta Matriz Noce", "prezzo_netto": 300, "unit": "pz",
        }, headers=H, timeout=10).json()
        # Aggiungi una vera blindata
        prod_blind = requests.post(f"{API}/fornitori-listini/{lid}/prodotti", json={
            "nome": "Porta Blindata RC2", "prezzo_netto": 1200, "unit": "pz",
        }, headers=H, timeout=10).json()
        # Riclassifica per essere sicuri
        requests.post(f"{API}/fornitori-listini/{lid}/riclassifica", headers=H, timeout=10)
        # Cerca per categoria=porte_blindate: Matriz NON deve apparire, RC2 sì
        r = requests.get(f"{API}/fornitori-listini-prodotti/cerca?categoria=porte_blindate", headers=H, timeout=10).json()
        nomi = [p.get("nome") for p in r if p.get("listino_id") == lid]
        assert "Porta Matriz Noce" not in nomi, f"Matriz NON deve essere blindata, ma è in: {nomi}"
        assert any("Blindata RC2" in n for n in nomi), f"RC2 deve essere blindata, ma manca da: {nomi}"
        # Cerca per categoria=porte_interne: Matriz SÌ
        r = requests.get(f"{API}/fornitori-listini-prodotti/cerca?categoria=porte_interne", headers=H, timeout=10).json()
        nomi = [p.get("nome") for p in r if p.get("listino_id") == lid]
        assert any("Matriz" in n for n in nomi), f"Matriz è interna, deve essere in porte_interne: {nomi}"
    finally:
        requests.delete(f"{API}/fornitori-listini/{lid}", headers=H, timeout=10)


def test_02_preventivo_put_does_not_wipe_data(H):
    """Update parziale (solo cliente) non deve azzerare i totali — regression R87."""
    # Crea preventivo
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": "Test R88 sync"},
        "mq": 80,
        "totale_iva_incl": 50000,
        "totale_iva_escl": 45454.54,
    }, headers=H, timeout=10).json()
    prev_id = p["id"]
    try:
        # PUT parziale: solo email cliente
        upd = requests.put(f"{API}/preventivi/{prev_id}", json={"cliente": {"nome": "Test R88 sync", "email": "x@y.it"}}, headers=H, timeout=10).json()
        assert upd.get("totale_iva_incl") == 50000, f"Totale azzerato: {upd.get('totale_iva_incl')}"
        assert upd.get("mq") == 80
        assert (upd.get("cliente") or {}).get("email") == "x@y.it"
    finally:
        requests.delete(f"{API}/preventivi/{prev_id}", headers=H, timeout=10)


def test_03_preventivo_update_sync_commessa(H):
    """Modificare un preventivo collegato a una commessa aggiorna il totale della commessa."""
    # 1. Crea preventivo
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": "Test R88 sync commessa"},
        "mq": 60,
        "composite_selections": [
            {"section_id": "demolizioni", "voce_id": "v1", "name": "Demolizione muro", "qty": 10, "unit": "m²", "price": 30, "list_price": 30},
        ],
        "totale_iva_incl": 1320,
        "totale_iva_escl": 1200,
    }, headers=H, timeout=10).json()
    prev_id = p["id"]
    # 2. Accetta il preventivo per creare la commessa
    requests.put(f"{API}/preventivi/{prev_id}", json={"stato": "accettato"}, headers=H, timeout=10)
    # 3. Crea commessa manualmente (l'auto-populate dovrebbe averla creata già, ma in alcuni flow no)
    com_existing = requests.get(f"{API}/commesse", headers=H, timeout=10).json()
    com = next((c for c in com_existing if c.get("preventivo_id") == prev_id), None)
    if not com:
        com = requests.post(f"{API}/commesse", json={"preventivo_id": prev_id, "fasi_attive_ids": []}, headers=H, timeout=10).json()
    com_id = com["id"]
    try:
        # 4. Modifica il preventivo (aumenta il totale)
        upd = requests.put(f"{API}/preventivi/{prev_id}", json={
            "cliente": {"nome": "Test R88 sync commessa"},
            "composite_selections": [
                {"section_id": "demolizioni", "voce_id": "v1", "name": "Demolizione muro", "qty": 20, "unit": "m²", "price": 30, "list_price": 30},
            ],
            "totale_iva_incl": 2640,
            "totale_iva_escl": 2400,
        }, headers=H, timeout=10).json()
        assert upd.get("totale_iva_incl") == 2640
        # 5. Verifica che la commessa sia stata aggiornata
        com_after = requests.get(f"{API}/commesse/{com_id}", headers=H, timeout=10).json()
        # Il PUT del preventivo ha aggiornato `totale` della commessa
        assert com_after.get("totale") == 2640, f"Commessa NON sincronizzata: totale={com_after.get('totale')}"
        assert com_after.get("preventivo_modificato_dopo_creazione") is True
        assert com_after.get("ultimo_sync_preventivo")
    finally:
        requests.delete(f"{API}/commesse/{com_id}", headers=H, timeout=10)
        requests.delete(f"{API}/preventivi/{prev_id}", headers=H, timeout=10)


def test_04_infissi_extras_persist_in_preventivo(H):
    """Salvare un preventivo con infissi_extras e poi modificarli deve persistere correttamente."""
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": "Test R88 infissi"},
        "mq": 50,
        "infissi_extras": [
            {
                "id": "i1", "name": "Finestra 120×140cm",
                "unit": "pz", "qty": 2, "unit_price": 600, "price": 1200,
                "infisso_meta": {
                    "categoria": "finestra", "apertura": "battente", "ante": 2,
                    "materiale_id": "pvc-bianco", "vetro_id": "doppio",
                    "larghezza": 120, "altezza": 140,
                    "tapparella": False, "zanzariera": False, "qty": 2,
                },
            }
        ],
        "totale_iva_incl": 1320,
    }, headers=H, timeout=10).json()
    prev_id = p["id"]
    try:
        # Modifica l'infisso aggiungendo zanzariera e cambiando misura
        upd = requests.put(f"{API}/preventivi/{prev_id}", json={
            "cliente": {"nome": "Test R88 infissi"},
            "infissi_extras": [
                {
                    "id": "i1", "name": "Finestra 150×150cm + zanzariera",
                    "unit": "pz", "qty": 2, "unit_price": 750, "price": 1500,
                    "infisso_meta": {
                        "categoria": "finestra", "apertura": "battente", "ante": 2,
                        "materiale_id": "pvc-bianco", "vetro_id": "doppio",
                        "larghezza": 150, "altezza": 150,
                        "tapparella": False, "zanzariera": True, "qty": 2,
                    },
                }
            ],
            "totale_iva_incl": 1650,
        }, headers=H, timeout=10).json()
        infs = upd.get("infissi_extras") or []
        assert len(infs) == 1
        meta = infs[0].get("infisso_meta") or {}
        assert meta.get("larghezza") == 150
        assert meta.get("zanzariera") is True
        assert upd.get("totale_iva_incl") == 1650
    finally:
        requests.delete(f"{API}/preventivi/{prev_id}", headers=H, timeout=10)
