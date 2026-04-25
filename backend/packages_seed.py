"""
Seed data for Ristruttura.CAD — BASIC / SMART / PREMIUM / ELITE
Aligned with configuratore.base44.app reference app.
"""

# ---------------- Voci backoffice (Prezzario acquisto × ricarico = rivendita) ----------------
# Categorie: MURATURA / IMPIANTI / INFISSI / SERVIZI
DEFAULT_VOCI_BACKOFFICE = [
    # MURATURA
    {"id": "voce-posa-pav-ceramica", "category": "MURATURA", "name": "Posa pavimento ceramica", "prezzo_acquisto": 25.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-piastrelle-pav", "category": "MURATURA", "name": "Piastrelle pavimento", "prezzo_acquisto": 14.85, "ricarico": 2.8, "unit": "m²"},
    {"id": "voce-posa-riv-ceramica", "category": "MURATURA", "name": "Posa rivestimento ceramica", "prezzo_acquisto": 27.5, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-piastrelle-riv", "category": "MURATURA", "name": "Piastrelle rivestimento", "prezzo_acquisto": 14.85, "ricarico": 2.8, "unit": "m²"},
    {"id": "voce-posa-massetto", "category": "MURATURA", "name": "Posa massetto", "prezzo_acquisto": 20.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-autolivellante", "category": "MURATURA", "name": "Autolivellante", "prezzo_acquisto": 20.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-massetto-alleggerito", "category": "MURATURA", "name": "Massetto per alleggerito", "prezzo_acquisto": 22.5, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-muro-mattone", "category": "MURATURA", "name": "Muro mattone", "prezzo_acquisto": 45.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-muro-cartongesso", "category": "MURATURA", "name": "Muro cartongesso", "prezzo_acquisto": 26.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-controsoffitto", "category": "MURATURA", "name": "Controparete / controsoffitto", "prezzo_acquisto": 30.23, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-battiscopa", "category": "MURATURA", "name": "Battiscopa", "prezzo_acquisto": 8.0, "ricarico": 1.8, "unit": "ml"},
    {"id": "voce-decorazione", "category": "MURATURA", "name": "Decorazione", "prezzo_acquisto": 7.2, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-demolizione", "category": "MURATURA", "name": "Demolizione e smaltimento", "prezzo_acquisto": 15.75, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-posa-laminato", "category": "MURATURA", "name": "Posa pavimento laminato/parquet", "prezzo_acquisto": 14.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-pavimento-pvc", "category": "MURATURA", "name": "Pavimento PVC/laminato", "prezzo_acquisto": 20.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-posa-parquet", "category": "MURATURA", "name": "Posa parquet", "prezzo_acquisto": 31.2, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-parquet", "category": "MURATURA", "name": "Parquet", "prezzo_acquisto": 35.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-rasatura", "category": "MURATURA", "name": "Rasatura pareti", "prezzo_acquisto": 11.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-pittura", "category": "MURATURA", "name": "Pittura prima mano", "prezzo_acquisto": 17.5, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-velette", "category": "MURATURA", "name": "Velette / fil di muro pittura", "prezzo_acquisto": 37.5, "ricarico": 1.8, "unit": "ml"},
    {"id": "voce-stucco-app", "category": "MURATURA", "name": "Verniciatura stucco (per appartamento)", "prezzo_acquisto": 350.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-intonaco", "category": "MURATURA", "name": "Intonaco grezzo", "prezzo_acquisto": 11.0, "ricarico": 1.8, "unit": "m²"},
    # IMPIANTI
    {"id": "voce-elettrico", "category": "IMPIANTI", "name": "Impianto elettrico completo", "prezzo_acquisto": 35.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-idraulico", "category": "IMPIANTI", "name": "Impianto idraulico completo", "prezzo_acquisto": 40.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-radiatori", "category": "IMPIANTI", "name": "Impianto riscaldamento radiatori", "prezzo_acquisto": 28.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-radiante", "category": "IMPIANTI", "name": "Impianto riscaldamento a pavimento", "prezzo_acquisto": 45.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-caldaia", "category": "IMPIANTI", "name": "Caldaia a condensazione", "prezzo_acquisto": 1500.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-predispo-clima", "category": "IMPIANTI", "name": "Predisposizione climatizzatore", "prezzo_acquisto": 120.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-condiz-dual", "category": "IMPIANTI", "name": "Climatizzatore dual split", "prezzo_acquisto": 1750.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-condiz-trial", "category": "IMPIANTI", "name": "Climatizzatore trial split", "prezzo_acquisto": 2500.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-porte-int", "category": "IMPIANTI", "name": "Porte interne serie standard", "prezzo_acquisto": 280.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-sanitari", "category": "IMPIANTI", "name": "Sanitari bagno (WC+bidet+lavabo)", "prezzo_acquisto": 500.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-box-doccia", "category": "IMPIANTI", "name": "Box doccia", "prezzo_acquisto": 380.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-mobile-bagno", "category": "IMPIANTI", "name": "Mobile bagno", "prezzo_acquisto": 340.0, "ricarico": 1.8, "unit": "pz"},
    # INFISSI
    {"id": "voce-pannello-blinda", "category": "INFISSI", "name": "Pannello porta blindata", "prezzo_acquisto": 750.0, "ricarico": 1.8, "unit": "pz"},
    {"id": "voce-cornici-porte", "category": "INFISSI", "name": "Posa cornici porte", "prezzo_acquisto": 300.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-infissi-pvc", "category": "INFISSI", "name": "Infissi PVC bianchi (esterni)", "prezzo_acquisto": 280.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-infissi-alluminio", "category": "INFISSI", "name": "Infissi alluminio taglio termico (esterni)", "prezzo_acquisto": 460.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-infissi-legno", "category": "INFISSI", "name": "Infissi legno/alluminio (esterni)", "prezzo_acquisto": 620.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-zanzariere", "category": "INFISSI", "name": "Zanzariere POSA INCLUSA", "prezzo_acquisto": 80.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-tapparelle", "category": "INFISSI", "name": "Tapparelle POSA INCLUSA", "prezzo_acquisto": 120.0, "ricarico": 1.8, "unit": "m²"},
    {"id": "voce-griglia-al", "category": "INFISSI", "name": "Griglia alluminio sicurezza", "prezzo_acquisto": 2000.0, "ricarico": 1.8, "unit": "pz"},
    # SERVIZI
    {"id": "voce-cila", "category": "SERVIZI", "name": "Pratica CILA", "prezzo_acquisto": 500.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-direzione-lavori", "category": "SERVIZI", "name": "Direzione lavori", "prezzo_acquisto": 900.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-ape", "category": "SERVIZI", "name": "APE Attestato prestazione energetica", "prezzo_acquisto": 180.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-cert-impianti", "category": "SERVIZI", "name": "Certificazioni impianti", "prezzo_acquisto": 360.0, "ricarico": 1.8, "unit": "forfait"},
    {"id": "voce-sicurezza", "category": "SERVIZI", "name": "Sicurezza cantiere", "prezzo_acquisto": 450.0, "ricarico": 1.8, "unit": "forfait"},
]

# ---------------- Pacchetti (BASIC / SMART / PREMIUM / ELITE) ----------------
DEFAULT_PACKAGES = [
    {
        "id": "pkg-basic",
        "name": "BASIC",
        "subtitle": "Ristrutturazione base con materiali standard",
        "price_per_m2": 380.0,
        "color": "#475569",
        "description": "Tinteggio, piccoli interventi, rivestimenti bagno base. Refresh essenziale.",
        "included": {
            "voce-posa-riv-ceramica": {"qty_ratio": 0.29, "unit_price_pkg": 27.5},
            "voce-piastrelle-riv":    {"qty_ratio": 0.40, "unit_price_pkg": 13.2},
            "voce-decorazione":       {"qty_ratio": 2.70, "unit_price_pkg": 8.0},
            "voce-muro-cartongesso":  {"qty_ratio": 0.14, "unit_price_pkg": 26.0},
            "voce-elettrico":         {"qty_ratio": 0.30, "unit_price_pkg": 35.0},
            "voce-porte-int":         {"qty_ratio": 0.057, "unit_price_pkg": 350.0},
            "voce-demolizione":       {"qty_ratio": 0.5, "unit_price_pkg": 15.75},
            "voce-cila":              {"qty_ratio": 0.014, "unit_price_pkg": 500.0},
        },
    },
    {
        "id": "pkg-smart",
        "name": "SMART",
        "subtitle": "Ottimo rapporto qualità/prezzo",
        "price_per_m2": 490.0,
        "color": "#3B82F6",
        "description": "Rifacimento pavimenti, bagno completo, tinteggi, impianti adeguati.",
        "included": {
            "voce-posa-pav-ceramica": {"qty_ratio": 1.0, "unit_price_pkg": 25.0},
            "voce-piastrelle-pav":    {"qty_ratio": 1.15, "unit_price_pkg": 14.85},
            "voce-posa-riv-ceramica": {"qty_ratio": 0.235, "unit_price_pkg": 27.5},
            "voce-piastrelle-riv":    {"qty_ratio": 0.33, "unit_price_pkg": 14.85},
            "voce-posa-massetto":     {"qty_ratio": 1.0, "unit_price_pkg": 20.0},
            "voce-decorazione":       {"qty_ratio": 2.7, "unit_price_pkg": 8.0},
            "voce-muro-cartongesso":  {"qty_ratio": 0.2, "unit_price_pkg": 26.0},
            "voce-controsoffitto":    {"qty_ratio": 0.5, "unit_price_pkg": 30.0},
            "voce-elettrico":         {"qty_ratio": 1.0, "unit_price_pkg": 45.0},
            "voce-idraulico":         {"qty_ratio": 0.15, "unit_price_pkg": 50.0},
            "voce-porte-int":         {"qty_ratio": 0.057, "unit_price_pkg": 380.0},
            "voce-sanitari":          {"qty_ratio": 0.012, "unit_price_pkg": 650.0},
            "voce-box-doccia":        {"qty_ratio": 0.012, "unit_price_pkg": 480.0},
            "voce-cila":              {"qty_ratio": 0.012, "unit_price_pkg": 600.0},
            "voce-demolizione":       {"qty_ratio": 1.0, "unit_price_pkg": 15.75},
        },
    },
    {
        "id": "pkg-premium",
        "name": "PREMIUM",
        "subtitle": "Finiture premium e materiali di qualità",
        "price_per_m2": 790.0,
        "color": "#0EA5E9",
        "description": "Tutto rifatto: pavimenti, bagni, impianti, climatizzazione, serramenti.",
        "included": {
            "voce-posa-pav-ceramica": {"qty_ratio": 1.0, "unit_price_pkg": 25.0},
            "voce-piastrelle-pav":    {"qty_ratio": 1.2, "unit_price_pkg": 18.15},
            "voce-posa-riv-ceramica": {"qty_ratio": 0.286, "unit_price_pkg": 27.5},
            "voce-piastrelle-riv":    {"qty_ratio": 0.4, "unit_price_pkg": 16.5},
            "voce-posa-massetto":     {"qty_ratio": 1.0, "unit_price_pkg": 20.0},
            "voce-decorazione":       {"qty_ratio": 2.7, "unit_price_pkg": 8.0},
            "voce-muro-mattone":      {"qty_ratio": 0.15, "unit_price_pkg": 45.0},
            "voce-muro-cartongesso":  {"qty_ratio": 0.3, "unit_price_pkg": 26.0},
            "voce-controsoffitto":    {"qty_ratio": 0.5, "unit_price_pkg": 30.23},
            "voce-elettrico":         {"qty_ratio": 1.0, "unit_price_pkg": 55.0},
            "voce-idraulico":         {"qty_ratio": 0.3, "unit_price_pkg": 65.0},
            "voce-radiatori":         {"qty_ratio": 1.0, "unit_price_pkg": 45.0},
            "voce-predispo-clima":    {"qty_ratio": 0.042, "unit_price_pkg": 180.0},
            "voce-porte-int":         {"qty_ratio": 0.071, "unit_price_pkg": 490.0},
            "voce-sanitari":          {"qty_ratio": 0.014, "unit_price_pkg": 950.0},
            "voce-box-doccia":        {"qty_ratio": 0.014, "unit_price_pkg": 720.0},
            "voce-mobile-bagno":      {"qty_ratio": 0.014, "unit_price_pkg": 680.0},
            "voce-cila":              {"qty_ratio": 0.014, "unit_price_pkg": 850.0},
            "voce-direzione-lavori":  {"qty_ratio": 0.014, "unit_price_pkg": 1500.0},
            "voce-ape":               {"qty_ratio": 0.014, "unit_price_pkg": 300.0},
            "voce-demolizione":       {"qty_ratio": 1.0, "unit_price_pkg": 15.75},
        },
    },
    {
        "id": "pkg-elite",
        "name": "ELITE",
        "subtitle": "Il massimo della qualità e del design",
        "price_per_m2": 1180.0,
        "color": "#0A0A0A",
        "description": "Finiture di lusso, domotica, marmi, massetto radiante, infissi premium.",
        "included": {
            "voce-posa-pav-ceramica": {"qty_ratio": 1.0, "unit_price_pkg": 30.0},
            "voce-piastrelle-pav":    {"qty_ratio": 1.15, "unit_price_pkg": 50.82},
            "voce-posa-riv-ceramica": {"qty_ratio": 0.167, "unit_price_pkg": 35.0},
            "voce-piastrelle-riv":    {"qty_ratio": 0.233, "unit_price_pkg": 50.82},
            "voce-posa-massetto":     {"qty_ratio": 1.0, "unit_price_pkg": 22.0},
            "voce-massetto-alleggerito": {"qty_ratio": 1.0, "unit_price_pkg": 25.0},
            "voce-decorazione":       {"qty_ratio": 2.7, "unit_price_pkg": 12.0},
            "voce-muro-mattone":      {"qty_ratio": 0.15, "unit_price_pkg": 45.0},
            "voce-muro-cartongesso":  {"qty_ratio": 0.4, "unit_price_pkg": 28.0},
            "voce-controsoffitto":    {"qty_ratio": 0.8, "unit_price_pkg": 32.0},
            "voce-elettrico":         {"qty_ratio": 1.0, "unit_price_pkg": 75.0},
            "voce-idraulico":         {"qty_ratio": 0.3, "unit_price_pkg": 80.0},
            "voce-radiante":          {"qty_ratio": 1.0, "unit_price_pkg": 75.0},
            "voce-caldaia":           {"qty_ratio": 0.008, "unit_price_pkg": 2500.0},
            "voce-condiz-dual":       {"qty_ratio": 0.008, "unit_price_pkg": 3100.0},
            "voce-porte-int":         {"qty_ratio": 0.067, "unit_price_pkg": 850.0},
            "voce-pannello-blinda":   {"qty_ratio": 0.008, "unit_price_pkg": 2200.0},
            "voce-tapparelle":        {"qty_ratio": 0.058, "unit_price_pkg": 320.0},
            "voce-zanzariere":        {"qty_ratio": 0.058, "unit_price_pkg": 300.0},
            "voce-sanitari":          {"qty_ratio": 0.017, "unit_price_pkg": 1500.0},
            "voce-box-doccia":        {"qty_ratio": 0.017, "unit_price_pkg": 1200.0},
            "voce-mobile-bagno":      {"qty_ratio": 0.017, "unit_price_pkg": 1200.0},
            "voce-cila":              {"qty_ratio": 0.008, "unit_price_pkg": 1200.0},
            "voce-direzione-lavori":  {"qty_ratio": 0.008, "unit_price_pkg": 2200.0},
            "voce-ape":               {"qty_ratio": 0.008, "unit_price_pkg": 350.0},
            "voce-cert-impianti":     {"qty_ratio": 0.008, "unit_price_pkg": 800.0},
            "voce-demolizione":       {"qty_ratio": 1.0, "unit_price_pkg": 15.75},
        },
    },
]

# Kept for compatibility with legacy endpoints (not used for new logic)
LAVORAZIONI_CATALOG = [(v["id"], v["name"], v["category"], v["unit"], v["prezzo_acquisto"] * v["ricarico"]) for v in DEFAULT_VOCI_BACKOFFICE]

# ---------------- Optional per pacchetto ----------------
DEFAULT_OPTIONAL = [
    {"id": "opt-pav-gres-basic", "package_ids": ["pkg-basic"], "name": "Pavimentazione gres (upgrade Smart)", "price_listino": 4200.0, "price_scontato": 3780.0, "unit": "forfait"},
    {"id": "opt-sottofondo-basic", "package_ids": ["pkg-basic"], "name": "Rifacimento sottofondo (demolizione+massetto)", "price_listino": 5250.0, "price_scontato": 4725.0, "unit": "forfait"},
    {"id": "opt-condiz-dual-basic", "package_ids": ["pkg-basic", "pkg-smart"], "name": "Condizionatore dual (mano d'opera inclusa)", "price_listino": 3100.0, "price_scontato": 2790.0, "unit": "forfait"},
    {"id": "opt-condiz-trial", "package_ids": ["pkg-smart", "pkg-premium"], "name": "Condizionatore trial split", "price_listino": 4500.0, "price_scontato": 4050.0, "unit": "forfait"},
    {"id": "opt-arredo-artigian", "package_ids": ["pkg-basic", "pkg-smart"], "name": "Arredamento artigiano (mobili su misura)", "price_listino": 5000.0, "price_scontato": 4500.0, "unit": "forfait"},
    {"id": "opt-porta-blindata", "package_ids": ["pkg-basic", "pkg-smart"], "name": "Portoncino blindato", "price_listino": 2100.0, "price_scontato": 1890.0, "unit": "pz"},
    {"id": "opt-pav-gres-smart", "package_ids": ["pkg-smart"], "name": "Pavimentazione gres (upgrade Premium)", "price_listino": 4675.0, "price_scontato": 4207.5, "unit": "forfait"},
    {"id": "opt-sottofondo-premium", "package_ids": ["pkg-premium"], "name": "Rifacimento sottofondo", "price_listino": 5250.0, "price_scontato": 4725.0, "unit": "forfait"},
    {"id": "opt-canalizzato", "package_ids": ["pkg-premium", "pkg-elite"], "name": "Climatizzazione canalizzata", "price_listino": 7500.0, "price_scontato": 6750.0, "unit": "forfait"},
    {"id": "opt-tapparelle-premium", "package_ids": ["pkg-premium"], "name": "Tapparelle motorizzate", "price_listino": 2240.0, "price_scontato": 2016.0, "unit": "forfait"},
    {"id": "opt-zanzariere-premium", "package_ids": ["pkg-premium"], "name": "Zanzariere", "price_listino": 2080.0, "price_scontato": 1872.0, "unit": "forfait"},
    # bagni aggiuntivi
    {"id": "opt-bagno-silver", "package_ids": ["pkg-basic", "pkg-smart", "pkg-premium", "pkg-elite"], "name": "Bagno aggiuntivo SILVER", "price_listino": 6900.0, "price_scontato": 6210.0, "unit": "forfait"},
    {"id": "opt-bagno-gold", "package_ids": ["pkg-smart", "pkg-premium", "pkg-elite"], "name": "Bagno aggiuntivo GOLD", "price_listino": 9800.0, "price_scontato": 8820.0, "unit": "forfait"},
    {"id": "opt-bagno-platinum", "package_ids": ["pkg-premium", "pkg-elite"], "name": "Bagno aggiuntivo PLATINUM", "price_listino": 13500.0, "price_scontato": 12150.0, "unit": "forfait"},
]

# ---------------- Livelli Bagno (per Solo Bagno) ----------------
BATHROOM_TIERS = [
    {"id": "bagno-silver", "name": "SILVER", "price": 3500.0, "color": "#94A3B8",
     "description": "Sanitari, miscelatori, box doccia, piatto doccia, lavabo/mobile bagno - Linea Standard"},
    {"id": "bagno-gold", "name": "GOLD", "price": 5500.0, "color": "#F59E0B",
     "description": "Sanitari, miscelatori, box doccia, piatto doccia, lavabo/mobile bagno - Linea Premium"},
    {"id": "bagno-platinum", "name": "PLATINUM", "price": 9000.0, "color": "#0A0A0A",
     "description": "Sanitari, miscelatori, box doccia, piatto doccia, lavabo/mobile bagno - Linea Luxury"},
]

BATHROOM_MANODOPERA_BASE = 6500.0  # fisso

# ---------------- Fasi Commessa default (18 fasi come base44) ----------------
DEFAULT_FASI_COMMESSA = [
    {"id": "fase-01", "order": 1, "name": "Sopralluogo tecnico", "description": "Verifica misure e stato dell'immobile", "has_doc": True, "obbligatoria": True},
    {"id": "fase-02", "order": 2, "name": "Firma contratto", "description": "Firma del contratto con il cliente", "has_doc": True, "obbligatoria": True},
    {"id": "fase-03", "order": 3, "name": "Acconto ricevuto", "description": "Ricezione acconto iniziale", "has_doc": True, "obbligatoria": True},
    {"id": "fase-04", "order": 4, "name": "Pratica CILA", "description": "Presentazione e approvazione CILA", "has_doc": True, "obbligatoria": True},
    {"id": "fase-05", "order": 5, "name": "Allestimento cantiere", "description": "Preparazione del cantiere", "has_doc": False, "obbligatoria": True},
    {"id": "fase-06", "order": 6, "name": "Demolizioni", "description": "Demolizione pavimenti, rivestimenti, tramezzi", "has_doc": False, "obbligatoria": True},
    {"id": "fase-07", "order": 7, "name": "Impianto idraulico", "description": "Realizzazione nuovo impianto idraulico", "has_doc": False, "obbligatoria": True},
    {"id": "fase-08", "order": 8, "name": "Impianto elettrico", "description": "Realizzazione nuovo impianto elettrico", "has_doc": False, "obbligatoria": True},
    {"id": "fase-09", "order": 9, "name": "Massetto", "description": "Realizzazione massetto", "has_doc": False, "obbligatoria": True},
    {"id": "fase-10", "order": 10, "name": "Posa pavimenti", "description": "Posa pavimenti e battiscopa", "has_doc": False, "obbligatoria": True},
    {"id": "fase-11", "order": 11, "name": "Posa rivestimenti", "description": "Posa rivestimenti bagni e cucina", "has_doc": False, "obbligatoria": True},
    {"id": "fase-12", "order": 12, "name": "Porte interne", "description": "Installazione porte interne", "has_doc": False, "obbligatoria": True},
    {"id": "fase-13", "order": 13, "name": "Sanitari e rubinetteria", "description": "Installazione sanitari e rubinetteria", "has_doc": False, "obbligatoria": True},
    {"id": "fase-14", "order": 14, "name": "Rasatura e pittura", "description": "Rasatura pareti e pittura", "has_doc": False, "obbligatoria": True},
    {"id": "fase-15", "order": 15, "name": "Finiture e pulizie", "description": "Finiture finali e pulizie", "has_doc": False, "obbligatoria": True},
    {"id": "fase-16", "order": 16, "name": "Collaudo impianti", "description": "Test e collaudo di tutti gli impianti", "has_doc": True, "obbligatoria": True},
    {"id": "fase-17", "order": 17, "name": "Consegna lavori", "description": "Consegna lavori al cliente", "has_doc": True, "obbligatoria": True},
    {"id": "fase-18", "order": 18, "name": "Saldo ricevuto", "description": "Ricezione saldo finale", "has_doc": True, "obbligatoria": True},
]

# ---------------- Template Email default ----------------
DEFAULT_TEMPLATE_EMAIL = [
    {"id": "tmpl-prev-inviato", "code": "preventivo_stato_inviato", "trigger": "Cambio stato preventivo", "recipient": "Cliente",
     "subject": "Il tuo preventivo è pronto! 🎉",
     "body": "Ciao {{cliente_nome}},\nTi comunichiamo che il preventivo per il tuo progetto di ristrutturazione è ora disponibile.\n\nDettagli:\nIndirizzo: {{indirizzo}}\nSuperficie: {{mq}} mq\nPacchetto: {{pacchetto}}\nTotale: {{totale}} €\n\nCordiali saluti."},
    {"id": "tmpl-com-in-corso", "code": "commessa_stato_in_corso", "trigger": "Cambio stato commessa", "recipient": "Cliente",
     "subject": "La tua ristrutturazione è iniziata! 🔨",
     "body": "Ciao {{cliente_nome}},\nSiamo felici di comunicarvi che i lavori di ristrutturazione presso {{indirizzo}} sono ufficialmente iniziati.\n\nInfo Commessa:\nIndirizzo: {{indirizzo}}\nMQ: {{mq}}\nPacchetto: {{pacchetto}}\n\nResta aggiornato dalla tua dashboard."},
    {"id": "tmpl-voce-assegn", "code": "voce_nuova_assegnazione", "trigger": "Voce assegnata", "recipient": "Subappaltatore",
     "subject": "Nuova lavorazione assegnata: {{nome_voce}}",
     "body": "Ciao,\nTi comunichiamo che è stata assegnata una nuova lavorazione nel progetto presso {{indirizzo}}.\n\nDettagli della voce:\nVoce: {{nome_voce}}\nCategoria: {{categoria}}\nImporto: {{importo}}"},
]

# ---------------- Negozi default ----------------
DEFAULT_NEGOZI = [
    {"id": "store-nichelino", "name": "NICHELINO", "code": "nichelino", "active": True, "address": "", "phone": ""},
]

# ---------------- Impostazioni default ----------------
DEFAULT_IMPOSTAZIONI = {
    "margine_minimo": 30.0,
    "costi_fissi_commessa": 500.0,
    "iva_ristrutturazione": 10.0,
    "iva_standard": 22.0,
    "ricarico_default": 1.8,
    "sicurezza_pct": 3.0,
    "direzione_lavori_pct": 5.0,
}

# ---------------- Dati Azienda default ----------------
DEFAULT_DATI_AZIENDA = {
    "id": "azienda-main",
    "nome": "Inside Home",
    "email": "info@insidehome.it",
    "telefono": "",
    "piva": "",
    "indirizzo": "",
    "sito": "",
    "logo": None,
    "colore_primario": "teal",  # teal/blue/emerald/violet/amber/rose
}

# ---------------- Composite sezioni ----------------
COMPOSITE_SECTIONS = [
    {"id": "sec-pavimentazione", "name": "Pavimentazione", "voci": [
        {"id": "cp-sovrap-pvc", "name": "Sovrapposizione PVC o Laminato come da capitolato", "price": 30.0, "unit": "m²"},
        {"id": "cp-sovrap-gres", "name": "Sovrapposizione Gres come da capitolato", "price": 149.0, "unit": "m²"},
        {"id": "cp-demol-piastrelle", "name": "Demolizione e Rifacimento Massetto + Posa Piastrella a scelta", "price": 79.0, "unit": "m²"},
        {"id": "cp-costo-fornitura", "name": "Costo Fornitura", "price": 0.0, "unit": "forfait"},
    ]},
    {"id": "sec-pareti", "name": "Pareti", "voci": [
        {"id": "cp-rasatura", "name": "Rasatura e tinteggio pareti", "price": 19.80, "unit": "m²"},
        {"id": "cp-cartongesso", "name": "Parete in cartongesso", "price": 46.80, "unit": "m²"},
        {"id": "cp-rivestimento", "name": "Rivestimento ceramico pareti", "price": 91.08, "unit": "m²"},
    ]},
    {"id": "sec-soffitti", "name": "Soffitti", "voci": [
        {"id": "cp-tinteggio-sof", "name": "Tinteggio soffitto", "price": 12.00, "unit": "m²"},
        {"id": "cp-controsoffitto", "name": "Controsoffitto in cartongesso", "price": 54.41, "unit": "m²"},
    ]},
    {"id": "sec-pratiche", "name": "Pratiche", "voci": [
        {"id": "cp-cila", "name": "Pratica CILA", "price": 900.0, "unit": "forfait"},
        {"id": "cp-direzione", "name": "Direzione lavori", "price": 1620.0, "unit": "forfait"},
        {"id": "cp-ape", "name": "APE", "price": 324.0, "unit": "forfait"},
    ]},
    {"id": "sec-idraulico", "name": "Impianto Idraulico", "voci": [
        {"id": "cp-idraulico-completo", "name": "Impianto idraulico completo", "price": 72.00, "unit": "m²"},
        {"id": "cp-idraulico-parziale", "name": "Impianto idraulico parziale", "price": 45.00, "unit": "m²"},
    ]},
    {"id": "sec-elettrico", "name": "Impianto Elettrico", "voci": [
        {"id": "cp-elettrico-completo", "name": "Impianto elettrico completo", "price": 63.00, "unit": "m²"},
        {"id": "cp-elettrico-domotica", "name": "Impianto elettrico domotica", "price": 95.00, "unit": "m²"},
    ]},
    {"id": "sec-riscaldamento", "name": "Impianto di Riscaldamento", "voci": [
        {"id": "cp-radiatori", "name": "Radiatori + caldaia", "price": 50.00, "unit": "m²"},
        {"id": "cp-pavimento", "name": "Radiante a pavimento", "price": 81.00, "unit": "m²"},
    ]},
    {"id": "sec-condizionamento", "name": "Impianto di Condizionamento", "voci": [
        {"id": "cp-predispo", "name": "Predisposizione climatizzatore", "price": 216.0, "unit": "pz"},
        {"id": "cp-dual", "name": "Climatizzatore dual split", "price": 3150.0, "unit": "forfait"},
        {"id": "cp-trial", "name": "Climatizzatore trial split", "price": 4500.0, "unit": "forfait"},
    ]},
    {"id": "sec-illuminazione", "name": "Corpi Illuminanti", "voci": [
        {"id": "cp-faretto", "name": "Faretto LED incasso", "price": 68.4, "unit": "pz"},
        {"id": "cp-plafoniera", "name": "Plafoniera LED", "price": 171.0, "unit": "pz"},
        {"id": "cp-sospensione", "name": "Sospensione design", "price": 432.0, "unit": "pz"},
    ]},
    {"id": "sec-porte", "name": "Porte", "voci": [
        {"id": "cp-porta-std", "name": "Porta interna serie standard", "price": 504.0, "unit": "pz"},
        {"id": "cp-porta-premium", "name": "Porta interna premium", "price": 882.0, "unit": "pz"},
        {"id": "cp-blindata", "name": "Portoncino blindato", "price": 2700.0, "unit": "pz"},
    ]},
    {"id": "sec-sanitari", "name": "Sanitari", "voci": [
        {"id": "cp-sanitari-silver", "name": "Sanitari SILVER (wc+bidet+lavabo+miscelatori)", "price": 1170.0, "unit": "forfait"},
        {"id": "cp-sanitari-gold", "name": "Sanitari GOLD premium", "price": 1890.0, "unit": "forfait"},
        {"id": "cp-sanitari-platinum", "name": "Sanitari PLATINUM luxury", "price": 2880.0, "unit": "forfait"},
    ]},
    {"id": "sec-infissi", "name": "Infissi", "voci": [
        {"id": "cp-infissi-pvc", "name": "Infissi PVC bianchi", "price": 7200.0, "unit": "forfait"},
        {"id": "cp-infissi-al", "name": "Infissi alluminio taglio termico", "price": 11700.0, "unit": "forfait"},
        {"id": "cp-infissi-legno", "name": "Infissi legno/alluminio", "price": 15300.0, "unit": "forfait"},
    ]},
    {"id": "sec-accessori-infissi", "name": "Accessori Infissi", "voci": [
        {"id": "cp-tapparelle", "name": "Tapparelle posa inclusa", "price": 117.0, "unit": "pz"},
        {"id": "cp-tapparelle-mot", "name": "Tapparelle motorizzate", "price": 320.0, "unit": "pz"},
        {"id": "cp-zanzariere", "name": "Zanzariere posa inclusa", "price": 126.0, "unit": "pz"},
        {"id": "cp-griglia", "name": "Griglia alluminio sicurezza", "price": 3600.0, "unit": "pz"},
    ]},
]

# ---------------- Infissi tipologie ----------------
INFISSI_TIPOLOGIE = [
    {"id": "inf-finestra-1anta", "name": "Finestra 1 anta", "category": "Finestra"},
    {"id": "inf-finestra-2ante", "name": "Finestra 2 ante", "category": "Finestra"},
    {"id": "inf-portafinestra-1anta", "name": "Portafinestra 1 anta", "category": "Portafinestra"},
    {"id": "inf-portafinestra-2ante", "name": "Portafinestra 2 ante", "category": "Portafinestra"},
    {"id": "inf-scorrevole", "name": "Scorrevole alzante", "category": "Scorrevole"},
]

INFISSI_MATERIALI = [
    {"id": "mat-pvc", "name": "PVC bianco", "multiplier": 1.0, "base_per_mq": 420.0},
    {"id": "mat-pvc-nog", "name": "PVC effetto legno", "multiplier": 1.15, "base_per_mq": 420.0},
    {"id": "mat-al", "name": "Alluminio taglio termico", "multiplier": 1.6, "base_per_mq": 420.0},
    {"id": "mat-legno-al", "name": "Legno/Alluminio", "multiplier": 2.1, "base_per_mq": 420.0},
]

INFISSI_VETRI = [
    {"id": "vetro-doppio", "name": "Doppio vetro", "multiplier": 1.0},
    {"id": "vetro-triplo", "name": "Triplo vetro", "multiplier": 1.25},
    {"id": "vetro-triplo-basso", "name": "Triplo vetro basso emissivo", "multiplier": 1.4},
]
