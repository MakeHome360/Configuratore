"""
Iter7 backend tests:
  - voci-backoffice contains 4 new demolizione voci (muri/pavimento/rivestimento/controsoffitto)
  - materials catalog includes 8 new floor/wall tiles
"""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


def test_login_works():
    s = _login()
    me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert me.status_code == 200
    assert me.json().get("email") in ("admin@admin.it", "admin@ristruttura.app", "admin")


# ---- Voci backoffice (4 new demolizioni) ----
class TestVociBackoffice:
    REQUIRED = {
        "Demolizione muri": (22.0, "m²"),
        "Demolizione pavimento": (18.0, "m²"),
        "Demolizione rivestimento pareti": (16.5, "m²"),
        "Demolizione controsoffitto": (14.0, "m²"),
    }

    def test_seed_missing_voci(self):
        s = _login()
        # Trigger the seed-missing endpoint to ensure the 4 new voci are added
        r = s.post(f"{BASE_URL}/api/voci-backoffice/seed-missing", timeout=20)
        # endpoint may return 200/201; tolerate 404 if not present (just log)
        print(f"seed-missing voci status={r.status_code} body={r.text[:200]}")
        assert r.status_code in (200, 201, 204, 404)

    def test_voci_contains_new_demolizioni(self):
        s = _login()
        r = s.get(f"{BASE_URL}/api/voci-backoffice", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("data", []))
        assert isinstance(items, list) and items, "voci list is empty"
        names = {it.get("nome") or it.get("name") or "": it for it in items}
        missing = [n for n in self.REQUIRED if n not in names]
        assert not missing, f"missing voci: {missing}; have: {list(names.keys())[:30]}"
        for name, (price, unit) in self.REQUIRED.items():
            it = names[name]
            p = it.get("prezzo_acquisto")
            u = it.get("um") or it.get("unit") or it.get("unita_misura")
            assert p is not None, f"{name} missing prezzo_acquisto; keys={list(it.keys())}"
            assert abs(float(p) - price) < 0.01, f"{name} prezzo_acquisto={p} expected={price}"
            if u is not None:
                # accept m2/m² variants
                u_norm = str(u).replace("m2", "m²")
                assert u_norm == unit, f"{name} unit={u} expected={unit}"


# ---- Materials catalog (8 new tiles) ----
class TestMaterialsCatalog:
    REQUIRED_IDS = [
        "floor-tile-3060",
        "floor-tile-6060",
        "floor-tile-60120",
        "floor-tile-8080",
        "floor-tile-225x90",
        "floor-tile-25x150",
        "wall-tile-bagno",
        "wall-tile-cucina",
    ]

    def test_seed_missing_materials(self):
        s = _login()
        r = s.post(f"{BASE_URL}/api/materials/seed-missing", timeout=20)
        print(f"seed-missing materials status={r.status_code} body={r.text[:200]}")
        assert r.status_code in (200, 201, 204, 404)

    def test_materials_contains_new_tiles(self):
        s = _login()
        r = s.get(f"{BASE_URL}/api/materials", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("data", []))
        ids = {it.get("id") or it.get("_id") or "" for it in items}
        missing = [mid for mid in self.REQUIRED_IDS if mid not in ids]
        assert not missing, f"missing material ids: {missing}; total catalog={len(items)}"
