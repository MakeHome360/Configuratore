"""Test R89 ter: bagno_config source of truth = voci_backoffice."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def H():
    tok = requests.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_bagno_config_prices_come_from_voci_backoffice(H):
    """I prezzi tier bagno devono corrispondere ai prezzo_rivendita delle voci Pacchetto Silver/Gold/Platinum."""
    bagno = requests.get(f"{API}/bagno-config", headers=H, timeout=10).json()
    voci = requests.get(f"{API}/voci-backoffice", headers=H, timeout=10).json()
    v_silver = next(v for v in voci if "Silver" in v["name"])
    v_gold = next(v for v in voci if "Gold" in v["name"])
    v_plat = next(v for v in voci if "Platinum" in v["name"])
    v_man = next(v for v in voci if "Manodopera Bagno" in v["name"])
    # Match
    tiers = {t["name"]: t["price"] for t in bagno["tiers"]}
    assert tiers.get("SILVER") == v_silver["prezzo_rivendita"], f"Silver: bagno={tiers.get('SILVER')} vs voce={v_silver['prezzo_rivendita']}"
    assert tiers.get("GOLD") == v_gold["prezzo_rivendita"]
    assert tiers.get("PLATINUM") == v_plat["prezzo_rivendita"]
    assert bagno["manodopera_base"] == v_man["prezzo_rivendita"]


def test_bagno_config_put_updates_voci_backoffice(H):
    """PUT /bagno-config deve aggiornare le voci_backoffice (via ricalcolo ricarico)."""
    original = requests.get(f"{API}/bagno-config", headers=H, timeout=10).json()
    # Trova voce_id dai tier
    voce_ids = {t["name"]: t.get("voce_id") for t in original["tiers"]}
    try:
        # Cambia Silver a 2500
        payload = {
            "manodopera_base": 7500,
            "manodopera_description": "test",
            "manodopera_included_items": [],
            "tiers": [
                {**t, "price": 2500 if t["name"] == "SILVER" else t["price"]}
                for t in original["tiers"]
            ],
        }
        r = requests.put(f"{API}/bagno-config", headers=H, json=payload, timeout=10).json()
        assert r["ok"] is True
        # Verify voci_backoffice reflect the change
        voci = requests.get(f"{API}/voci-backoffice", headers=H, timeout=10).json()
        v_silver = next(v for v in voci if v["id"] == voce_ids["SILVER"])
        v_man = next(v for v in voci if "Manodopera Bagno" in v["name"])
        assert v_silver["prezzo_rivendita"] == 2500, f"Silver non aggiornato: {v_silver['prezzo_rivendita']}"
        assert v_man["prezzo_rivendita"] == 7500, f"Manodopera non aggiornata: {v_man['prezzo_rivendita']}"
        # Bagno-config re-read
        bagno2 = requests.get(f"{API}/bagno-config", headers=H, timeout=10).json()
        assert next(t for t in bagno2["tiers"] if t["name"] == "SILVER")["price"] == 2500
        assert bagno2["manodopera_base"] == 7500
    finally:
        # Restore
        requests.put(f"{API}/bagno-config", headers=H, json={
            "manodopera_base": original["manodopera_base"],
            "manodopera_description": original.get("manodopera_description", ""),
            "manodopera_included_items": original.get("manodopera_included_items", []),
            "tiers": original["tiers"],
        }, timeout=10)


def test_bagno_config_syncs_composite_optionals(H):
    """PUT /bagno-config aggiorna anche gli optional composite opt-bagno-silver/gold/platinum."""
    original = requests.get(f"{API}/bagno-config", headers=H, timeout=10).json()
    try:
        # Set Silver=1800 → optional opt-bagno-silver deve diventare 1800
        payload = {
            "manodopera_base": original["manodopera_base"],
            "manodopera_description": "",
            "manodopera_included_items": [],
            "tiers": [
                {**t, "price": 1800 if t["name"] == "SILVER" else t["price"]}
                for t in original["tiers"]
            ],
        }
        requests.put(f"{API}/bagno-config", headers=H, json=payload, timeout=10)
        opts = requests.get(f"{API}/optional", headers=H, timeout=10).json()
        o_silver = next(o for o in opts if o["id"] == "opt-bagno-silver")
        assert o_silver["price_listino"] == 1800, f"Optional composite non sincronizzato: {o_silver['price_listino']}"
    finally:
        requests.put(f"{API}/bagno-config", headers=H, json={
            "manodopera_base": original["manodopera_base"],
            "manodopera_description": original.get("manodopera_description", ""),
            "manodopera_included_items": original.get("manodopera_included_items", []),
            "tiers": original["tiers"],
        }, timeout=10)
