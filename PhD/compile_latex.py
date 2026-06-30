#!/usr/bin/env python3
import os
import subprocess
import shutil
import sys

def check_latex_installed():
    """Verifica se pdflatex è presente nel PATH di sistema."""
    return shutil.which("pdflatex") is not None

def compile_pdf(tex_filename):
    """Compila un file .tex in .pdf eseguendo pdflatex due volte per i riferimenti."""
    base_name = os.path.splitext(tex_filename)[0]
    pdf_filename = f"{base_name}.pdf"
    
    print(f"\n--- Compilazione di {tex_filename} in corso... ---")
    
    # Primo passaggio
    print("Passaggio 1: Generazione del PDF e dei file ausiliari...")
    result = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", tex_filename],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Errore durante il primo passaggio di compilazione per {tex_filename}:")
        print(result.stdout[-1000:])  # Mostra le ultime 1000 righe dell'output
        return False
        
    # Secondo passaggio per risolvere riferimenti incrociati e collegamenti ipertestuali
    print("Passaggio 2: Risoluzione dei riferimenti incrociati...")
    result = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", tex_filename],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Errore durante il secondo passaggio di compilazione per {tex_filename}:")
        return False
        
    print(f"Successo! Creato il file: {pdf_filename}")
    return True

def clean_temp_files(directory, base_names):
    """Rimuove i file temporanei generati da LaTeX (.aux, .log, .out, .toc, .synctex.gz)."""
    extensions = [".aux", ".log", ".out", ".toc", ".synctex.gz"]
    print("\nPulizia dei file ausiliari temporanei...")
    
    for base in base_names:
        for ext in extensions:
            temp_file = os.path.join(directory, f"{base}{ext}")
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"Rimosso: {temp_file}")
                except Exception as e:
                    print(f"Impossibile rimuovere {temp_file}: {e}")

def main():
    # Imposta la directory di lavoro sulla cartella contenente lo script (PhD)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    if not check_latex_installed():
        print("=" * 80)
        print("ERRORE: 'pdflatex' non è stato trovato nel tuo sistema.")
        print("=" * 80)
        print("Per compilare localmente i file LaTeX in PDF, è necessario installare una")
        print("distribuzione LaTeX (es. MacTeX o BasicTeX).")
        print("\nPuoi installarla rapidamente tramite terminale usando Homebrew:")
        print("  BasicTeX (più leggero, consigliato):")
        print("    brew install --cask basictex")
        print("  MacTeX (completo, include GUI):")
        print("    brew install --cask mactex-no-gui")
        print("\nDopo l'installazione, riapri il terminale per aggiornare il PATH e riprova.")
        print("=" * 80)
        sys.exit(1)
        
    tex_files = ["proposta_progetto_it.tex", "proposta_progetto_en.tex"]
    base_names = [os.path.splitext(f)[0] for f in tex_files]
    
    success = True
    for tex_file in tex_files:
        if os.path.exists(tex_file):
            if not compile_pdf(tex_file):
                success = False
        else:
            print(f"File non trovato: {tex_file}")
            success = False
            
    if success:
        # Pulisce i file temporanei solo se la compilazione è andata a buon fine
        clean_temp_files(script_dir, base_names)
        print("\nProcesso completato con successo!")
    else:
        print("\nProcesso completato con alcuni errori. I file ausiliari non sono stati rimossi per permettere il debug.")

if __name__ == "__main__":
    main()
