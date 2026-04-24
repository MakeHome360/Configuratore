"""
Default package seed data based on analysis of user's .numbers files.
Prices per m² as unit prices. Quantity included is calculated from m² ratio.
"""

# Structure per package:
#   base_price_per_m2, ratio_map (lavorazione_id -> {qty_ratio, unit_price}), optional[]
# qty_ratio: quantità inclusa / mq_abitazione

LAVORAZIONI_CATALOG = [
    # (id, name, category, unit, u_consigliato)
    ("posa-pav-piastrelle", "Posa pavimento piastrelle", "MURATURA", "m²", 20.0),
    ("piastrelle-pavimento", "Piastrelle pavimento", "MURATURA", "m²", 45.0),
    ("posa-riv-piastrelle", "Posa rivestimento piastrelle", "MURATURA", "m²", 25.0),
    ("piastrelle-rivestimento", "Piastrelle rivestimento", "MURATURA", "m²", 45.0),
    ("posa-massetto", "Posa massetto", "MURATURA", "m²", 17.0),
    ("autolivellante", "Autolivellante", "MURATURA", "m²", 20.0),
    ("massetto-radiante", "Massetto per radiante", "MURATURA", "m²", 25.0),
    ("muro-mattone", "Muro in mattoni", "MURATURA", "m²", 40.0),
    ("muro-cartongesso", "Muro in cartongesso", "MURATURA", "m²", 25.0),
    ("controsoffitto", "Controsoffitto", "MURATURA", "m²", 30.0),
    ("decorazione", "Decorazione / tinteggio", "MURATURA", "m²", 8.0),
    ("battiscopa", "Posa battiscopa", "MURATURA", "ml", 6.0),
    ("demolizione-pavimento", "Demolizione pavimento", "MURATURA", "m²", 15.0),
    ("demolizione-muri", "Demolizione muri", "MURATURA", "m²", 25.0),
    ("smaltimento", "Smaltimento macerie", "MURATURA", "forfait", 800.0),
    # IMPIANTI
    ("impianto-elettrico", "Impianto elettrico completo", "IMPIANTI", "m²", 55.0),
    ("impianto-idraulico", "Impianto idraulico completo", "IMPIANTI", "m²", 65.0),
    ("impianto-riscaldamento", "Impianto riscaldamento a radiatori", "IMPIANTI", "m²", 45.0),
    ("impianto-radiante", "Impianto riscaldamento a pavimento", "IMPIANTI", "m²", 75.0),
    ("caldaia-condensazione", "Caldaia a condensazione", "IMPIANTI", "pz", 2200.0),
    ("predisposizione-clima", "Predisposizione climatizzatore", "IMPIANTI", "pz", 180.0),
    ("condizionatore-dual", "Climatizzatore dual split", "IMPIANTI", "pz", 3100.0),
    # ACCESSORI
    ("porte-interne", "Porte interne serie standard", "ACCESSORI", "pz", 450.0),
    ("porta-blindata", "Portoncino blindato", "ACCESSORI", "pz", 1900.0),
    ("tapparelle", "Tapparelle nuove", "ACCESSORI", "pz", 280.0),
    ("zanzariere", "Zanzariere", "ACCESSORI", "pz", 260.0),
    ("sanitari-bagno", "Sanitari bagno (WC+bidet+lavabo)", "ACCESSORI", "pz", 850.0),
    ("box-doccia", "Box doccia", "ACCESSORI", "pz", 650.0),
    ("mobile-bagno", "Mobile bagno", "ACCESSORI", "pz", 580.0),
    # BUROCRAZIA
    ("pratica-cila", "Pratica CILA", "BUROCRAZIA", "forfait", 850.0),
    ("direzione-lavori", "Direzione lavori", "BUROCRAZIA", "forfait", 1500.0),
    ("cert-impianti", "Certificazioni impianti", "BUROCRAZIA", "forfait", 600.0),
    ("ape", "Attestato prestazione energetica", "BUROCRAZIA", "forfait", 300.0),
]

