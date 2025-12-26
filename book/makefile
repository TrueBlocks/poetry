SRC_MD := $(shell find src -name '*.md')

book: $(SRC_MD) makefile
	@echo building...
	@mdbook build

serve:
	@mdbook serve --open --hostname 127.0.0.1

clean:
	@rm -fR book

.PHONY: book serve clean
