"""Round 72 — Test CRM potenziato:
1. GET /api/leads/{lid} — dettaglio singolo
2. POST /api/leads/{lid}/note — add nota timestamped + DELETE
3. POST /api/leads/import — CSV import con auto-mapping colonne, dedupe, source tracking
"""
import io
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    yield sess
    # cleanup any "round72_test" sources
    r = sess.get(f"{BASE_URL}/api/leads", timeout=10)
    for x in r.json():
        if x.get("source", "").startswith("round72_test"):
            sess.delete(f"{BASE_URL}/api/leads/{x['id']}", timeout=5)


def test_lead_detail_endpoint(s):
    # Create a lead
    r = s.post(f"{BASE_URL}/api/leads", json={"nome": "TestDetail", "cognome": "R72", "telefono": "39111222333", "email": f"d{uuid.uuid4().hex[:6]}@t.it"}, timeout=10)
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    # GET detail
    r = s.get(f"{BASE_URL}/api/leads/{lid}", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["nome"] == "TestDetail"
    assert d["telefono"] == "39111222333"
    # 404 if not found
    r = s.get(f"{BASE_URL}/api/leads/notexist", timeout=10)
    assert r.status_code == 404
    # cleanup
    s.delete(f"{BASE_URL}/api/leads/{lid}", timeout=10)


def test_lead_notes_history(s):
    r = s.post(f"{BASE_URL}/api/leads", json={"nome": "TestNote", "cognome": "R72", "telefono": "39111000111"}, timeout=10)
    lid = r.json()["id"]
    # Add 2 notes
    r1 = s.post(f"{BASE_URL}/api/leads/{lid}/note", json={"testo": "Prima chiamata, interessato", "tipo": "chiamata", "esito": "positivo"}, timeout=10)
    assert r1.status_code == 200
    n1 = r1.json()
    assert n1["testo"] == "Prima chiamata, interessato"
    assert n1["tipo"] == "chiamata"
    assert n1["user_nome"]  # must contain admin name
    r2 = s.post(f"{BASE_URL}/api/leads/{lid}/note", json={"testo": "Email inviata col preventivo", "tipo": "email", "esito": "neutro"}, timeout=10)
    n2 = r2.json()
    # Re-read lead
    r = s.get(f"{BASE_URL}/api/leads/{lid}", timeout=10)
    d = r.json()
    assert len(d["note_history"]) == 2
    # Newest first
    assert d["note_history"][0]["id"] == n2["id"]
    assert d["ultimo_contatto"] == n2["created_at"]
    # Empty text → 400
    r = s.post(f"{BASE_URL}/api/leads/{lid}/note", json={"testo": ""}, timeout=10)
    assert r.status_code == 400
    # Delete one note
    r = s.delete(f"{BASE_URL}/api/leads/{lid}/note/{n1['id']}", timeout=10)
    assert r.status_code == 200
    r = s.get(f"{BASE_URL}/api/leads/{lid}", timeout=10)
    assert len(r.json()["note_history"]) == 1
    # cleanup
    s.delete(f"{BASE_URL}/api/leads/{lid}", timeout=10)


def test_lead_import_csv(s):
    # Unique emails per run to avoid leftover dedupe; unique source for query
    suf = uuid.uuid4().hex[:6]
    src = f"round72_test_csv_{suf}"
    csv = (
        "Nome,Cognome,Telefono,Email,Citta,MQ,Note\n"
        f"Mario,Importato,33311{suf[:5]}1,m{suf}@example.com,Torino,80,Test import\n"
        f"Luigi,Verdi72,33322{suf[:5]}2,l{suf}@example.com,Milano,120,Cucina\n"
        f"Anna,Bianchi72,,a{suf}@example.com,Roma,60,Completa\n"
        f"Mario,Importato,33311{suf[:5]}1,m{suf}@example.com,Torino,80,Duplicato\n"
    )
    files = {"file": ("test.csv", csv.encode(), "text/csv")}
    r = s.post(f"{BASE_URL}/api/leads/import", files=files, data={"source": src, "dedupe": "true"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["imported"] == 3, d
    assert d["skipped_duplicates"] == 1
    assert d["total_rows"] == 4
    assert set(d["columns_detected"]) >= {"nome", "cognome", "telefono", "email", "citta", "mq", "note"}
    r = s.get(f"{BASE_URL}/api/leads", timeout=10)
    imported = [x for x in r.json() if x.get("source") == src]
    assert len(imported) == 3
    assert all(x.get("imported_at") for x in imported)
    # Re-import same CSV → 4 dup (3 dei nostri appena inseriti + 1 batch-dup interno)
    r = s.post(f"{BASE_URL}/api/leads/import", files={"file": ("test.csv", csv.encode(), "text/csv")}, data={"source": f"{src}_dup", "dedupe": "true"}, timeout=15)
    d2 = r.json()
    assert d2["imported"] == 0
    assert d2["skipped_duplicates"] == 4


def test_lead_import_column_aliases(s):
    """Header alternativi (English / accenti) devono essere riconosciuti."""
    suf = uuid.uuid4().hex[:6]
    csv = (
        "First_Name,Last_Name,Phone,E-Mail,City,Property\n"
        f"John,Doe,33344{suf[:5]}4,j{suf}@example.com,Naples,Villa\n"
    )
    files = {"file": ("test_en.csv", csv.encode(), "text/csv")}
    r = s.post(f"{BASE_URL}/api/leads/import", files=files, data={"source": "round72_test_alias", "dedupe": "false"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["imported"] == 1
    assert "nome" in d["columns_detected"]
    assert "cognome" in d["columns_detected"]
    assert "telefono" in d["columns_detected"]
    assert "email" in d["columns_detected"]
    r = s.get(f"{BASE_URL}/api/leads", timeout=10)
    john = next((x for x in r.json() if x.get("source") == "round72_test_alias" and x.get("nome") == "John"), None)
    assert john is not None
    assert john["cognome"] == "Doe"
    assert john["citta"] == "Naples"


def test_lead_import_invalid_format(s):
    """Files non csv/xlsx → 400."""
    files = {"file": ("test.pdf", b"%PDF-1.4", "application/pdf")}
    r = s.post(f"{BASE_URL}/api/leads/import", files=files, data={"source": "round72_test_bad"}, timeout=10)
    assert r.status_code == 400