# package definitions: qty_ratio is how much is included per m² of abitazione
DEFAULT_PACKAGES = [
    {
        "id": "pkg-basic",
        "name": "BASIC",
        "subtitle": "Ristrutturazione base con materiali standard",
        "price_per_m2": 380.0,
        "color": "#475569",
        "description": "Tinteggio, piccoli interventi, rivestimenti bagno base. Ideale per un refresh.",
        "included": {
            # id: {qty_ratio, unit_price (override), included?}
            "posa-riv-piastrelle": {"qty_ratio": 0.2857, "unit_price": 27.5},
            "piastrelle-rivestimento": {"qty_ratio": 0.4, "unit_price": 13.2},
            "decorazione": {"qty_ratio": 2.7, "unit_price": 8.0},
            "muro-cartongesso": {"qty_ratio": 0.143, "unit_price": 26.0},
            "impianto-elettrico": {"qty_ratio": 0.3, "unit_price": 35.0},
            "porte-interne": {"qty_ratio": 0.057, "unit_price": 350.0},  # ~4 porte su 70mq
            "smaltimento": {"qty_ratio": 0.005, "unit_price": 800.0},
            "pratica-cila": {"qty_ratio": 0.014, "unit_price": 850.0},
        },
    },
    {
        "id": "pkg-easy",
        "name": "EASY",
        "subtitle": "Ristrutturazione leggera",
        "price_per_m2": 490.0,
        "color": "#3B82F6",
        "description": "Rifacimento pavimenti, bagno completo, tinteggi, impianti adeguati.",
        "included": {
            "posa-pav-piastrelle": {"qty_ratio": 1.0, "unit_price": 25.0},
            "piastrelle-pavimento": {"qty_ratio": 1.15, "unit_price": 14.85},
            "posa-riv-piastrelle": {"qty_ratio": 0.235, "unit_price": 27.5},
            "piastrelle-rivestimento": {"qty_ratio": 0.329, "unit_price": 14.85},
            "posa-massetto": {"qty_ratio": 1.0, "unit_price": 20.0},
            "decorazione": {"qty_ratio": 2.7, "unit_price": 8.0},
            "muro-cartongesso": {"qty_ratio": 0.2, "unit_price": 26.0},
            "controsoffitto": {"qty_ratio": 0.5, "unit_price": 30.0},
            "impianto-elettrico": {"qty_ratio": 1.0, "unit_price": 55.0},
            "impianto-idraulico": {"qty_ratio": 0.15, "unit_price": 65.0},
            "porte-interne": {"qty_ratio": 0.057, "unit_price": 450.0},
            "sanitari-bagno": {"qty_ratio": 0.012, "unit_price": 850.0},
            "box-doccia": {"qty_ratio": 0.012, "unit_price": 650.0},
            "pratica-cila": {"qty_ratio": 0.012, "unit_price": 850.0},
            "smaltimento": {"qty_ratio": 0.012, "unit_price": 800.0},
        },
    },
    {
        "id": "pkg-plus",
        "name": "PLUS",
        "subtitle": "Ristrutturazione completa",
        "price_per_m2": 790.0,
        "color": "#0EA5E9",
        "description": "Tutto rifatto: pavimenti, bagni, impianti, climatizzazione, serramenti.",
        "included": {
            "posa-pav-piastrelle": {"qty_ratio": 1.0, "unit_price": 25.0},
            "piastrelle-pavimento": {"qty_ratio": 1.2, "unit_price": 18.15},
            "posa-riv-piastrelle": {"qty_ratio": 0.286, "unit_price": 27.5},
            "piastrelle-rivestimento": {"qty_ratio": 0.4, "unit_price": 16.5},
            "posa-massetto": {"qty_ratio": 1.0, "unit_price": 20.0},
            "decorazione": {"qty_ratio": 2.7, "unit_price": 8.0},
            "muro-mattone": {"qty_ratio": 0.15, "unit_price": 45.0},
            "muro-cartongesso": {"qty_ratio": 0.3, "unit_price": 26.0},
            "controsoffitto": {"qty_ratio": 0.5, "unit_price": 30.225},
            "impianto-elettrico": {"qty_ratio": 1.0, "unit_price": 55.0},
            "impianto-idraulico": {"qty_ratio": 0.3, "unit_price": 65.0},
            "impianto-riscaldamento": {"qty_ratio": 1.0, "unit_price": 45.0},
            "predisposizione-clima": {"qty_ratio": 0.042, "unit_price": 180.0},
            "porte-interne": {"qty_ratio": 0.071, "unit_price": 490.0},
            "sanitari-bagno": {"qty_ratio": 0.014, "unit_price": 950.0},
            "box-doccia": {"qty_ratio": 0.014, "unit_price": 720.0},
            "mobile-bagno": {"qty_ratio": 0.014, "unit_price": 680.0},
            "pratica-cila": {"qty_ratio": 0.014, "unit_price": 850.0},
            "direzione-lavori": {"qty_ratio": 0.014, "unit_price": 1500.0},
            "ape": {"qty_ratio": 0.014, "unit_price": 300.0},
            "smaltimento": {"qty_ratio": 0.014, "unit_price": 800.0},
        },
    },
    {
        "id": "pkg-top",
        "name": "TOP",
        "subtitle": "Ristrutturazione di lusso",
        "price_per_m2": 1180.0,
        "color": "#0A0A0A",
        "description": "Finiture premium, impianti top di gamma, domotica, marmi, massetto radiante.",
        "included": {
            "posa-pav-piastrelle": {"qty_ratio": 1.0, "unit_price": 30.0},
            "piastrelle-pavimento": {"qty_ratio": 1.15, "unit_price": 50.82},
            "posa-riv-piastrelle": {"qty_ratio": 0.167, "unit_price": 35.0},
            "piastrelle-rivestimento": {"qty_ratio": 0.233, "unit_price": 50.82},
            "posa-massetto": {"qty_ratio": 1.0, "unit_price": 22.0},
            "massetto-radiante": {"qty_ratio": 1.0, "unit_price": 25.0},
            "decorazione": {"qty_ratio": 2.7, "unit_price": 12.0},
            "muro-mattone": {"qty_ratio": 0.15, "unit_price": 45.0},
            "muro-cartongesso": {"qty_ratio": 0.4, "unit_price": 28.0},
            "controsoffitto": {"qty_ratio": 0.8, "unit_price": 32.0},
            "impianto-elettrico": {"qty_ratio": 1.0, "unit_price": 75.0},
            "impianto-idraulico": {"qty_ratio": 0.3, "unit_price": 80.0},
            "impianto-radiante": {"qty_ratio": 1.0, "unit_price": 75.0},
            "caldaia-condensazione": {"qty_ratio": 0.008, "unit_price": 2500.0},
            "condizionatore-dual": {"qty_ratio": 0.008, "unit_price": 3100.0},
            "porte-interne": {"qty_ratio": 0.067, "unit_price": 850.0},
            "porta-blindata": {"qty_ratio": 0.008, "unit_price": 2200.0},
            "tapparelle": {"qty_ratio": 0.058, "unit_price": 320.0},
            "zanzariere": {"qty_ratio": 0.058, "unit_price": 300.0},
            "sanitari-bagno": {"qty_ratio": 0.017, "unit_price": 1500.0},
            "box-doccia": {"qty_ratio": 0.017, "unit_price": 1200.0},
            "mobile-bagno": {"qty_ratio": 0.017, "unit_price": 1200.0},
            "pratica-cila": {"qty_ratio": 0.008, "unit_price": 1200.0},
            "direzione-lavori": {"qty_ratio": 0.008, "unit_price": 2200.0},
            "ape": {"qty_ratio": 0.008, "unit_price": 350.0},
            "cert-impianti": {"qty_ratio": 0.008, "unit_price": 800.0},
            "smaltimento": {"qty_ratio": 0.008, "unit_price": 1000.0},
        },
    },
]

