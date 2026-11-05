#!/bin/sh
set -e
cd /c/Projects/AYUSHCMD-GITHUB/go-green/native/build
cmake ..
make -j4
./binary-lab/test_binary_lab
