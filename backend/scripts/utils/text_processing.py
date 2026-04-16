import re

def de_stutter(text: str) -> str:
    """
    Rimuove gli artefatti di duplicazione dei caratteri tipici dell'estrazione PDF 
    (es. "TTeemmppeerr TTaannttrruummss" -> "Temper Tantrums").
    
    Processa il testo riga per riga per evitare che blocchi lunghi di testo pulito
    diluiscano la densità di stuttering di piccoli segmenti corrotti (es. titoli).
    """
    if not text:
        return text

    lines = text.split('\n')
    cleaned_lines = []
    
    # Pattern per trovare caratteri duplicati (es. "AA", "bb", "11", "A A" o "A  A")
    # Supporta fino a 2 spazi tra i caratteri duplicati
    stutter_regex = r'([^\s])\s{0,2}\1'
    stutter_pattern = re.compile(stutter_regex)

    for line in lines:
        if len(line.strip()) < 2:
            cleaned_lines.append(line)
            continue
            
        # Calcoliamo la densità di stuttering per QUESTA riga
        matches = stutter_pattern.findall(line)
        total_chars = len([c for c in line if not c.isspace()])
        
        if total_chars == 0:
            cleaned_lines.append(line)
            continue
            
        # SOGLIA AGGRESSIVA: 15% sulla singola riga
        stutter_density = (len(matches) * 2) / total_chars
        
        if stutter_density > 0.15:
            # Applichiamo la deduplicazione
            cleaned_line = re.sub(stutter_regex, r'\1', line)
            # Seconda passata per blocchi densi residui (es. 11..11)
            if stutter_density > 0.5:
                cleaned_line = re.sub(stutter_regex, r'\1', cleaned_line)
            cleaned_lines.append(cleaned_line)
        else:
            cleaned_lines.append(line)
            
    return '\n'.join(cleaned_lines)

def de_stutter_list(items: list) -> list:
    """Applica de_stutter a ogni elemento di una lista di stringhe."""
    if not items or not isinstance(items, list):
        return items
    return [de_stutter(str(item)) if isinstance(item, str) else item for item in items]

def de_stutter_any(val):
    """Utility polimorfica per pulire stringhe o liste di stringhe."""
    if isinstance(val, str):
        return de_stutter(val)
    if isinstance(val, list):
        return de_stutter_list(val)
    return val

def de_stutter_case_number(num_str: str) -> str:
    """Specializzato per i numeri di caso (es. '11..33' -> '1.3')"""
    if not num_str:
        return num_str
    # Rimuove doppie cifre e doppi punti
    return re.sub(r'(.)\1', r'\1', num_str)
