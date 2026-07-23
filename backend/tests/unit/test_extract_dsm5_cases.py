from scripts.extract_dsm5_cases import derive_case_title, extract_patient_full_name


def test_extract_patient_full_name_from_honorific():
    text = "Introduction\nMr. John Smith is a 42-year-old accountant referred for evaluation."

    assert extract_patient_full_name(text) == "John Smith"


def test_derive_case_title_replaces_introduction_with_patient_name():
    sections = {
        "anamnesis": "Introduction\nMaria Rossi is a 31-year-old teacher with persistent insomnia.",
        "discussion": "The discussion considers anxiety and mood symptoms.",
    }

    assert derive_case_title("1.1", "Introduction", "Case 1.1\nIntroduction", sections) == "Maria Rossi"


def test_derive_case_title_uses_valid_pdf_title_when_patient_name_missing():
    sections = {
        "anamnesis": "The patient is a 31-year-old teacher with persistent insomnia.",
        "discussion": "",
    }

    assert derive_case_title("1.2", "Major Depressive Case", "Case 1.2", sections) == "Major Depressive Case"


def test_derive_case_title_falls_back_to_case_number_for_section_artifact():
    sections = {
        "anamnesis": "The patient is a 31-year-old teacher with persistent insomnia.",
        "discussion": "",
    }

    assert derive_case_title("1.3", "Introduction", "Case 1.3", sections) == "Case 1.3"
