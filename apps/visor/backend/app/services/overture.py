"""Traducción de las categorías de Overture Maps Places a las subcategorías de GeoHive."""

# Categoría Overture (taxonomy.primary) → subcategorías GeoHive (la primera define el ícono)
MAPEO: dict[str, list[str]] = {
    # Comer y beber
    "restaurant": ["restaurantes"], "peruvian_restaurant": ["restaurantes"], "bar_and_grill_restaurant": ["restaurantes"],
    "barbecue_restaurant": ["restaurantes"], "steakhouse": ["restaurantes"], "buffet_restaurant": ["restaurantes"],
    "chinese_restaurant": ["chifas", "restaurantes"], "chicken_restaurant": ["pollerias", "restaurantes"],
    "seafood_restaurant": ["cevicherias", "restaurantes"],
    "fast_food_restaurant": ["comida_rapida"], "burger_restaurant": ["comida_rapida"], "pizza_restaurant": ["comida_rapida"],
    "sandwich_shop": ["comida_rapida"],
    "coffee_shop": ["cafeterias"], "cafe": ["cafeterias"],
    "bakery": ["panaderias"], "dessert_shop": ["panaderias"], "cupcake_shop": ["panaderias"], "patisserie_cake_shop": ["panaderias"],
    "bar": ["bares"], "pub": ["bares"], "gastropub": ["bares"], "lounge": ["bares"], "tapas_bar": ["bares"], "beer_bar": ["bares"],
    "ice_cream_shop": ["heladerias"],
    # Compras
    "grocery_store": ["bodegas"], "convenience_store": ["bodegas"], "food_and_beverage_store": ["bodegas"],
    "produce_store": ["bodegas"], "liquor_store": ["bodegas"],
    "supermarket": ["supermercados"], "warehouse_club_store": ["supermercados"],
    "farmers_market": ["mercados"], "public_market": ["mercados"],
    "shopping_mall": ["centros_comerciales"], "department_store": ["centros_comerciales"],
    "clothing_store": ["ropa"], "shoe_store": ["ropa"], "fashion_accessories_store": ["ropa"], "fashion_and_apparel_store": ["ropa"],
    "fashion_boutique": ["ropa"], "sportswear_store": ["ropa"],
    "mobile_phone_store": ["tecnologia"], "computer_store": ["tecnologia"], "electronics_store": ["tecnologia"],
    "it_service_and_computer_repair": ["tecnologia"], "video_game_store": ["tecnologia"],
    "hardware_store": ["ferreterias"], "building_supply_store": ["ferreterias"],
    "bookstore": ["librerias"], "office_supply_store": ["librerias"],
    # Salud
    "pharmacy": ["farmacias"], "drugstore": ["farmacias"],
    "hospital": ["hospitales"],
    "health_care": ["clinicas"], "medical_center": ["clinicas"], "outpatient_care_facility": ["clinicas"],
    "medical_service_organization": ["clinicas"],
    "doctors_office": ["consultorios"], "family_practice": ["consultorios"], "obstetrics_and_gynecology": ["consultorios"],
    "podiatry": ["consultorios"], "psychology": ["consultorios"], "chiropractic": ["consultorios"],
    "plastic_and_reconstructive_surgery": ["consultorios"], "physical_therapy": ["consultorios"],
    "dental_clinic": ["dentistas"], "general_dentistry": ["dentistas"], "orthodontics": ["dentistas"],
    "laboratory_testing": ["laboratorios"],
    "veterinarian": ["veterinarias"],
    "eyewear_store": ["opticas"], "optometry": ["opticas"], "vision_or_eye_care_clinic": ["opticas"],
    # Bienestar y deporte
    "gym": ["gimnasios"], "sport_or_fitness_facility": ["gimnasios"], "martial_arts_club": ["gimnasios"],
    "gymnastics_center": ["gimnasios"],
    "soccer_field": ["deportes"], "stadium_arena": ["deportes"],
    "swimming_pool": ["piscinas"],
    "beauty_salon": ["peluquerias"], "barber": ["peluquerias"], "hair_salon": ["peluquerias"], "nail_salon": ["peluquerias"],
    "spa": ["spa"],
    # Educación
    "preschool": ["inicial"], "day_care_preschool": ["inicial"],
    "school": ["colegios"], "private_school": ["colegios"], "elementary_school": ["colegios"], "high_school": ["colegios"],
    "middle_school": ["colegios"], "public_school": ["colegios"], "religious_school": ["colegios"],
    "college_university": ["universidades"],
    "library": ["bibliotecas"],
    # Entretenimiento
    "movie_theater": ["cines"], "theatre_venue": ["teatros"], "auditorium": ["teatros"],
    "dance_club": ["discotecas"], "karaoke_venue": ["discotecas"],
    "playground": ["juegos_infantiles"], "amusement_park": ["diversion"],
    # Servicios
    "gas_station": ["grifos"],
    "automotive_repair": ["talleres"], "motorcycle_repair": ["talleres"], "tire_dealer_and_repair": ["talleres"],
    "oil_change_station": ["talleres"],
    "parking": ["estacionamientos"], "laundromat": ["lavanderias"], "notary_public": ["notarias"],
    "printing_service": ["imprentas"],
    # Hospedaje
    "hotel": ["hoteles"], "hostel": ["hostales"], "lodging": ["hostales"], "lodge": ["hostales"], "bed_and_breakfast": ["hostales"],
    "holiday_rental_home": ["departamentos"], "campground": ["campamentos"],
    # Espacios y eventos
    "party_and_event_planning": ["locales_eventos"], "community_center": ["centros_comunales"],
    # Turismo y naturaleza
    "museum": ["museos"], "history_museum": ["museos"], "art_gallery": ["museos"],
    "historic_site": ["atractivos"],
    "park": ["parques"], "public_plaza": ["parques"], "beach": ["playas"],
    # Servicios públicos
    "town_hall": ["municipalidades"], "police_station": ["comisarias"], "fire_station": ["bomberos"],
    "courthouse": ["juzgados"], "government_office": ["gobierno"],
    # Transporte
    "bus_station": ["terminales"], "airport": ["aeropuertos"],
    # Bancos y dinero
    "bank_or_credit_union": ["bancos"], "bank": ["bancos"],
    # Empresas e industria
    "corporate_or_business_office": ["oficinas"], "attorney_or_law_firm": ["oficinas"], "accountant": ["oficinas"],
    "insurance_agency": ["oficinas"], "real_estate_agent": ["oficinas"], "real_estate_service": ["oficinas"],
    "legal_service": ["oficinas"], "professional_service": ["oficinas"],
    "manufacturer": ["industrias"], "industrial_company": ["industrias"], "chemical_plant": ["industrias"],
    "metal_fabricator": ["industrias"],
    "storage_facility": ["almacenes"],
}

# Sufijos: «x_restaurant» → restaurantes, «x_clothing_store» → ropa…
SUFIJOS: list[tuple[str, list[str]]] = [
    ("_restaurant", ["restaurantes"]),
    ("_clothing_store", ["ropa"]),
    ("_manufacturer", ["industrias"]),
    ("_place_of_worship", ["templos"]),
    ("_dentistry", ["dentistas"]),
]


def subcategorias_overture(primaria: str | None, alternativas: list[str] | None) -> list[str]:
    """Subcategorías GeoHive de un lugar Overture (prueba la categoría principal y luego las alternativas)."""
    for categoria in [primaria, *(alternativas or [])]:
        if not categoria:
            continue
        if categoria in MAPEO:
            return MAPEO[categoria]
        for sufijo, subs in SUFIJOS:
            if categoria.endswith(sufijo):
                return subs
    return []