DEFAULT_OPTIONAL = [
    # SOFT
    {"id": "opt-pav-gres-easy", "package_ids": ["pkg-soft"], "name": "Pavimentazione gres (upgrade Easy)", "price_listino": 4200.0, "price_scontato": 3780.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-sottofondo-soft", "package_ids": ["pkg-soft"], "name": "Rifacimento sottofondo (demolizione+massetto)", "price_listino": 5250.0, "price_scontato": 4725.0, "unit": "€/m²", "per_m2": True, "unit_price_listino": 75.0, "unit_price_scontato": 67.5},
    {"id": "opt-condiz-dual-soft", "package_ids": ["pkg-soft", "pkg-easy"], "name": "Condizionatore dual (mano d'opera inclusa)", "price_listino": 3100.0, "price_scontato": 2790.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-arredo-artigian", "package_ids": ["pkg-soft", "pkg-easy"], "name": "Arredamento artigiano (mobili su misura)", "price_listino": 5000.0, "price_scontato": 4500.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-porta-blindata", "package_ids": ["pkg-soft", "pkg-easy"], "name": "Portoncino blindato", "price_listino": 2100.0, "price_scontato": 1890.0, "unit": "pz", "per_m2": False},
    # EASY
    {"id": "opt-pav-gres-plus", "package_ids": ["pkg-easy"], "name": "Pavimentazione gres (upgrade Plus)", "price_listino": 4675.0, "price_scontato": 4207.5, "unit": "forfait", "per_m2": False},
    {"id": "opt-condiz-trial", "package_ids": ["pkg-easy", "pkg-plus"], "name": "Condizionatore trial split", "price_listino": 4500.0, "price_scontato": 4050.0, "unit": "forfait", "per_m2": False},
    # PLUS
    {"id": "opt-sottofondo-plus", "package_ids": ["pkg-plus"], "name": "Rifacimento sottofondo", "price_listino": 5250.0, "price_scontato": 4725.0, "unit": "€/m²", "per_m2": True, "unit_price_listino": 75.0, "unit_price_scontato": 67.5},
    {"id": "opt-canalizzato", "package_ids": ["pkg-plus", "pkg-top"], "name": "Climatizzazione canalizzata", "price_listino": 7500.0, "price_scontato": 6750.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-tapparelle", "package_ids": ["pkg-plus"], "name": "Tapparelle motorizzate", "price_listino": 2240.0, "price_scontato": 2016.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-zanzariere", "package_ids": ["pkg-plus"], "name": "Zanzariere", "price_listino": 2080.0, "price_scontato": 1872.0, "unit": "forfait", "per_m2": False},
    # bathroom add-ons
    {"id": "opt-bagno-silver", "package_ids": ["pkg-soft", "pkg-easy", "pkg-plus", "pkg-top"], "name": "Bagno aggiuntivo SILVER", "price_listino": 6900.0, "price_scontato": 6210.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-bagno-gold", "package_ids": ["pkg-easy", "pkg-plus", "pkg-top"], "name": "Bagno aggiuntivo GOLD", "price_listino": 9800.0, "price_scontato": 8820.0, "unit": "forfait", "per_m2": False},
    {"id": "opt-bagno-platinum", "package_ids": ["pkg-plus", "pkg-top"], "name": "Bagno aggiuntivo PLATINUM", "price_listino": 13500.0, "price_scontato": 12150.0, "unit": "forfait", "per_m2": False},
]

BATHROOM_TIERS = [
    {"id": "bagno-silver", "name": "SILVER", "surcharge": 0.0, "description": "Dotazione standard: sanitari bianchi, box doccia essenziale, miscelatori base.", "color": "#94A3B8"},
    {"id": "bagno-gold", "name": "GOLD", "surcharge": 1900.0, "description": "Sanitari design, box doccia cristallo, miscelatori premium, mobile bagno con top.", "color": "#F59E0B"},
    {"id": "bagno-platinum", "name": "PLATINUM", "surcharge": 5900.0, "description": "Top di gamma: vasca freestanding, sanitari sospesi premium, rivestimento mosaico, doccia walk-in.", "color": "#0A0A0A"},
]
