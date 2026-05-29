"""Fix infissi-config — derivare prezzi dalle Voci Backoffice (Source of Truth)."""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_infissi_config_base_from_voci_backoffice():
    """Per ogni materiale di /api/infissi-config, il base_per_mq deve essere
    derivato dalla rispettiva voce backoffice (acquisto × ricarico)."""
    s = _login()
    voci = {v["id"]: v for v in s.get(f"{BASE_URL}/api/voci-backoffice").json()
            if v.get("id") in ("voce-infissi-pvc", "voce-infissi-alluminio", "voce-infissi-legno")}
    pvc_rev = round(voci["voce-infissi-pvc"]["prezzo_acquisto"] * voci["voce-infissi-pvc"]["ricarico"], 2)
    alu_rev = round(voci["voce-infissi-alluminio"]["prezzo_acquisto"] * voci["voce-infissi-alluminio"]["ricarico"], 2)
    leg_rev = round(voci["voce-infissi-legno"]["prezzo_acquisto"] * voci["voce-infissi-legno"]["ricarico"], 2)

    conf = s.get(f"{BASE_URL}/api/infissi-config").json()
    by_id = {m["id"]: m for m in conf["materiali"]}
    assert by_id["mat-pvc"]["base_per_mq"] == pvc_rev, f"PVC mismatch: {by_id['mat-pvc']['base_per_mq']} vs {pvc_rev}"
    assert by_id["mat-al"]["base_per_mq"] == alu_rev, f"AL mismatch"
    assert by_id["mat-legno-al"]["base_per_mq"] == leg_rev, f"LEGNO mismatch"
    assert by_id["mat-pvc-nog"]["base_per_mq"] == round(pvc_rev * 1.15, 2), "PVC nog variant 1.15 deve essere coerente"


def test_infissi_config_reacts_to_voci_backoffice_update():
    """Se l'admin modifica il prezzo della voce backoffice INFISSI PVC, /infissi-config si aggiorna."""
    s = _login()
    voce = s.get(f"{BASE_URL}/api/voci-backoffice").json()
    pvc = next(v for v in voce if v.get("id") == "voce-infissi-pvc")
    orig_acquisto = pvc["prezzo_acquisto"]
    try:
        new_acquisto = 300.0
        s.put(f"{BASE_URL}/api/voci-backoffice/voce-infissi-pvc", json={"prezzo_acquisto": new_acquisto})
        conf = s.get(f"{BASE_URL}/api/infissi-config").json()
        by_id = {m["id"]: m for m in conf["materiali"]}
        atteso = round(new_acquisto * pvc["ricarico"], 2)
        assert by_id["mat-pvc"]["base_per_mq"] == atteso, f"Atteso {atteso}, ottenuto {by_id['mat-pvc']['base_per_mq']}"
    finally:
        # rollback
        s.put(f"{BASE_URL}/api/voci-backoffice/voce-infissi-pvc", json={"prezzo_acquisto": orig_acquisto})
