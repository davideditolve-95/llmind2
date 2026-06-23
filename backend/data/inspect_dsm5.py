import pdfplumber

pdf_path = "data/dsm5.pdf"
with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    print("\n--- Page 1 text ---")
    print(pdf.pages[0].extract_text()[:1000] if pdf.pages[0].extract_text() else "[Empty Page]")
    print("\n--- Page 2 text ---")
    print(pdf.pages[1].extract_text()[:1000] if pdf.pages[1].extract_text() else "[Empty Page]")
    print("\n--- Page 10 text ---")
    print(pdf.pages[9].extract_text()[:1000] if pdf.pages[9].extract_text() else "[Empty Page]")
