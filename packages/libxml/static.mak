#!/usr/bin/env make

LIBXML2_TAG?=v2.9.10
DOCKER_RUN_IN_LIBXML =${DOCKER_ENV} -e NOCONFIGURE=1 -w /src/third_party/libxml2/ emscripten-builder

ifeq ($(filter ${WITH_LIBXML},0 1 shared static),)
$(error WITH_LIBXML MUST BE 0, 1, static OR shared. PLEASE CHECK YOUR SETTINGS FILE: $(abspath ${ENV_FILE}))
endif

ifeq (${WITH_LIBXML},1)
WITH_LIBXML=static
endif

ifeq (${WITH_LIBXML},static)
ARCHIVES+= lib/lib/libxml2.a
CONFIGURE_FLAGS+= --with-libxml --enable-xml --enable-dom --enable-simplexml
TEST_LIST+=$(shell ls packages/libxml/test/*.mjs)
endif

ifeq (${WITH_LIBXML},shared)
CONFIGURE_FLAGS+= --with-libxml=/src/lib/ --enable-xml --enable-dom --enable-simplexml
SHARED_LIBS+= packages/libxml/libxml2.so
PHP_CONFIGURE_DEPS+= packages/libxml/libxml2.so
TEST_LIST+=$(shell ls packages/libxml/test/*.mjs)
SKIP_LIBS+= -lxml2
endif

third_party/libxml2/.gitignore:
	@ echo -e "\e[33;4mDownloading LibXML2\e[0m"
	${DOCKER_RUN} git clone https://gitlab.gnome.org/GNOME/libxml2.git third_party/libxml2 \
		--branch ${LIBXML2_TAG} \
		--single-branch     \
		--depth 1;

lib/lib/libxml2.a: third_party/libxml2/.gitignore
	@ echo -e "\e[33;4mBuilding LibXML2\e[0m"
	${DOCKER_RUN_IN_LIBXML} ./autogen.sh
	${DOCKER_RUN_IN_LIBXML} emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --prefix=/src/lib/ --cache-file=/tmp/config-cache
	${DOCKER_RUN_IN_LIBXML} emmake make -j${CPU_COUNT} EMCC_CFLAGS='-fPIC -sSIDE_MODULE=1 -O${OPTIMIZE} ' Z_LIBS=''
	${DOCKER_RUN_IN_LIBXML} emmake make install

lib/lib/libxml2.so: lib/lib/libxml2.a

packages/libxml/libxml2.so: lib/lib/libxml2.so
	cp -L $^ $@
