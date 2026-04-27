TARGET = main

LATEX = pdflatex

.PHONY: all clean_temp clean

all: $(TARGET).pdf clean_temp

$(TARGET).pdf:
	$(LATEX) -interaction=nonstopmode $(TARGET).tex
	$(LATEX) -interaction=nonstopmode $(TARGET).tex 
clean_temp:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz *.bbl *.blg *.nav *.snm

# Nettoyage complet
clean: clean_temp
	rm -f $(TARGET).pdf
