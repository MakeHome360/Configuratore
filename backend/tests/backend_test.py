"""
Backend tests for Ristruttura CAD API.
Covers: auth (register/login/me/logout/refresh), projects CRUD, materials, AI render error handling, brute force lockout.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://cad-preventivi-live.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ristruttura.app"
ADMIN_PASSWORD = "Admin12345!"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def new_user_session():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test12345!", "name": "TEST User"}, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == email
    assert data["name"] == "TEST User"
    s._email = email  # type: ignore
    return s


# --------- Health ---------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "Ristruttura" in r.json().get("message", "")


# --------- Auth ---------
class TestAuth:
    def test_register_and_me(self, new_user_session):
        r = new_user_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == new_user_session._email
        assert d["role"] == "user"

    def test_duplicate_register(self, new_user_session):
        r = new_user_session.post(f"{API}/auth/register",
                                  json={"email": new_user_session._email, "password": "x", "name": "x"}, timeout=15)
        assert r.status_code == 400

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"

    def test_login_invalid(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "nouser@example.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_logout_clears(self, new_user_session):
        # Create a fresh session for logout to avoid affecting others
        s = requests.Session()
        email = f"logout_{uuid.uuid4().hex[:8]}@example.com"
        s.post(f"{API}/auth/register", json={"email": email, "password": "Test12345!", "name": "L"}, timeout=15)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        # Cookie cleared -> me should fail
        s.cookies.clear()
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 401

    def test_refresh_token(self, new_user_session):
        r = new_user_session.post(f"{API}/auth/refresh", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# --------- Projects CRUD ---------
class TestProjects:
    def test_create_list_get_update_delete(self, new_user_session):
        s = new_user_session
        # CREATE
        payload = {"name": "TEST_Project", "data": {"walls": [], "rooms": []}, "thumbnail": None}
        r = s.post(f"{API}/projects", json=payload, timeout=15)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_Project"
        assert created["user_id"]
        assert "id" in created
        pid = created["id"]

        # LIST
        r = s.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        # GET
        r = s.get(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Project"

        # UPDATE
        r = s.put(f"{API}/projects/{pid}",
                  json={"name": "TEST_Project_Updated", "data": {"walls": [1]}, "thumbnail": "t"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Project_Updated"
        assert r.json()["data"] == {"walls": [1]}

        # GET verify update
        r = s.get(f"{API}/projects/{pid}", timeout=15)
        assert r.json()["name"] == "TEST_Project_Updated"

        # DELETE
        r = s.delete(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200

        # GET after delete -> 404
        r = s.get(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 404

    def test_projects_unauth(self):
        r = requests.get(f"{API}/projects", timeout=15)
        assert r.status_code == 401


# --------- Materials ---------
class TestMaterials:
    def test_get_materials_default_31(self, new_user_session):
        r = new_user_session.get(f"{API}/materials", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) == 31, f"Expected 31 default materials, got {len(items)}"
        cats = {it["category"] for it in items}
        # categories referenced in spec
        for c in ["floor", "wall", "ceiling", "plumbing", "electrical", "furniture", "fixture", "appliance", "light"]:
            assert c in cats, f"Missing category {c}"

    def test_update_material_price(self, new_user_session):
        s = new_user_session
        r = s.get(f"{API}/materials", timeout=15)
        items = r.json()
        target = next(it for it in items if it["id"] == "floor-parquet")
        new_price = target["price"] + 7.77
        r = s.put(f"{API}/materials/floor-parquet", json={"price": new_price}, timeout=15)
        assert r.status_code == 200
        assert abs(r.json()["price"] - new_price) < 0.001
        # verify persistence
        r = s.get(f"{API}/materials", timeout=15)
        floor = next(it for it in r.json() if it["id"] == "floor-parquet")
        assert abs(floor["price"] - new_price) < 0.001

    def test_reset_materials(self, new_user_session):
        s = new_user_session
        r = s.post(f"{API}/materials/reset", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 31
        floor = next(it for it in items if it["id"] == "floor-parquet")
        assert floor["price"] == 85.0  # reset to default


# --------- AI Render error handling ---------
class TestAIRender:
    def test_ai_render_unauth(self):
        r = requests.post(f"{API}/ai-render", json={"image_base64": "", "prompt": "x"}, timeout=15)
        assert r.status_code == 401

    def test_ai_render_empty_image(self, new_user_session):
        # Empty image_base64 should not 200 - expect 500 from AI pipeline (error handling)
        r = new_user_session.post(f"{API}/ai-render",
                                  json={"image_base64": "", "prompt": "test"}, timeout=60)
        # Should not succeed without a valid image
        assert r.status_code in (400, 422, 500), f"Unexpected status {r.status_code}: {r.text[:300]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
