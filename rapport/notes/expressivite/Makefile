TARGET = main

.PHONY: all build clean_temp clean

all: build clean_temp

build: $(TARGET).tex references.bib
	latexmk -pdf -interaction=nonstopmode -halt-on-error $(TARGET).tex

clean_temp:
	latexmk -c $(TARGET).tex

# Nettoyage complet
clean:
	latexmk -C $(TARGET).tex
	rm -f $(TARGET).pdf
